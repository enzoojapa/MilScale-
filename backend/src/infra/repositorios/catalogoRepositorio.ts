import { banco } from '../banco';
import type { Curso, PostoGraduacao, RequisitoServico, TipoServico } from '../../nucleo/dominio/tipos';

export const postoRepositorio = {
  listar(): PostoGraduacao[] {
    return banco
      .prepare('SELECT * FROM POSTO_GRADUACAO ORDER BY nivel_hierarquico')
      .all() as PostoGraduacao[];
  },
  buscarPorId(id: number): PostoGraduacao | null {
    return (banco.prepare('SELECT * FROM POSTO_GRADUACAO WHERE id_posto = ?').get(id) as PostoGraduacao) ?? null;
  }
};

export const cursoRepositorio = {
  listar(): Curso[] {
    return banco.prepare('SELECT * FROM CURSO ORDER BY nome').all() as Curso[];
  },
  inserir(nome: string, descricao: string | null): number {
    const r = banco.prepare('INSERT INTO CURSO (nome, descricao) VALUES (?, ?)').run(nome, descricao);
    return Number(r.lastInsertRowid);
  },
  atualizar(id: number, nome: string, descricao: string | null): void {
    banco.prepare('UPDATE CURSO SET nome = ?, descricao = ? WHERE id_curso = ?').run(nome, descricao, id);
  },
  excluir(id: number): void {
    banco.prepare('DELETE FROM CURSO WHERE id_curso = ?').run(id);
  },
  estaEmUso(id: number): boolean {
    const linha = banco
      .prepare(
        `SELECT (SELECT COUNT(*) FROM MILITAR_CURSO WHERE id_curso = ?)
              + (SELECT COUNT(*) FROM REQUISITO_SERVICO WHERE id_curso = ?) AS total`
      )
      .get(id, id) as { total: number };
    return linha.total > 0;
  }
};

export interface TipoServicoDetalhado extends TipoServico {
  requisitos: (RequisitoServico & { sigla_posto: string; nome_curso: string | null })[];
}

export const tipoServicoRepositorio = {
  listar(apenasAtivos = false): TipoServicoDetalhado[] {
    const tipos = banco
      .prepare(
        `SELECT * FROM TIPO_SERVICO ${apenasAtivos ? 'WHERE ativo = 1' : ''} ORDER BY nome`
      )
      .all() as TipoServico[];
    return tipos.map((tipo) => ({ ...tipo, requisitos: this.requisitosDe(tipo.id_tipo_servico) }));
  },

  buscarPorId(id: number): TipoServicoDetalhado | null {
    const tipo = banco.prepare('SELECT * FROM TIPO_SERVICO WHERE id_tipo_servico = ?').get(id) as
      | TipoServico
      | undefined;
    return tipo ? { ...tipo, requisitos: this.requisitosDe(id) } : null;
  },

  requisitosDe(idTipoServico: number) {
    return banco
      .prepare(
        `SELECT r.*, p.sigla AS sigla_posto, c.nome AS nome_curso
         FROM REQUISITO_SERVICO r
         JOIN POSTO_GRADUACAO p ON p.id_posto = r.id_posto
         LEFT JOIN CURSO c ON c.id_curso = r.id_curso
         WHERE r.id_tipo_servico = ?`
      )
      .all(idTipoServico) as (RequisitoServico & { sigla_posto: string; nome_curso: string | null })[];
  },

  inserir(dados: Omit<TipoServico, 'id_tipo_servico'>): number {
    const r = banco
      .prepare(
        `INSERT INTO TIPO_SERVICO (nome, descricao, efetivo_necessario, hora_inicio, duracao_horas, exige_pernoite, ativo)
         VALUES (@nome, @descricao, @efetivo_necessario, @hora_inicio, @duracao_horas, @exige_pernoite, @ativo)`
      )
      .run(dados);
    return Number(r.lastInsertRowid);
  },

  atualizar(id: number, dados: Partial<TipoServico>): void {
    const campos = Object.keys(dados);
    if (!campos.length) return;
    banco
      .prepare(
        `UPDATE TIPO_SERVICO SET ${campos.map((c) => `${c} = @${c}`).join(', ')} WHERE id_tipo_servico = @id`
      )
      .run({ ...dados, id });
  },

  definirRequisitos(
    idTipoServico: number,
    requisitos: { id_posto: number; id_curso: number | null; obrigatorio: number }[]
  ): void {
    banco.prepare('DELETE FROM REQUISITO_SERVICO WHERE id_tipo_servico = ?').run(idTipoServico);
    const inserir = banco.prepare(
      'INSERT INTO REQUISITO_SERVICO (id_tipo_servico, id_posto, id_curso, obrigatorio) VALUES (?, ?, ?, ?)'
    );
    for (const requisito of requisitos) {
      inserir.run(idTipoServico, requisito.id_posto, requisito.id_curso, requisito.obrigatorio);
    }
  },

  usadoEmEscalaPublicada(idTipoServico: number): boolean {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total
         FROM SERVICO_ESCALADO se
         JOIN DIA_ESCALA d ON d.id_dia_escala = se.id_dia_escala
         JOIN ESCALA e ON e.id_escala = d.id_escala
         WHERE se.id_tipo_servico = ? AND e.situacao = 'PUBLICADA'`
      )
      .get(idTipoServico) as { total: number };
    return linha.total > 0;
  }
};
