import type {
  ContextoElegibilidade,
  RegraElegibilidade,
  ResultadoElegibilidade
} from '../../nucleo/elegibilidade/contrato';

/**
 * Variação RF06b (SmartScale). Existe para provar que o núcleo aceita outra regra sem alteração:
 * no domínio hospitalar não há hierarquia privativa, apenas a especialidade habilitante — o
 * posto/graduação deixa de ser condição e a qualificação passa a bastar.
 */
export class RegraElegibilidadePorEspecialidade implements RegraElegibilidade {
  readonly identificador = 'ESPECIALIDADE_PREFERENCIA';
  readonly descricao =
    'Elegibilidade por especialidade habilitante do profissional, sem hierarquia privativa de cargo.';

  avaliar(contexto: ContextoElegibilidade): ResultadoElegibilidade {
    const { tipoServico, cursosDoMilitar } = contexto;
    const especialidadesExigidas = [
      ...new Set(
        tipoServico.requisitos.filter((r) => r.id_curso !== null).map((r) => r.id_curso as number)
      )
    ];

    if (especialidadesExigidas.length === 0) {
      return { apto: true };
    }
    if (especialidadesExigidas.some((idCurso) => cursosDoMilitar.includes(idCurso))) {
      return { apto: true };
    }
    return { apto: false, motivo: 'Profissional sem a especialidade exigida para o turno.' };
  }
}
