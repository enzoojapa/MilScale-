import { banco } from '../banco';
import type { DiaEscala, Escala, ServicoEscalado } from '../../nucleo/dominio/tipos';

export interface ServicoEscaladoDetalhado extends ServicoEscalado {
  data: string;
  trancado: number;
  motivo_trancamento: string | null;
  id_escala: number;
  situacao_escala: string;
  nome_tipo_servico: string;
  hora_inicio: string;
  duracao_horas: number;
  nome_guerra: string | null;
  nome_completo: string | null;
  sigla_posto: string | null;
}

const SELECT_SERVICO = `
  SELECT se.*, d.data, d.trancado, d.motivo_trancamento, d.id_escala,
         e.situacao AS situacao_escala,
         t.nome AS nome_tipo_servico, t.hora_inicio, t.duracao_horas,
         m.nome_guerra, m.nome_completo, p.sigla AS sigla_posto
  FROM SERVICO_ESCALADO se
  JOIN DIA_ESCALA d      ON d.id_dia_escala = se.id_dia_escala
  JOIN ESCALA e          ON e.id_escala = d.id_escala
  JOIN TIPO_SERVICO t    ON t.id_tipo_servico = se.id_tipo_servico
  LEFT JOIN MILITAR m    ON m.id_militar = se.id_militar
  LEFT JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto`;

export const escalaRepositorio = {
  listar(): Escala[] {
    return banco.prepare('SELECT * FROM ESCALA ORDER BY data_inicio DESC').all() as Escala[];
  },

  buscarPorId(id: number): Escala | null {
    return (banco.prepare('SELECT * FROM ESCALA WHERE id_escala = ?').get(id) as Escala) ?? null;
  },

  /** UC05-E2: bloqueia nova geração quando já existe escala publicada sobrepondo o período. */
  publicadaNoPeriodo(inicio: string, fim: string): Escala | null {
    return (
      (banco
        .prepare(
          `SELECT * FROM ESCALA
           WHERE situacao IN ('PUBLICADA','ENCERRADA') AND data_inicio <= ? AND data_fim >= ?
           LIMIT 1`
        )
        .get(fim, inicio) as Escala) ?? null
    );
  },

  rascunhoNoPeriodo(inicio: string, fim: string): Escala | null {
    return (
      (banco
        .prepare(
          `SELECT * FROM ESCALA WHERE situacao = 'RASCUNHO' AND data_inicio <= ? AND data_fim >= ? LIMIT 1`
        )
        .get(fim, inicio) as Escala) ?? null
    );
  },

  inserir(dados: Omit<Escala, 'id_escala'>): number {
    const r = banco
      .prepare(
        `INSERT INTO ESCALA (descricao, data_inicio, data_fim, situacao, data_geracao, id_usuario_geracao)
         VALUES (@descricao, @data_inicio, @data_fim, @situacao, @data_geracao, @id_usuario_geracao)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  alterarSituacao(idEscala: number, situacao: Escala['situacao']): void {
    banco.prepare('UPDATE ESCALA SET situacao = ? WHERE id_escala = ?').run(situacao, idEscala);
  },

  excluir(idEscala: number): void {
    banco.prepare('DELETE FROM ESCALA WHERE id_escala = ?').run(idEscala);
  },

  inserirDia(idEscala: number, data: string): number {
    const r = banco.prepare('INSERT INTO DIA_ESCALA (id_escala, data) VALUES (?, ?)').run(idEscala, data);
    return Number(r.lastInsertRowid);
  },

  diasDaEscala(idEscala: number): DiaEscala[] {
    return banco
      .prepare('SELECT * FROM DIA_ESCALA WHERE id_escala = ? ORDER BY data')
      .all(idEscala) as DiaEscala[];
  },

  buscarDia(idDiaEscala: number): DiaEscala | null {
    return (banco.prepare('SELECT * FROM DIA_ESCALA WHERE id_dia_escala = ?').get(idDiaEscala) as DiaEscala) ?? null;
  },

  buscarDiaPorData(data: string): (DiaEscala & { situacao_escala: string }) | null {
    return (
      (banco
        .prepare(
          `SELECT d.*, e.situacao AS situacao_escala
           FROM DIA_ESCALA d JOIN ESCALA e ON e.id_escala = d.id_escala
           WHERE d.data = ?
           ORDER BY CASE e.situacao WHEN 'PUBLICADA' THEN 0 WHEN 'ENCERRADA' THEN 1 ELSE 2 END
           LIMIT 1`
        )
        .get(data) as DiaEscala & { situacao_escala: string }) ?? null
    );
  },

  atualizarTrancamento(
    idDiaEscala: number,
    trancado: number,
    motivo: string | null,
    idUsuario: number | null,
    dataHora: string | null
  ): void {
    banco
      .prepare(
        `UPDATE DIA_ESCALA
         SET trancado = ?, motivo_trancamento = ?, id_usuario_trancamento = ?, data_trancamento = ?
         WHERE id_dia_escala = ?`
      )
      .run(trancado, motivo, idUsuario, dataHora, idDiaEscala);
  },

  inserirServico(dados: Omit<ServicoEscalado, 'id_servico_escalado'>): number {
    const r = banco
      .prepare(
        `INSERT INTO SERVICO_ESCALADO (id_dia_escala, id_tipo_servico, id_militar, posicao, situacao, observacao)
         VALUES (@id_dia_escala, @id_tipo_servico, @id_militar, @posicao, @situacao, @observacao)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  buscarServico(id: number): ServicoEscaladoDetalhado | null {
    return (
      (banco.prepare(`${SELECT_SERVICO} WHERE se.id_servico_escalado = ?`).get(id) as ServicoEscaladoDetalhado) ??
      null
    );
  },

  servicosPorPeriodo(filtros: {
    inicio: string;
    fim: string;
    idTipoServico?: number;
    idMilitar?: number;
    incluirRascunho?: boolean;
  }): ServicoEscaladoDetalhado[] {
    const condicoes = ['d.data BETWEEN ? AND ?'];
    const parametros: unknown[] = [filtros.inicio, filtros.fim];
    if (!filtros.incluirRascunho) {
      condicoes.push("e.situacao IN ('PUBLICADA','ENCERRADA')");
    }
    if (filtros.idTipoServico) {
      condicoes.push('se.id_tipo_servico = ?');
      parametros.push(filtros.idTipoServico);
    }
    if (filtros.idMilitar) {
      condicoes.push('se.id_militar = ?');
      parametros.push(filtros.idMilitar);
    }
    return banco
      .prepare(
        `${SELECT_SERVICO} WHERE ${condicoes.join(' AND ')} ORDER BY d.data, t.nome, se.posicao`
      )
      .all(...parametros) as ServicoEscaladoDetalhado[];
  },

  servicosDaEscala(idEscala: number): ServicoEscaladoDetalhado[] {
    return banco
      .prepare(`${SELECT_SERVICO} WHERE d.id_escala = ? ORDER BY d.data, t.nome, se.posicao`)
      .all(idEscala) as ServicoEscaladoDetalhado[];
  },

  atualizarServico(id: number, dados: Partial<ServicoEscalado>): void {
    const campos = Object.keys(dados);
    if (!campos.length) return;
    banco
      .prepare(
        `UPDATE SERVICO_ESCALADO SET ${campos.map((c) => `${c} = @${c}`).join(', ')} WHERE id_servico_escalado = @id`
      )
      .run({ ...dados, id });
  },

  militarEscaladoNoDia(idDiaEscala: number, idMilitar: number): boolean {
    const linha = banco
      .prepare('SELECT COUNT(*) AS total FROM SERVICO_ESCALADO WHERE id_dia_escala = ? AND id_militar = ?')
      .get(idDiaEscala, idMilitar) as { total: number };
    return linha.total > 0;
  },

  /** Data do último serviço do militar antes de uma data de referência (RN06). */
  dataUltimoServicoAntesDe(idMilitar: number, data: string): string | null {
    const linha = banco
      .prepare(
        `SELECT MAX(d.data) AS ultima
         FROM SERVICO_ESCALADO se
         JOIN DIA_ESCALA d ON d.id_dia_escala = se.id_dia_escala
         WHERE se.id_militar = ? AND d.data < ? AND se.situacao <> 'SUBSTITUIDO'`
      )
      .get(idMilitar, data) as { ultima: string | null };
    return linha.ultima;
  },

  quantidadeServicosNoMes(idMilitar: number, anoMes: string): number {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total
         FROM SERVICO_ESCALADO se
         JOIN DIA_ESCALA d ON d.id_dia_escala = se.id_dia_escala
         WHERE se.id_militar = ? AND substr(d.data, 1, 7) = ? AND se.situacao <> 'SUBSTITUIDO'`
      )
      .get(idMilitar, anoMes) as { total: number };
    return linha.total;
  },

  historicoDoMilitar(idMilitar: number, inicio: string, fim: string): ServicoEscaladoDetalhado[] {
    return banco
      .prepare(
        `${SELECT_SERVICO} WHERE se.id_militar = ? AND d.data BETWEEN ? AND ? ORDER BY d.data DESC`
      )
      .all(idMilitar, inicio, fim) as ServicoEscaladoDetalhado[];
  }
};
