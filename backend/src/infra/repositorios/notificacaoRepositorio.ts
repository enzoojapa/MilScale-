import { banco } from '../banco';
import type { CanalNotificacao, TipoNotificacao } from '../../nucleo/dominio/tipos';

export const notificacaoRepositorio = {
  inserir(dados: {
    id_militar: number;
    tipo: TipoNotificacao;
    titulo: string;
    mensagem: string;
    canal: CanalNotificacao;
    data_envio: string;
    situacao_envio: 'ENVIADA' | 'FALHA' | 'LIDA';
  }): number {
    const r = banco
      .prepare(
        `INSERT INTO NOTIFICACAO (id_militar, tipo, titulo, mensagem, canal, data_envio, situacao_envio)
         VALUES (@id_militar, @tipo, @titulo, @mensagem, @canal, @data_envio, @situacao_envio)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  listar(filtros: { idMilitar?: number; tipo?: string; limite?: number } = {}) {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];
    if (filtros.idMilitar) {
      condicoes.push('n.id_militar = ?');
      parametros.push(filtros.idMilitar);
    }
    if (filtros.tipo) {
      condicoes.push('n.tipo = ?');
      parametros.push(filtros.tipo);
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    parametros.push(filtros.limite ?? 200);
    return banco
      .prepare(
        `SELECT n.*, m.nome_guerra, p.sigla AS sigla_posto
         FROM NOTIFICACAO n
         JOIN MILITAR m ON m.id_militar = n.id_militar
         JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto
         ${onde}
         ORDER BY n.id_notificacao DESC LIMIT ?`
      )
      .all(...parametros);
  },

  jaNotificado(idMilitar: number, tipo: TipoNotificacao, referencia: string): boolean {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total FROM NOTIFICACAO
         WHERE id_militar = ? AND tipo = ? AND mensagem LIKE ? AND situacao_envio <> 'FALHA'`
      )
      .get(idMilitar, tipo, `%${referencia}%`) as { total: number };
    return linha.total > 0;
  },

  marcarComoLida(idNotificacao: number, idMilitar: number): void {
    banco
      .prepare("UPDATE NOTIFICACAO SET situacao_envio = 'LIDA' WHERE id_notificacao = ? AND id_militar = ?")
      .run(idNotificacao, idMilitar);
  },

  naoLidasDe(idMilitar: number): number {
    const linha = banco
      .prepare("SELECT COUNT(*) AS total FROM NOTIFICACAO WHERE id_militar = ? AND situacao_envio = 'ENVIADA'")
      .get(idMilitar) as { total: number };
    return linha.total;
  }
};
