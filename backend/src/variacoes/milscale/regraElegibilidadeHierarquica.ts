import type {
  ContextoElegibilidade,
  RegraElegibilidade,
  ResultadoElegibilidade
} from '../../nucleo/elegibilidade/contrato';

/**
 * Variação RF06 (MilScale): o serviço é privativo de um posto/graduação (RN02) e pode exigir
 * curso específico (RN03). A combinação posto + curso vem da Tabela 1 do detalhamento e está
 * armazenada como dado em REQUISITO_SERVICO — a regra apenas interpreta esses requisitos.
 */
export class RegraElegibilidadeHierarquica implements RegraElegibilidade {
  readonly identificador = 'HIERARQUIA_MILITAR';
  readonly descricao =
    'Elegibilidade por posto/graduação privativo do serviço e cursos exigidos (CFC, Motorista, Rancho).';

  avaliar(contexto: ContextoElegibilidade): ResultadoElegibilidade {
    const { militar, tipoServico, cursosDoMilitar } = contexto;

    if (!militar.id_posto) {
      return { apto: false, motivo: 'Militar sem posto/graduação cadastrado.' };
    }

    const requisitos = tipoServico.requisitos;
    if (requisitos.length === 0) {
      // UC15-E2: sem requisitos definidos, o serviço não é privativo de nenhum posto.
      return { apto: true };
    }

    const doSeuPosto = requisitos.filter((r) => r.id_posto === militar.id_posto);
    if (doSeuPosto.length === 0) {
      const postosHabilitados = [...new Set(requisitos.map((r) => r.sigla_posto))].join(', ');
      return {
        apto: false,
        motivo: `Serviço privativo de ${postosHabilitados}; o militar é ${militar.sigla_posto}.`
      };
    }

    const cursosPendentes = doSeuPosto
      .filter((r) => r.id_curso !== null && r.obrigatorio === 1 && !cursosDoMilitar.includes(r.id_curso))
      .map((r) => r.nome_curso);

    if (cursosPendentes.length > 0) {
      return { apto: false, motivo: `Curso exigido não concluído: ${cursosPendentes.join(', ')}.` };
    }

    return { apto: true };
  }
}
