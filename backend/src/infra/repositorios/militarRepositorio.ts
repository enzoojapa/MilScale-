import { banco } from '../banco';
import type { Curso, Militar, MilitarDetalhado } from '../../nucleo/dominio/tipos';

const SELECT_BASE = `
  SELECT m.*, p.sigla AS sigla_posto, p.descricao AS descricao_posto, p.nivel_hierarquico
  FROM MILITAR m
  JOIN POSTO_GRADUACAO p ON p.id_posto = m.id_posto`;

function anexarCursos(militares: Omit<MilitarDetalhado, 'cursos'>[]): MilitarDetalhado[] {
  if (militares.length === 0) return [];
  const marcadores = militares.map(() => '?').join(',');
  const vinculos = banco
    .prepare(
      `SELECT mc.id_militar, c.id_curso, c.nome, c.descricao
       FROM MILITAR_CURSO mc
       JOIN CURSO c ON c.id_curso = mc.id_curso
       WHERE mc.id_militar IN (${marcadores})`
    )
    .all(...militares.map((m) => m.id_militar)) as (Curso & { id_militar: number })[];

  const porMilitar = new Map<number, Curso[]>();
  for (const vinculo of vinculos) {
    const lista = porMilitar.get(vinculo.id_militar) ?? [];
    lista.push({ id_curso: vinculo.id_curso, nome: vinculo.nome, descricao: vinculo.descricao });
    porMilitar.set(vinculo.id_militar, lista);
  }
  return militares.map((m) => ({ ...m, cursos: porMilitar.get(m.id_militar) ?? [] }));
}

export const militarRepositorio = {
  listar(filtros: { idPosto?: number; idCurso?: number; situacao?: string; busca?: string } = {}) {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];
    if (filtros.idPosto) {
      condicoes.push('m.id_posto = ?');
      parametros.push(filtros.idPosto);
    }
    if (filtros.situacao) {
      condicoes.push('m.situacao = ?');
      parametros.push(filtros.situacao);
    }
    if (filtros.busca) {
      condicoes.push('(m.nome_completo LIKE ? OR m.nome_guerra LIKE ? OR m.cpf LIKE ?)');
      const termo = `%${filtros.busca}%`;
      parametros.push(termo, termo, termo);
    }
    if (filtros.idCurso) {
      condicoes.push('EXISTS (SELECT 1 FROM MILITAR_CURSO mc WHERE mc.id_militar = m.id_militar AND mc.id_curso = ?)');
      parametros.push(filtros.idCurso);
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const linhas = banco
      .prepare(`${SELECT_BASE} ${onde} ORDER BY p.nivel_hierarquico DESC, m.nome_guerra`)
      .all(...parametros) as Omit<MilitarDetalhado, 'cursos'>[];
    return anexarCursos(linhas);
  },

  buscarPorId(idMilitar: number): MilitarDetalhado | null {
    const linha = banco.prepare(`${SELECT_BASE} WHERE m.id_militar = ?`).get(idMilitar) as
      | Omit<MilitarDetalhado, 'cursos'>
      | undefined;
    return linha ? anexarCursos([linha])[0] : null;
  },

  buscarPorCpf(cpf: string): Militar | null {
    return (banco.prepare('SELECT * FROM MILITAR WHERE cpf = ?').get(cpf) as Militar) ?? null;
  },

  inserir(dados: Omit<Militar, 'id_militar'>): number {
    const resultado = banco
      .prepare(
        `INSERT INTO MILITAR
           (nome_completo, nome_guerra, cpf, id_posto, email, telefone,
            dias_sem_servico, data_fim_ultima_missao, situacao)
         VALUES (@nome_completo, @nome_guerra, @cpf, @id_posto, @email, @telefone,
                 @dias_sem_servico, @data_fim_ultima_missao, @situacao)`
      )
      .run(dados);
    return Number(resultado.lastInsertRowid);
  },

  atualizar(idMilitar: number, dados: Partial<Militar>): void {
    const campos = Object.keys(dados);
    if (campos.length === 0) return;
    const atribuicoes = campos.map((campo) => `${campo} = @${campo}`).join(', ');
    banco
      .prepare(`UPDATE MILITAR SET ${atribuicoes} WHERE id_militar = @id_militar`)
      .run({ ...dados, id_militar: idMilitar });
  },

  definirCursos(idMilitar: number, cursos: { id_curso: number; data_conclusao: string }[]): void {
    banco.prepare('DELETE FROM MILITAR_CURSO WHERE id_militar = ?').run(idMilitar);
    const inserir = banco.prepare(
      'INSERT INTO MILITAR_CURSO (id_militar, id_curso, data_conclusao) VALUES (?, ?, ?)'
    );
    for (const curso of cursos) {
      inserir.run(idMilitar, curso.id_curso, curso.data_conclusao);
    }
  },

  possuiServicoFuturo(idMilitar: number, aPartirDe: string): boolean {
    const linha = banco
      .prepare(
        `SELECT COUNT(*) AS total
         FROM SERVICO_ESCALADO se
         JOIN DIA_ESCALA d ON d.id_dia_escala = se.id_dia_escala
         WHERE se.id_militar = ? AND d.data >= ? AND se.situacao = 'PREVISTO'`
      )
      .get(idMilitar, aPartirDe) as { total: number };
    return linha.total > 0;
  },

  cursosDoMilitar(idMilitar: number): number[] {
    const linhas = banco
      .prepare('SELECT id_curso FROM MILITAR_CURSO WHERE id_militar = ?')
      .all(idMilitar) as { id_curso: number }[];
    return linhas.map((l) => l.id_curso);
  }
};
