import { ErroDeNegocio } from '../../../nucleo/dominio/erros';
import { podeTransitar } from '../../../nucleo/trocas/maquinaEstados';
import type {
  EntradaAvaliacao,
  EstrategiaAprovacaoTroca,
  EtapaAprovacao,
  ResultadoAvaliacao
} from '../../../nucleo/trocas/contrato';
import type { SituacaoSolicitacao } from '../../../nucleo/dominio/tipos';

/**
 * FUNÇÃO EXCLUSIVA DO MILSCALE — RF12b / RN08 / UC11 + UC12.
 *
 * Aprovação de troca em duas etapas encadeadas: o cabo da sargenteação faz a triagem de
 * viabilidade e, sendo favorável, a solicitação sobe ao sargenteante, que autoriza ou nega em
 * definitivo. Cada etapa grava seu próprio PARECER_SOLICITACAO (`TRIAGEM` e `AUTORIZACAO`).
 *
 * O SmartScale não carrega esta cadeia: no domínio hospitalar o coordenador decide em etapa
 * única. Por isso a lógica vive neste módulo de variação e não em condicionais do núcleo — o
 * SolicitacaoTrocaService desconhece quantas etapas existem e apenas aplica o que a estratégia
 * devolve.
 */
export class EstrategiaAprovacaoEmCadeia implements EstrategiaAprovacaoTroca {
  readonly identificador = 'CADEIA_DUAS_ETAPAS';
  readonly descricao =
    'Dupla avaliação: triagem de viabilidade do cabo da sargenteação e autorização final do sargenteante.';

  private readonly cadeia: EtapaAprovacao[] = [
    {
      ordem: 1,
      etapa: 'TRIAGEM',
      situacaoAguardando: 'EM_ANALISE_CABO',
      perfilResponsavel: 'CABO_SARGENTEACAO',
      rotulo: 'Triagem de viabilidade (cabo da sargenteação)',
      decisoesPossiveis: ['APROVAR', 'RECUSAR']
    },
    {
      ordem: 2,
      etapa: 'AUTORIZACAO',
      situacaoAguardando: 'AGUARDANDO_SARGENTEANTE',
      perfilResponsavel: 'SARGENTEANTE',
      rotulo: 'Autorização final (sargenteante)',
      decisoesPossiveis: ['APROVAR', 'RECUSAR', 'DEVOLVER']
    }
  ];

  situacaoInicial(): SituacaoSolicitacao {
    return this.cadeia[0].situacaoAguardando;
  }

  etapas(): EtapaAprovacao[] {
    return this.cadeia;
  }

  etapaCorrente(situacao: SituacaoSolicitacao): EtapaAprovacao | null {
    return this.cadeia.find((e) => e.situacaoAguardando === situacao) ?? null;
  }

  avaliar(entrada: EntradaAvaliacao): ResultadoAvaliacao {
    const etapaAtual = this.etapaCorrente(entrada.solicitacao.situacao);
    if (!etapaAtual) {
      throw new ErroDeNegocio('A solicitação já foi decidida e não aceita novo parecer.', 409);
    }
    if (etapaAtual.etapa !== entrada.etapa) {
      throw new ErroDeNegocio(
        `A solicitação está na etapa de ${etapaAtual.rotulo} e não aceita parecer de ${entrada.etapa}.`,
        409
      );
    }
    if (!etapaAtual.decisoesPossiveis.includes(entrada.decisao)) {
      throw new ErroDeNegocio(`Decisão "${entrada.decisao}" indisponível nesta etapa.`, 400);
    }

    const resultado = this.decidir(etapaAtual, entrada);
    if (!podeTransitar(entrada.solicitacao.situacao, resultado.novaSituacao)) {
      throw new ErroDeNegocio(
        `Transição inválida de ${entrada.solicitacao.situacao} para ${resultado.novaSituacao}.`,
        409
      );
    }
    return resultado;
  }

  private decidir(etapaAtual: EtapaAprovacao, entrada: EntradaAvaliacao): ResultadoAvaliacao {
    if (entrada.decisao === 'RECUSAR') {
      return {
        novaSituacao: 'NEGADA',
        resultadoParecer: etapaAtual.etapa === 'TRIAGEM' ? 'DESFAVORAVEL' : 'NEGADA',
        aplicarTrocaNaEscala: false
      };
    }
    // UC12-A2: o sargenteante pode devolver a solicitação ao cabo para reanálise.
    if (entrada.decisao === 'DEVOLVER') {
      return {
        novaSituacao: 'EM_ANALISE_CABO',
        resultadoParecer: 'DESFAVORAVEL',
        aplicarTrocaNaEscala: false
      };
    }

    const proxima = this.cadeia.find((e) => e.ordem === etapaAtual.ordem + 1);
    if (proxima) {
      return {
        novaSituacao: proxima.situacaoAguardando,
        resultadoParecer: 'FAVORAVEL',
        aplicarTrocaNaEscala: false
      };
    }
    return { novaSituacao: 'AUTORIZADA', resultadoParecer: 'AUTORIZADA', aplicarTrocaNaEscala: true };
  }
}
