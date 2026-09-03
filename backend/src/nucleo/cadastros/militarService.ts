import { emTransacao } from '../../infra/banco';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { usuarioRepositorio } from '../../infra/repositorios/usuarioRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio, ErroNaoEncontrado } from '../dominio/erros';
import { hojeISO } from '../dominio/periodo';
import { autenticacaoService } from '../seguranca/autenticacaoService';
import type { NomePerfil, SituacaoMilitar } from '../dominio/tipos';

export interface DadosMilitar {
  nome_completo: string;
  nome_guerra: string;
  cpf: string;
  id_posto: number;
  email: string | null;
  telefone: string | null;
  situacao: SituacaoMilitar;
  cursos: { id_curso: number; data_conclusao: string }[];
  perfil?: NomePerfil;
}

/** UC02 – Manter perfil de militar (inclusão, alteração, consulta e inativação). */
export const militarService = {
  listar: militarRepositorio.listar,
  buscar: militarRepositorio.buscarPorId,

  incluir(dados: DadosMilitar, idUsuario: number) {
    const cpf = normalizarCpf(dados.cpf);
    if (militarRepositorio.buscarPorCpf(cpf)) {
      throw new ErroDeNegocio('Já existe militar cadastrado com este CPF.', 409);
    }
    validarObrigatorios(dados);

    return emTransacao(() => {
      const idMilitar = militarRepositorio.inserir({
        nome_completo: dados.nome_completo.trim(),
        nome_guerra: dados.nome_guerra.trim(),
        cpf,
        id_posto: dados.id_posto,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        dias_sem_servico: 0,
        data_fim_ultima_missao: null,
        situacao: dados.situacao ?? 'ATIVO'
      });
      militarRepositorio.definirCursos(idMilitar, dados.cursos ?? []);

      // UC02 passo 8: o cadastro do militar já cria o usuário de acesso com perfil padrão.
      const perfil = usuarioRepositorio
        .listarPerfis()
        .find((p) => p.nome === (dados.perfil ?? 'MILITAR_ESCALADO'));
      if (perfil) {
        usuarioRepositorio.inserir({
          id_militar: idMilitar,
          id_perfil: perfil.id_perfil,
          login: cpf,
          senha_hash: autenticacaoService.gerarHash(cpf.slice(0, 6)),
          senha_provisoria: 1
        });
      }

      auditoriaService.registrar({
        idUsuario,
        entidade: 'MILITAR',
        idRegistro: idMilitar,
        acao: 'INCLUSAO',
        valorNovo: { ...dados, cpf }
      });
      return militarRepositorio.buscarPorId(idMilitar);
    });
  },

  alterar(idMilitar: number, dados: DadosMilitar, idUsuario: number) {
    const atual = militarRepositorio.buscarPorId(idMilitar);
    if (!atual) throw new ErroNaoEncontrado('Militar');
    validarObrigatorios(dados);

    const cpf = normalizarCpf(dados.cpf);
    const homonimo = militarRepositorio.buscarPorCpf(cpf);
    if (homonimo && homonimo.id_militar !== idMilitar) {
      throw new ErroDeNegocio('CPF já utilizado por outro militar.', 409);
    }

    return emTransacao(() => {
      militarRepositorio.atualizar(idMilitar, {
        nome_completo: dados.nome_completo.trim(),
        nome_guerra: dados.nome_guerra.trim(),
        cpf,
        id_posto: dados.id_posto,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        situacao: dados.situacao
      });
      militarRepositorio.definirCursos(idMilitar, dados.cursos ?? []);

      if (dados.perfil) {
        const usuario = usuarioRepositorio.buscarPorMilitar(idMilitar);
        const perfil = usuarioRepositorio.listarPerfis().find((p) => p.nome === dados.perfil);
        if (usuario && perfil) usuarioRepositorio.alterarPerfil(usuario.id_usuario, perfil.id_perfil);
      }

      auditoriaService.registrar({
        idUsuario,
        entidade: 'MILITAR',
        idRegistro: idMilitar,
        acao: 'ALTERACAO',
        valorAnterior: atual,
        valorNovo: { ...dados, cpf }
      });
      return militarRepositorio.buscarPorId(idMilitar);
    });
  },

  /** UC02-A2 – Inativação, preservando o histórico de serviços do militar. */
  inativar(idMilitar: number, motivo: string, idUsuario: number) {
    const atual = militarRepositorio.buscarPorId(idMilitar);
    if (!atual) throw new ErroNaoEncontrado('Militar');
    // UC02-E3: militar com serviço previsto precisa ser substituído antes.
    if (militarRepositorio.possuiServicoFuturo(idMilitar, hojeISO())) {
      throw new ErroDeNegocio(
        'Militar possui serviço previsto na escala. Substitua-o antes de inativar.',
        409
      );
    }
    emTransacao(() => {
      militarRepositorio.atualizar(idMilitar, { situacao: 'AFASTADO' });
      const usuario = usuarioRepositorio.buscarPorMilitar(idMilitar);
      if (usuario) usuarioRepositorio.definirAtivo(usuario.id_usuario, 0);
      auditoriaService.registrar({
        idUsuario,
        entidade: 'MILITAR',
        idRegistro: idMilitar,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: atual.situacao },
        valorNovo: { situacao: 'AFASTADO', motivo }
      });
    });
  },

  reativar(idMilitar: number, idUsuario: number) {
    const atual = militarRepositorio.buscarPorId(idMilitar);
    if (!atual) throw new ErroNaoEncontrado('Militar');
    emTransacao(() => {
      militarRepositorio.atualizar(idMilitar, { situacao: 'ATIVO' });
      const usuario = usuarioRepositorio.buscarPorMilitar(idMilitar);
      if (usuario) usuarioRepositorio.definirAtivo(usuario.id_usuario, 1);
      auditoriaService.registrar({
        idUsuario,
        entidade: 'MILITAR',
        idRegistro: idMilitar,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: atual.situacao },
        valorNovo: { situacao: 'ATIVO' }
      });
    });
  }
};

function validarObrigatorios(dados: DadosMilitar) {
  if (!dados.nome_completo?.trim() || !dados.nome_guerra?.trim()) {
    throw new ErroDeNegocio('Nome completo e nome de guerra são obrigatórios.');
  }
  if (!dados.id_posto) throw new ErroDeNegocio('Informe o posto/graduação.');
}

function normalizarCpf(cpf: string): string {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  if (digitos.length !== 11) throw new ErroDeNegocio('CPF inválido: informe 11 dígitos.');
  return digitos;
}
