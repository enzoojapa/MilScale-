import type {
  EtapaParecer,
  NomePerfil,
  ResultadoParecer,
  SituacaoSolicitacao,
  SolicitacaoTroca
} from '../dominio/tipos';

export interface EtapaAprovacao {
  ordem: number;
  etapa: EtapaParecer;
  /** Situação em que a solicitação fica aguardando esta etapa. */
  situacaoAguardando: SituacaoSolicitacao;
  perfilResponsavel: NomePerfil;
  rotulo: string;
  /** Decisões que o responsável desta etapa pode registrar. */
  decisoesPossiveis: DecisaoAvaliacao[];
}

export type DecisaoAvaliacao = 'APROVAR' | 'RECUSAR' | 'DEVOLVER';

export interface EntradaAvaliacao {
  solicitacao: SolicitacaoTroca;
  etapa: EtapaParecer;
  decisao: DecisaoAvaliacao;
  justificativa: string;
}

export interface ResultadoAvaliacao {
  novaSituacao: SituacaoSolicitacao;
  resultadoParecer: ResultadoParecer;
  /** Indica ao núcleo que esta decisão encerra o fluxo e a escala deve ser alterada (RN09). */
  aplicarTrocaNaEscala: boolean;
}

/**
 * Ponto de variação RF12 / RF12b.
 *
 * O núcleo (SolicitacaoTrocaService) registra o parecer e altera a escala sempre da mesma forma;
 * quantas etapas existem, qual perfil responde por cada uma e para qual situação a solicitação
 * caminha depois de cada decisão são decisões da estratégia injetada por configuração do produto.
 */
export interface EstrategiaAprovacaoTroca {
  readonly identificador: string;
  readonly descricao: string;
  /** Situação com que uma solicitação recém-registrada entra no fluxo. */
  situacaoInicial(): SituacaoSolicitacao;
  etapas(): EtapaAprovacao[];
  /** Etapa que responde pela solicitação na situação atual, ou null se o fluxo já se encerrou. */
  etapaCorrente(situacao: SituacaoSolicitacao): EtapaAprovacao | null;
  avaliar(entrada: EntradaAvaliacao): ResultadoAvaliacao;
}
