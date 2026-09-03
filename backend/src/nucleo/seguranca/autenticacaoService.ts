import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ambiente } from '../../config/ambiente';
import { usuarioRepositorio } from '../../infra/repositorios/usuarioRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio } from '../dominio/erros';
import { agoraISO } from '../dominio/periodo';
import type { UsuarioAutenticado } from '../dominio/tipos';
import { permissoesDoPerfil } from './permissoes';

const TENTATIVAS_ATE_BLOQUEIO = 3;
const MINUTOS_DE_BLOQUEIO = 15;

export const autenticacaoService = {
  /** UC01 – Autenticar no sistema. */
  autenticar(login: string, senha: string) {
    const usuario = usuarioRepositorio.buscarPorLogin(somenteDigitosSePossivel(login));
    // E1: mensagem genérica para não revelar se o login existe.
    const credencialInvalida = new ErroDeNegocio('CPF ou senha inválidos.', 401);
    if (!usuario) throw credencialInvalida;

    if (usuario.bloqueado_ate && usuario.bloqueado_ate > agoraISO()) {
      throw new ErroDeNegocio(
        `Usuário bloqueado por tentativas inválidas até ${usuario.bloqueado_ate}. Procure a sargenteação.`,
        423
      );
    }
    // E3: usuário inativo ou militar desligado.
    if (!usuario.ativo || usuario.situacao_militar === 'DESLIGADO') {
      throw new ErroDeNegocio('Acesso negado. Procure a sargenteação.', 403);
    }

    if (!bcrypt.compareSync(senha, usuario.senha_hash)) {
      const tentativas = usuario.tentativas_invalidas + 1;
      const bloqueadoAte =
        tentativas >= TENTATIVAS_ATE_BLOQUEIO
          ? new Date(Date.now() + MINUTOS_DE_BLOQUEIO * 60_000).toISOString().replace('T', ' ').slice(0, 19)
          : null;
      usuarioRepositorio.registrarTentativaInvalida(usuario.id_usuario, bloqueadoAte);
      throw credencialInvalida;
    }

    usuarioRepositorio.registrarAcesso(usuario.id_usuario, agoraISO());
    auditoriaService.registrar({
      idUsuario: usuario.id_usuario,
      entidade: 'USUARIO',
      idRegistro: usuario.id_usuario,
      acao: 'ACESSO',
      valorNovo: { login: usuario.login, perfil: usuario.perfil }
    });

    const autenticado = this.montarUsuario(usuario.id_usuario);
    const token = jwt.sign({ sub: usuario.id_usuario }, ambiente.segredoJwt, { expiresIn: '8h' });

    return { token, usuario: autenticado, senhaProvisoria: Boolean(usuario.senha_provisoria) };
  },

  montarUsuario(idUsuario: number): UsuarioAutenticado {
    const usuario = usuarioRepositorio.buscarPorId(idUsuario);
    if (!usuario) throw new ErroDeNegocio('Sessão inválida.', 401);
    return {
      id_usuario: usuario.id_usuario,
      id_militar: usuario.id_militar,
      id_perfil: usuario.id_perfil,
      login: usuario.login,
      perfil: usuario.perfil,
      nome_guerra: usuario.nome_guerra,
      nome_completo: usuario.nome_completo,
      sigla_posto: usuario.sigla_posto,
      permissoes: permissoesDoPerfil(usuario.perfil)
    };
  },

  validarToken(token: string): UsuarioAutenticado {
    try {
      const conteudo = jwt.verify(token, ambiente.segredoJwt) as unknown as { sub: number };
      return this.montarUsuario(Number(conteudo.sub));
    } catch {
      throw new ErroDeNegocio('Sessão expirada ou inválida.', 401);
    }
  },

  /** UC01-A1 e RF03 – definição de nova senha (primeiro acesso ou troca voluntária). */
  alterarSenha(idUsuario: number, senhaAtual: string, novaSenha: string) {
    const usuario = usuarioRepositorio.buscarPorId(idUsuario);
    if (!usuario) throw new ErroDeNegocio('Usuário não encontrado.', 404);
    if (!bcrypt.compareSync(senhaAtual, usuario.senha_hash)) {
      throw new ErroDeNegocio('Senha atual incorreta.', 401);
    }
    if (novaSenha.length < 6) {
      throw new ErroDeNegocio('A nova senha deve ter ao menos 6 caracteres.');
    }
    usuarioRepositorio.trocarSenha(idUsuario, bcrypt.hashSync(novaSenha, 10), 0);
    auditoriaService.registrar({
      idUsuario,
      entidade: 'USUARIO',
      idRegistro: idUsuario,
      acao: 'ALTERACAO',
      valorNovo: { senha: 'alterada pelo próprio usuário' }
    });
  },

  /** UC01-A2 – "Esqueci minha senha": gera provisória e a entrega ao contato cadastrado. */
  gerarSenhaProvisoria(cpf: string): string {
    const usuario = usuarioRepositorio.buscarPorLogin(somenteDigitosSePossivel(cpf));
    if (!usuario) throw new ErroDeNegocio('CPF não localizado.', 404);
    const provisoria = String(Math.floor(100_000 + Math.random() * 900_000));
    usuarioRepositorio.trocarSenha(usuario.id_usuario, bcrypt.hashSync(provisoria, 10), 1);
    auditoriaService.registrar({
      idUsuario: usuario.id_usuario,
      entidade: 'USUARIO',
      idRegistro: usuario.id_usuario,
      acao: 'ALTERACAO',
      valorNovo: { senha: 'provisória gerada' }
    });
    return provisoria;
  },

  gerarHash(senha: string): string {
    return bcrypt.hashSync(senha, 10);
  }
};

function somenteDigitosSePossivel(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 11 ? digitos : valor.trim();
}
