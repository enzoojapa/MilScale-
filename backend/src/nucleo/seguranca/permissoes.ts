import type { NomePerfil } from '../dominio/tipos';

/** Catálogo de permissões atômicas (tabela PERMISSAO) usado pelo RBAC e pelo seed. */
export const permissoes = {
  ESCALA_CONSULTAR_PROPRIA: 'Consultar a própria escala',
  SOLICITACAO_REGISTRAR: 'Registrar solicitação de troca',
  SOLICITACAO_CONSULTAR_PROPRIA: 'Acompanhar as próprias solicitações',
  ESCALA_CONSULTAR_COMPLETA: 'Consultar a escala completa de um dia ou período',
  SOLICITACAO_CONSULTAR_TODAS: 'Acompanhar todas as solicitações de troca',
  HISTORICO_CONSULTAR: 'Consultar o histórico de serviços',
  ESCALA_EXPORTAR: 'Exportar a escala publicada',
  ESCALA_GERAR: 'Gerar a escala do período',
  ESCALA_PUBLICAR: 'Publicar a escala do período',
  SOLICITACAO_TRIAR: 'Emitir parecer de viabilidade (triagem)',
  MILITAR_MANTER: 'Manter o cadastro de militares e cursos',
  TIPO_SERVICO_MANTER: 'Manter os tipos de serviço e requisitos',
  REGRA_MANTER: 'Manter as regras da escala',
  MISSAO_MANTER: 'Manter missões e impedimentos',
  ESCALA_ALTERAR: 'Alterar manualmente a escala',
  DIA_TRANCAR: 'Trancar e destrancar dias da escala',
  SOLICITACAO_AUTORIZAR: 'Autorizar ou negar solicitações de troca',
  AUDITORIA_CONSULTAR: 'Consultar a trilha de auditoria',
  NOTIFICACAO_DISPARAR: 'Disparar a rotina de notificação D-1'
} as const;

export type CodigoPermissao = keyof typeof permissoes;

/**
 * Generalização hierárquica dos atores (seção 2 do detalhamento): cada perfil acrescenta
 * permissões às do perfil anterior, em vez de repetir a lista inteira.
 */
const acrescimosPorPerfil: Record<NomePerfil, CodigoPermissao[]> = {
  MILITAR_ESCALADO: [
    'ESCALA_CONSULTAR_PROPRIA',
    'SOLICITACAO_REGISTRAR',
    'SOLICITACAO_CONSULTAR_PROPRIA'
  ],
  SD_EP_SARGENTEACAO: [
    'ESCALA_CONSULTAR_COMPLETA',
    'SOLICITACAO_CONSULTAR_TODAS',
    'HISTORICO_CONSULTAR',
    'ESCALA_EXPORTAR'
  ],
  CABO_SARGENTEACAO: ['ESCALA_GERAR', 'ESCALA_PUBLICAR', 'SOLICITACAO_TRIAR'],
  SARGENTEANTE: [
    'MILITAR_MANTER',
    'TIPO_SERVICO_MANTER',
    'REGRA_MANTER',
    'MISSAO_MANTER',
    'ESCALA_ALTERAR',
    'DIA_TRANCAR',
    'SOLICITACAO_AUTORIZAR',
    'AUDITORIA_CONSULTAR',
    'NOTIFICACAO_DISPARAR'
  ]
};

export const ordemDosPerfis: NomePerfil[] = [
  'MILITAR_ESCALADO',
  'SD_EP_SARGENTEACAO',
  'CABO_SARGENTEACAO',
  'SARGENTEANTE'
];

export function permissoesDoPerfil(perfil: NomePerfil): CodigoPermissao[] {
  const ate = ordemDosPerfis.indexOf(perfil);
  return ordemDosPerfis.slice(0, ate + 1).flatMap((nivel) => acrescimosPorPerfil[nivel]);
}

export const descricaoDosPerfis: Record<NomePerfil, string> = {
  MILITAR_ESCALADO: 'Militar que compõe a escala de serviço.',
  SD_EP_SARGENTEACAO: 'Auxiliar da sargenteação, sem poder de decisão.',
  CABO_SARGENTEACAO: 'Gera a escala e faz a triagem de viabilidade das trocas.',
  SARGENTEANTE: 'Responsável final pela escala, pelos cadastros e pelas autorizações.'
};
