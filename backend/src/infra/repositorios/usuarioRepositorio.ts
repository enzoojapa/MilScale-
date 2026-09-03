import { banco } from '../banco';
import type { NomePerfil } from '../../nucleo/dominio/tipos';

export interface LinhaUsuario {
  id_usuario: number;
  id_militar: number;
  id_perfil: number;
  login: string;
  senha_hash: string;
  ativo: number;
  senha_provisoria: number;
  tentativas_invalidas: number;
  bloqueado_ate: string | null;
  ultimo_acesso: string | null;
  perfil: NomePerfil;
  nome_guerra: string;
  nome_completo: string;
  sigla_posto: string;
  situacao_militar: string;
}

const SELECT_BASE = `
  SELECT u.*, pf.nome AS perfil, m.nome_guerra, m.nome_completo,
         p.sigla AS sigla_posto, m.situacao AS situacao_militar
  FROM USUARIO u
  JOIN PERFIL_ACESSO pf ON pf.id_perfil = u.id_perfil
  JOIN MILITAR m        ON m.id_militar = u.id_militar
  JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto`;

export const usuarioRepositorio = {
  buscarPorLogin(login: string): LinhaUsuario | null {
    return (banco.prepare(`${SELECT_BASE} WHERE u.login = ?`).get(login) as LinhaUsuario) ?? null;
  },

  buscarPorId(idUsuario: number): LinhaUsuario | null {
    return (banco.prepare(`${SELECT_BASE} WHERE u.id_usuario = ?`).get(idUsuario) as LinhaUsuario) ?? null;
  },

  buscarPorMilitar(idMilitar: number): LinhaUsuario | null {
    return (banco.prepare(`${SELECT_BASE} WHERE u.id_militar = ?`).get(idMilitar) as LinhaUsuario) ?? null;
  },

  listar(): LinhaUsuario[] {
    return banco.prepare(`${SELECT_BASE} ORDER BY pf.nome, m.nome_guerra`).all() as LinhaUsuario[];
  },

  inserir(dados: {
    id_militar: number;
    id_perfil: number;
    login: string;
    senha_hash: string;
    senha_provisoria: number;
  }): number {
    const r = banco
      .prepare(
        `INSERT INTO USUARIO (id_militar, id_perfil, login, senha_hash, ativo, senha_provisoria)
         VALUES (@id_militar, @id_perfil, @login, @senha_hash, 1, @senha_provisoria)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  registrarAcesso(idUsuario: number, dataHora: string): void {
    banco
      .prepare('UPDATE USUARIO SET ultimo_acesso = ?, tentativas_invalidas = 0, bloqueado_ate = NULL WHERE id_usuario = ?')
      .run(dataHora, idUsuario);
  },

  registrarTentativaInvalida(idUsuario: number, bloqueadoAte: string | null): void {
    banco
      .prepare(
        'UPDATE USUARIO SET tentativas_invalidas = tentativas_invalidas + 1, bloqueado_ate = ? WHERE id_usuario = ?'
      )
      .run(bloqueadoAte, idUsuario);
  },

  trocarSenha(idUsuario: number, senhaHash: string, provisoria: number): void {
    banco
      .prepare('UPDATE USUARIO SET senha_hash = ?, senha_provisoria = ? WHERE id_usuario = ?')
      .run(senhaHash, provisoria, idUsuario);
  },

  alterarPerfil(idUsuario: number, idPerfil: number): void {
    banco.prepare('UPDATE USUARIO SET id_perfil = ? WHERE id_usuario = ?').run(idPerfil, idUsuario);
  },

  definirAtivo(idUsuario: number, ativo: number): void {
    banco.prepare('UPDATE USUARIO SET ativo = ? WHERE id_usuario = ?').run(ativo, idUsuario);
  },

  permissoesDoPerfil(idPerfil: number): string[] {
    const linhas = banco
      .prepare(
        `SELECT pm.codigo FROM PERFIL_PERMISSAO pp
         JOIN PERMISSAO pm ON pm.id_permissao = pp.id_permissao
         WHERE pp.id_perfil = ?`
      )
      .all(idPerfil) as { codigo: string }[];
    return linhas.map((l) => l.codigo);
  },

  listarPerfis() {
    return banco.prepare('SELECT * FROM PERFIL_ACESSO ORDER BY id_perfil').all() as {
      id_perfil: number;
      nome: NomePerfil;
      descricao: string | null;
    }[];
  }
};
