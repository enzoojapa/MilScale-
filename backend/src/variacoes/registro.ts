import { produtoAtual } from '../config/produto';
import type { ConfiguracaoProduto } from '../config/produto';
import type { RegraElegibilidade } from '../nucleo/elegibilidade/contrato';
import type { EstrategiaAprovacaoTroca } from '../nucleo/trocas/contrato';
import { RegraElegibilidadeHierarquica } from './milscale/regraElegibilidadeHierarquica';
import { EstrategiaAprovacaoEmCadeia } from './milscale/aprovacaoEmCadeia/estrategiaAprovacaoEmCadeia';
import { RegraElegibilidadePorEspecialidade } from './smartscale/regraElegibilidadePorEspecialidade';
import { EstrategiaAprovacaoUnica } from './smartscale/aprovacaoUnica/estrategiaAprovacaoUnica';

/**
 * Registro de plugins da linha de produto (composition root do microkernel).
 *
 * Este é o único arquivo do backend que conhece as duas famílias de implementação. O núcleo
 * recebe as estratégias já resolvidas por injeção e nunca pergunta qual produto está rodando.
 */
const regrasElegibilidade: Record<string, () => RegraElegibilidade> = {
  HIERARQUIA_MILITAR: () => new RegraElegibilidadeHierarquica(),
  ESPECIALIDADE_PREFERENCIA: () => new RegraElegibilidadePorEspecialidade()
};

const estrategiasAprovacao: Record<string, () => EstrategiaAprovacaoTroca> = {
  CADEIA_DUAS_ETAPAS: () => new EstrategiaAprovacaoEmCadeia(),
  ETAPA_UNICA: () => new EstrategiaAprovacaoUnica()
};

export interface PluginsDoProduto {
  configuracao: ConfiguracaoProduto;
  regraElegibilidade: RegraElegibilidade;
  estrategiaAprovacaoTroca: EstrategiaAprovacaoTroca;
}

export function carregarPluginsDoProduto(
  configuracao: ConfiguracaoProduto = produtoAtual
): PluginsDoProduto {
  const fabricaElegibilidade = regrasElegibilidade[configuracao.estrategiaElegibilidade];
  const fabricaAprovacao = estrategiasAprovacao[configuracao.estrategiaAprovacaoTroca];

  if (!fabricaElegibilidade || !fabricaAprovacao) {
    throw new Error(`Produto ${configuracao.codigo} referencia uma variação não registrada.`);
  }

  return {
    configuracao,
    regraElegibilidade: fabricaElegibilidade(),
    estrategiaAprovacaoTroca: fabricaAprovacao()
  };
}
