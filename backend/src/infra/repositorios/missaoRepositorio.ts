import { banco } from '../banco';
import type { Missao } from '../../nucleo/dominio/tipos';

export interface MissaoDetalhada extends Missao {
  nome_guerra: string;
  sigla_posto: string;
}

const SELECT_BASE = `
  SELECT ms.*, m.nome_guerra, p.sigla AS sigla_posto
  FROM MISSAO ms
  JOIN MILITAR m ON m.id_militar = ms.id_militar
  JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto`;

export const missaoRepositorio = {
  listar(filtros: { idMilitar?: number; a_partir_de?: string } = {}): MissaoDetalhada[] {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];
    if (filtros.idMilitar) {
      condicoes.push('ms.id_militar = ?');
      parametros.push(filtros.idMilitar);
    }
    if (filtros.a_partir_de) {
      condicoes.push('ms.data_fim >= ?');
      parametros.push(filtros.a_partir_de);
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    return banco
      .prepare(`${SELECT_BASE} ${onde} ORDER BY ms.data_inicio DESC`)
      .all(...parametros) as MissaoDetalhada[];
  },

  buscarPorId(id: number): Missao | null {
    return (banco.prepare('SELECT * FROM MISSAO WHERE id_missao = ?').get(id) as Missao) ?? null;
  },

  /** Impedimentos que cobrem qualquer data do período — base do bloqueio da RN15. */
  noPeriodo(inicio: string, fim: string): Missao[] {
    return banco
      .prepare('SELECT * FROM MISSAO WHERE data_inicio <= ? AND data_fim >= ? ORDER BY data_inicio')
      .all(fim, inicio) as Missao[];
  },

  impedimentoNaData(idMilitar: number, data: string): Missao | null {
    return (
      (banco
        .prepare('SELECT * FROM MISSAO WHERE id_militar = ? AND data_inicio <= ? AND data_fim >= ? LIMIT 1')
        .get(idMilitar, data, data) as Missao) ?? null
    );
  },

  existeSobreposicao(idMilitar: number, inicio: string, fim: string, idIgnorar?: number): boolean {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total FROM MISSAO
         WHERE id_militar = @militar
           AND (@ignorar IS NULL OR id_missao <> @ignorar)
           AND data_inicio <= @fim AND data_fim >= @inicio`
      )
      .get({ militar: idMilitar, ignorar: idIgnorar ?? null, inicio, fim }) as { total: number };
    return linha.total > 0;
  },

  inserir(dados: Omit<Missao, 'id_missao'>): number {
    const r = banco
      .prepare(
        `INSERT INTO MISSAO (id_militar, tipo, descricao, data_inicio, data_fim, id_usuario_registro, data_registro)
         VALUES (@id_militar, @tipo, @descricao, @data_inicio, @data_fim, @id_usuario_registro, @data_registro)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  atualizar(id: number, dados: Partial<Missao>): void {
    const campos = Object.keys(dados);
    if (!campos.length) return;
    banco
      .prepare(`UPDATE MISSAO SET ${campos.map((c) => `${c} = @${c}`).join(', ')} WHERE id_missao = @id`)
      .run({ ...dados, id });
  },

  excluir(id: number): void {
    banco.prepare('DELETE FROM MISSAO WHERE id_missao = ?').run(id);
  }
};
