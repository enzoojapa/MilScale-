import { banco } from '../banco';
import type { AcaoAuditoria } from '../../nucleo/dominio/tipos';

export const auditoriaRepositorio = {
  inserir(dados: {
    id_usuario: number | null;
    entidade: string;
    id_registro: number;
    acao: AcaoAuditoria;
    valor_anterior: string | null;
    valor_novo: string | null;
    data_hora: string;
  }): void {
    banco
      .prepare(
        `INSERT INTO LOG_AUDITORIA (id_usuario, entidade, id_registro, acao, valor_anterior, valor_novo, data_hora)
         VALUES (@id_usuario, @entidade, @id_registro, @acao, @valor_anterior, @valor_novo, @data_hora)`
      )
      .run(dados);
  },

  listar(filtros: { entidade?: string; acao?: string; idUsuario?: number; limite?: number } = {}) {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];
    if (filtros.entidade) {
      condicoes.push('l.entidade = ?');
      parametros.push(filtros.entidade);
    }
    if (filtros.acao) {
      condicoes.push('l.acao = ?');
      parametros.push(filtros.acao);
    }
    if (filtros.idUsuario) {
      condicoes.push('l.id_usuario = ?');
      parametros.push(filtros.idUsuario);
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    parametros.push(filtros.limite ?? 300);
    return banco
      .prepare(
        `SELECT l.*, m.nome_guerra, p.sigla AS sigla_posto
         FROM LOG_AUDITORIA l
         LEFT JOIN USUARIO u ON u.id_usuario = l.id_usuario
         LEFT JOIN MILITAR m ON m.id_militar = u.id_militar
         LEFT JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto
         ${onde}
         ORDER BY l.id_log DESC LIMIT ?`
      )
      .all(...parametros);
  },

  entidadesRegistradas(): string[] {
    const linhas = banco
      .prepare('SELECT DISTINCT entidade FROM LOG_AUDITORIA ORDER BY entidade')
      .all() as { entidade: string }[];
    return linhas.map((l) => l.entidade);
  }
};
