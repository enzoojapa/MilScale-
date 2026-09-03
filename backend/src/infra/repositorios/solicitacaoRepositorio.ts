import { banco } from '../banco';
import type { ParecerSolicitacao, SolicitacaoTroca } from '../../nucleo/dominio/tipos';

export interface SolicitacaoDetalhada extends SolicitacaoTroca {
  data_servico: string;
  trancado: number;
  nome_tipo_servico: string;
  hora_inicio: string;
  posicao: string | null;
  id_dia_escala: number;
  id_tipo_servico: number;
  solicitante_nome_guerra: string;
  solicitante_posto: string;
  substituto_nome_guerra: string | null;
  substituto_posto: string | null;
}

const SELECT_BASE = `
  SELECT s.*, d.data AS data_servico, d.trancado, d.id_dia_escala,
         t.nome AS nome_tipo_servico, t.hora_inicio, se.posicao, se.id_tipo_servico,
         sol.nome_guerra AS solicitante_nome_guerra, ps.sigla AS solicitante_posto,
         sub.nome_guerra AS substituto_nome_guerra, pb.sigla AS substituto_posto
  FROM SOLICITACAO_TROCA s
  JOIN SERVICO_ESCALADO se ON se.id_servico_escalado = s.id_servico_escalado
  JOIN DIA_ESCALA d        ON d.id_dia_escala = se.id_dia_escala
  JOIN TIPO_SERVICO t      ON t.id_tipo_servico = se.id_tipo_servico
  JOIN MILITAR sol         ON sol.id_militar = s.id_militar_solicitante
  JOIN POSTO_GRADUACAO ps  ON ps.id_posto = sol.id_posto
  LEFT JOIN MILITAR sub    ON sub.id_militar = s.id_militar_substituto
  LEFT JOIN POSTO_GRADUACAO pb ON pb.id_posto = sub.id_posto`;

export const solicitacaoRepositorio = {
  listar(filtros: { situacao?: string; idSolicitante?: number; inicio?: string; fim?: string } = {}) {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];
    if (filtros.situacao) {
      condicoes.push('s.situacao = ?');
      parametros.push(filtros.situacao);
    }
    if (filtros.idSolicitante) {
      condicoes.push('s.id_militar_solicitante = ?');
      parametros.push(filtros.idSolicitante);
    }
    if (filtros.inicio && filtros.fim) {
      condicoes.push('d.data BETWEEN ? AND ?');
      parametros.push(filtros.inicio, filtros.fim);
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    return banco
      .prepare(`${SELECT_BASE} ${onde} ORDER BY d.data, s.data_solicitacao`)
      .all(...parametros) as SolicitacaoDetalhada[];
  },

  buscarPorId(id: number): SolicitacaoDetalhada | null {
    return (
      (banco.prepare(`${SELECT_BASE} WHERE s.id_solicitacao = ?`).get(id) as SolicitacaoDetalhada) ?? null
    );
  },

  /** UC10-E4: só existe uma solicitação em andamento por serviço escalado. */
  pendentePara(idServicoEscalado: number): SolicitacaoTroca | null {
    return (
      (banco
        .prepare(
          `SELECT * FROM SOLICITACAO_TROCA
           WHERE id_servico_escalado = ?
             AND situacao IN ('EM_ANALISE_CABO','AGUARDANDO_SARGENTEANTE')
           LIMIT 1`
        )
        .get(idServicoEscalado) as SolicitacaoTroca) ?? null
    );
  },

  pendentesNoDia(idDiaEscala: number): SolicitacaoDetalhada[] {
    return banco
      .prepare(
        `${SELECT_BASE} WHERE se.id_dia_escala = ? AND s.situacao IN ('EM_ANALISE_CABO','AGUARDANDO_SARGENTEANTE')`
      )
      .all(idDiaEscala) as SolicitacaoDetalhada[];
  },

  inserir(dados: Omit<SolicitacaoTroca, 'id_solicitacao'>): number {
    const r = banco
      .prepare(
        `INSERT INTO SOLICITACAO_TROCA
           (id_servico_escalado, id_militar_solicitante, id_militar_substituto, motivo, data_solicitacao, situacao)
         VALUES (@id_servico_escalado, @id_militar_solicitante, @id_militar_substituto, @motivo,
                 @data_solicitacao, @situacao)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  atualizar(id: number, dados: Partial<SolicitacaoTroca>): void {
    const campos = Object.keys(dados);
    if (!campos.length) return;
    banco
      .prepare(
        `UPDATE SOLICITACAO_TROCA SET ${campos.map((c) => `${c} = @${c}`).join(', ')} WHERE id_solicitacao = @id`
      )
      .run({ ...dados, id });
  },

  inserirParecer(dados: Omit<ParecerSolicitacao, 'id_parecer'>): number {
    const r = banco
      .prepare(
        `INSERT INTO PARECER_SOLICITACAO
           (id_solicitacao, id_usuario_avaliador, etapa, resultado, justificativa, data_parecer)
         VALUES (@id_solicitacao, @id_usuario_avaliador, @etapa, @resultado, @justificativa, @data_parecer)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  pareceresDe(idSolicitacao: number) {
    return banco
      .prepare(
        `SELECT pa.*, m.nome_guerra AS avaliador_nome_guerra, p.sigla AS avaliador_posto,
                pf.nome AS avaliador_perfil
         FROM PARECER_SOLICITACAO pa
         JOIN USUARIO u ON u.id_usuario = pa.id_usuario_avaliador
         JOIN MILITAR m ON m.id_militar = u.id_militar
         JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto
         JOIN PERFIL_ACESSO pf ON pf.id_perfil = u.id_perfil
         WHERE pa.id_solicitacao = ?
         ORDER BY pa.data_parecer`
      )
      .all(idSolicitacao) as (ParecerSolicitacao & {
      avaliador_nome_guerra: string;
      avaliador_posto: string;
      avaliador_perfil: string;
    })[];
  }
};
