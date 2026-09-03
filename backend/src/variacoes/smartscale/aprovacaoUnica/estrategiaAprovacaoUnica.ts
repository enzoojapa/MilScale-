import { ErroDeNegocio } from '../../../nucleo/dominio/erros';
import type {
  EntradaAvaliacao,
  EstrategiaAprovacaoTroca,
  EtapaAprovacao,
  ResultadoAvaliacao
} from '../../../nucleo/trocas/contrato';
import type { SituacaoSolicitacao } from '../../../nucleo/dominio/tipos';

/**
 * Variação RF12 (SmartScale): o coordenador do plantão decide a troca em etapa única.
 *
 * Existe no repositório para demonstrar que a feature exclusiva do MilScale é de fato removível:
 * trocando apenas a configuração do produto, o mesmo núcleo passa a operar com uma etapa, sem
 * que nenhuma linha de SolicitacaoTrocaService mude.
 */
export class EstrategiaAprovacaoUnica implements EstrategiaAprovacaoTroca {
  readonly identificador = 'ETAPA_UNICA';
  readonly descricao = 'Aprovação em etapa única pelo coordenador responsável pelo turno.';

  private readonly etapaUnica: EtapaAprovacao = {
    ordem: 1,
    etapa: 'AUTORIZACAO',
    situacaoAguardando: 'AGUARDANDO_SARGENTEANTE',
    perfilResponsavel: 'SARGENTEANTE',
    rotulo: 'Decisão do coordenador',
    decisoesPossiveis: ['APROVAR', 'RECUSAR']
  };

  situacaoInicial(): SituacaoSolicitacao {
    return this.etapaUnica.situacaoAguardando;
  }

  etapas(): EtapaAprovacao[] {
    return [this.etapaUnica];
  }

  etapaCorrente(situacao: SituacaoSolicitacao): EtapaAprovacao | null {
    return situacao === this.etapaUnica.situacaoAguardando ? this.etapaUnica : null;
  }

  avaliar(entrada: EntradaAvaliacao): ResultadoAvaliacao {
    if (!this.etapaCorrente(entrada.solicitacao.situacao)) {
      throw new ErroDeNegocio('A solicitação já foi decidida e não aceita novo parecer.', 409);
    }
    if (entrada.decisao === 'RECUSAR') {
      return { novaSituacao: 'NEGADA', resultadoParecer: 'NEGADA', aplicarTrocaNaEscala: false };
    }
    return { novaSituacao: 'AUTORIZADA', resultadoParecer: 'AUTORIZADA', aplicarTrocaNaEscala: true };
  }
}
