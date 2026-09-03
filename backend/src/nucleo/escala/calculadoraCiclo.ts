import type { RegraEscala } from '../dominio/tipos';

export interface CicloCalculado {
  idTipoServico: number;
  nomeTipoServico: string;
  efetivoElegivel: number;
  efetivoDiarioExigido: number;
  /** Dias de folga entre dois serviços do mesmo militar, tal como o "N" da proporção NxM. */
  cicloCalculado: number;
  cicloAplicado: number;
  diasServico: number;
  proporcao: string;
  abaixoDoMinimo: boolean;
  acimaDoMaximo: boolean;
  alerta?: string;
}

/**
 * RN20 — o tamanho do ciclo não é cadastrado: é apurado a cada geração dividindo o efetivo
 * elegível e disponível pelo efetivo diário exigido pelo tipo de serviço. A regra cadastrada
 * define apenas os limites aceitáveis, usados aqui para alertar a sargenteação (UC05-E5).
 *
 * Exemplo do detalhamento: 30 militares elegíveis para uma vaga diária resultam em ciclo 29x1.
 */
export function calcularCiclo(parametros: {
  idTipoServico: number;
  nomeTipoServico: string;
  efetivoElegivel: number;
  efetivoDiarioExigido: number;
  regra: RegraEscala;
}): CicloCalculado {
  const { efetivoElegivel, efetivoDiarioExigido, regra } = parametros;
  const diasServico = regra.dias_servico > 0 ? regra.dias_servico : 1;

  const rodadas = Math.floor(efetivoElegivel / Math.max(efetivoDiarioExigido, 1));
  const cicloCalculado = Math.max(rodadas - diasServico, 0);

  const limiteMaximo = regra.ciclo_maximo ?? cicloCalculado;
  const cicloAplicado = Math.min(Math.max(cicloCalculado, 0), limiteMaximo);

  const abaixoDoMinimo = cicloCalculado < regra.ciclo_minimo;
  const acimaDoMaximo = cicloCalculado > limiteMaximo;

  let alerta: string | undefined;
  if (abaixoDoMinimo) {
    alerta =
      `Ciclo apurado ${cicloCalculado}x${diasServico} é inferior ao mínimo ${regra.ciclo_minimo}x${diasServico} ` +
      `da regra vigente: o efetivo disponível (${efetivoElegivel}) não sustenta o intervalo desejado.`;
  } else if (acimaDoMaximo) {
    alerta =
      `Ciclo apurado ${cicloCalculado}x${diasServico} excede o máximo ${limiteMaximo}x${diasServico}; ` +
      `a escalação usará ${cicloAplicado}x${diasServico}.`;
  }

  return {
    idTipoServico: parametros.idTipoServico,
    nomeTipoServico: parametros.nomeTipoServico,
    efetivoElegivel,
    efetivoDiarioExigido,
    cicloCalculado,
    cicloAplicado,
    diasServico,
    proporcao: `${cicloAplicado}x${diasServico}`,
    abaixoDoMinimo,
    acimaDoMaximo,
    alerta
  };
}
