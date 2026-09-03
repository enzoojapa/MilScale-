import { banco } from '../banco';
import type { RegraEscala } from '../../nucleo/dominio/tipos';

export const regraEscalaRepositorio = {
  listar(): (RegraEscala & { nome_tipo_servico: string })[] {
    return banco
      .prepare(
        `SELECT r.*, t.nome AS nome_tipo_servico
         FROM REGRA_ESCALA r
         JOIN TIPO_SERVICO t ON t.id_tipo_servico = r.id_tipo_servico
         ORDER BY t.nome, r.vigencia_inicio DESC`
      )
      .all() as (RegraEscala & { nome_tipo_servico: string })[];
  },

  buscarPorId(id: number): RegraEscala | null {
    return (banco.prepare('SELECT * FROM REGRA_ESCALA WHERE id_regra = ?').get(id) as RegraEscala) ?? null;
  },

  /** Regra vigente para o tipo de serviço em uma data (vigencia_fim nula = vigente). */
  vigenteEm(idTipoServico: number, data: string): RegraEscala | null {
    return (
      (banco
        .prepare(
          `SELECT * FROM REGRA_ESCALA
           WHERE id_tipo_servico = ?
             AND vigencia_inicio <= ?
             AND (vigencia_fim IS NULL OR vigencia_fim >= ?)
           ORDER BY vigencia_inicio DESC LIMIT 1`
        )
        .get(idTipoServico, data, data) as RegraEscala) ?? null
    );
  },

  /** UC04-E1: recusa gravação quando há sobreposição de vigência no mesmo tipo de serviço. */
  existeSobreposicao(
    idTipoServico: number,
    inicio: string,
    fim: string | null,
    idIgnorar?: number
  ): boolean {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total FROM REGRA_ESCALA
         WHERE id_tipo_servico = ?
           AND (@ignorar IS NULL OR id_regra <> @ignorar)
           AND vigencia_inicio <= COALESCE(@fim, '9999-12-31')
           AND COALESCE(vigencia_fim, '9999-12-31') >= @inicio`
      )
      .get(idTipoServico, { ignorar: idIgnorar ?? null, inicio, fim }) as { total: number };
    return linha.total > 0;
  },

  inserir(dados: Omit<RegraEscala, 'id_regra'>): number {
    const r = banco
      .prepare(
        `INSERT INTO REGRA_ESCALA
           (id_tipo_servico, ciclo_minimo, ciclo_maximo, dias_servico, intervalo_minimo,
            max_servicos_mes, vigencia_inicio, vigencia_fim, id_usuario_criacao)
         VALUES (@id_tipo_servico, @ciclo_minimo, @ciclo_maximo, @dias_servico, @intervalo_minimo,
                 @max_servicos_mes, @vigencia_inicio, @vigencia_fim, @id_usuario_criacao)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  atualizar(id: number, dados: Partial<RegraEscala>): void {
    const campos = Object.keys(dados);
    if (!campos.length) return;
    banco
      .prepare(`UPDATE REGRA_ESCALA SET ${campos.map((c) => `${c} = @${c}`).join(', ')} WHERE id_regra = @id`)
      .run({ ...dados, id });
  }
};
