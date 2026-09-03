/**
 * Ponto de configuração da linha de produto "Escalas".
 *
 * O núcleo do sistema é comum aos dois produtos da LPS (MilScale e SmartScale). Cada produto é
 * descrito aqui apenas por quais implementações dos pontos de variação ele carrega; nenhum código
 * de negócio consulta `PRODUTO` diretamente — quem resolve isso é o registro de plugins
 * (`src/variacoes/registro.ts`), que é o único lugar do sistema que conhece os dois catálogos.
 */
export type CodigoProduto = 'MILSCALE' | 'SMARTSCALE';

export interface ConfiguracaoProduto {
  codigo: CodigoProduto;
  nomeExibicao: string;
  /** Identificador da implementação de RegraElegibilidade a ser injetada (RF06 / RF06b). */
  estrategiaElegibilidade: 'HIERARQUIA_MILITAR' | 'ESPECIALIDADE_PREFERENCIA';
  /** Identificador da implementação de EstrategiaAprovacaoTroca a ser injetada (RF12 / RF12b). */
  estrategiaAprovacaoTroca: 'CADEIA_DUAS_ETAPAS' | 'ETAPA_UNICA';
  /** Rótulos de tela parametrizados por produto (UI Kit comum da LPS). */
  rotulos: {
    profissional: string;
    profissionalPlural: string;
    tipoTurno: string;
    turno: string;
    unidade: string;
  };
}

const catalogo: Record<CodigoProduto, ConfiguracaoProduto> = {
  MILSCALE: {
    codigo: 'MILSCALE',
    nomeExibicao: 'MilScale',
    estrategiaElegibilidade: 'HIERARQUIA_MILITAR',
    estrategiaAprovacaoTroca: 'CADEIA_DUAS_ETAPAS',
    rotulos: {
      profissional: 'Militar',
      profissionalPlural: 'Militares',
      tipoTurno: 'Tipo de serviço',
      turno: 'Serviço',
      unidade: 'Batalhão'
    }
  },
  SMARTSCALE: {
    codigo: 'SMARTSCALE',
    nomeExibicao: 'SmartScale',
    estrategiaElegibilidade: 'ESPECIALIDADE_PREFERENCIA',
    estrategiaAprovacaoTroca: 'ETAPA_UNICA',
    rotulos: {
      profissional: 'Profissional',
      profissionalPlural: 'Profissionais',
      tipoTurno: 'Tipo de turno',
      turno: 'Plantão',
      unidade: 'Unidade'
    }
  }
};

const codigoConfigurado = (process.env.PRODUTO ?? 'MILSCALE').toUpperCase() as CodigoProduto;

export const produtoAtual: ConfiguracaoProduto = catalogo[codigoConfigurado] ?? catalogo.MILSCALE;
