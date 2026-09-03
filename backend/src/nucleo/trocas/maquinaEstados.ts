import type { SituacaoSolicitacao } from '../dominio/tipos';

/**
 * Ativo reutilizável 4 – máquina de estados da solicitação de troca.
 *
 * As transições válidas são declaradas aqui uma única vez e servem aos dois produtos da LPS;
 * quem determina *quantas* etapas de avaliação existem entre o registro e a decisão final é a
 * EstrategiaAprovacaoTroca do produto, não esta tabela.
 */
export const transicoesPermitidas: Record<SituacaoSolicitacao, SituacaoSolicitacao[]> = {
  EM_ANALISE_CABO: ['AGUARDANDO_SARGENTEANTE', 'AUTORIZADA', 'NEGADA', 'CANCELADA'],
  AGUARDANDO_SARGENTEANTE: ['AUTORIZADA', 'NEGADA', 'EM_ANALISE_CABO'],
  AUTORIZADA: [],
  NEGADA: [],
  CANCELADA: []
};

export const situacoesEmAndamento: SituacaoSolicitacao[] = [
  'EM_ANALISE_CABO',
  'AGUARDANDO_SARGENTEANTE'
];

export function podeTransitar(de: SituacaoSolicitacao, para: SituacaoSolicitacao): boolean {
  return transicoesPermitidas[de].includes(para);
}

export function estaEmAndamento(situacao: SituacaoSolicitacao): boolean {
  return situacoesEmAndamento.includes(situacao);
}

export const rotuloSituacao: Record<SituacaoSolicitacao, string> = {
  EM_ANALISE_CABO: 'Em análise pelo cabo',
  AGUARDANDO_SARGENTEANTE: 'Aguardando autorização do sargenteante',
  AUTORIZADA: 'Autorizada',
  NEGADA: 'Negada',
  CANCELADA: 'Cancelada'
};
