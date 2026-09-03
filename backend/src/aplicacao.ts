import { carregarPluginsDoProduto } from './variacoes/registro';
import { ValidadorElegibilidade } from './nucleo/elegibilidade/validadorElegibilidade';
import { GeradorEscalaService } from './nucleo/escala/geradorEscalaService';
import { EscalaService } from './nucleo/escala/escalaService';
import { NotificacaoService } from './nucleo/notificacao/notificacaoService';
import { CanalEmailSimulado, CanalSistema } from './nucleo/notificacao/canal';
import { SolicitacaoTrocaService } from './nucleo/trocas/solicitacaoTrocaService';

/**
 * Composição da aplicação. O núcleo recebe as variações do produto por injeção; trocar o valor de
 * PRODUTO no ambiente é suficiente para que outro par de estratégias seja montado aqui, sem que
 * nenhum serviço do núcleo mude.
 */
const plugins = carregarPluginsDoProduto();

const validadorElegibilidade = new ValidadorElegibilidade(plugins.regraElegibilidade);
const notificacaoService = new NotificacaoService([new CanalSistema(), new CanalEmailSimulado()]);
const escalaService = new EscalaService(validadorElegibilidade, notificacaoService);
const geradorEscalaService = new GeradorEscalaService(validadorElegibilidade, notificacaoService);
const solicitacaoTrocaService = new SolicitacaoTrocaService(
  plugins.estrategiaAprovacaoTroca,
  validadorElegibilidade,
  escalaService,
  notificacaoService
);

export const aplicacao = {
  plugins,
  validadorElegibilidade,
  notificacaoService,
  escalaService,
  geradorEscalaService,
  solicitacaoTrocaService
};
