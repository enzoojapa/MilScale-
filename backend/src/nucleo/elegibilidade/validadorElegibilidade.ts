import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { missaoRepositorio } from '../../infra/repositorios/missaoRepositorio';
import { regraEscalaRepositorio } from '../../infra/repositorios/regraEscalaRepositorio';
import { tipoServicoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import type { TipoServicoDetalhado } from '../../infra/repositorios/catalogoRepositorio';
import { diferencaEmDias, somarDias } from '../dominio/periodo';
import { ErroNaoEncontrado } from '../dominio/erros';
import type { MilitarDetalhado, Missao, RegraEscala } from '../dominio/tipos';
import type { RegraElegibilidade, ResultadoElegibilidade } from './contrato';

export interface EstadoDoPeriodo {
  /** Impedimentos já carregados para evitar N consultas durante a geração da escala. */
  missoesPorMilitar: Map<number, Missao[]>;
  /** Data do último serviço de cada militar, atualizada em memória a cada dia escalado. */
  ultimoServicoPorMilitar: Map<number, string>;
  /** Militares já escalados em cada data (chave `${data}`). */
  escaladosPorData: Map<string, Set<number>>;
}

export interface OpcoesValidacao {
  /** Quando informado, evita reconsultar o banco a cada avaliação (usado por UC05). */
  estado?: EstadoDoPeriodo;
  /** Ignora o serviço indicado ao checar duplicidade — usado ao substituir um militar (UC06/UC12). */
  ignorarServicoEscalado?: number;
  /** Dia trancado só bloqueia alterações e trocas; a geração inicial ainda escala o dia. */
  considerarTrancamento?: boolean;
}

export interface MilitarElegivel {
  militar: MilitarDetalhado;
  semPrioridade: boolean;
  diasSemServico: number;
  servicosNoMes: number;
}

/**
 * UC15 – Validar elegibilidade do militar.
 *
 * Serviço isolado, incluído por UC05 (geração), UC06 (alteração manual) e UC10 (solicitação de
 * troca). As regras comuns à linha de produto (duplicidade na data, intervalo mínimo, limite
 * mensal, impedimento, trancamento, perda de prioridade no retorno) ficam aqui; o critério que
 * varia por produto é delegado à `RegraElegibilidade` injetada.
 */
export class ValidadorElegibilidade {
  constructor(private readonly regraDoProduto: RegraElegibilidade) {}

  get regraAplicada(): RegraElegibilidade {
    return this.regraDoProduto;
  }

  criarEstadoDoPeriodo(inicio: string, fim: string): EstadoDoPeriodo {
    const missoesPorMilitar = new Map<number, Missao[]>();
    // A janela recua um dia para que a RN16 enxergue o impedimento encerrado na véspera.
    for (const missao of missaoRepositorio.noPeriodo(somarDias(inicio, -1), fim)) {
      const lista = missoesPorMilitar.get(missao.id_militar) ?? [];
      lista.push(missao);
      missoesPorMilitar.set(missao.id_militar, lista);
    }
    return {
      missoesPorMilitar,
      ultimoServicoPorMilitar: new Map(),
      escaladosPorData: new Map()
    };
  }

  avaliar(
    militar: MilitarDetalhado,
    tipoServico: TipoServicoDetalhado,
    data: string,
    opcoes: OpcoesValidacao = {}
  ): ResultadoElegibilidade {
    if (militar.situacao !== 'ATIVO') {
      return { apto: false, motivo: `Militar com situação ${militar.situacao}.` };
    }

    const doProduto = this.regraDoProduto.avaliar({
      militar,
      tipoServico,
      data,
      cursosDoMilitar: militar.cursos.map((c) => c.id_curso)
    });
    if (!doProduto.apto) return doProduto;

    // RN04: dia trancado não aceita alteração nem solicitação de troca.
    if (opcoes.considerarTrancamento) {
      const dia = escalaRepositorio.buscarDiaPorData(data);
      if (dia?.trancado) {
        return { apto: false, motivo: `Dia ${data} trancado: ${dia.motivo_trancamento ?? 'sem motivo informado'}.` };
      }
    }

    // RN15: missão ou impedimento registrado bloqueia a escalação na data.
    const impedimento = this.impedimentoNaData(militar.id_militar, data, opcoes.estado);
    if (impedimento) {
      return {
        apto: false,
        motivo: `${impedimento.tipo} registrada de ${impedimento.data_inicio} a ${impedimento.data_fim}: ${impedimento.descricao}.`
      };
    }

    // RN05: um militar não ocupa mais de um serviço na mesma data.
    if (this.jaEscaladoNaData(militar.id_militar, data, opcoes)) {
      return { apto: false, motivo: `Militar já escalado em ${data}.` };
    }

    const regra = regraEscalaRepositorio.vigenteEm(tipoServico.id_tipo_servico, data);

    // RN06: intervalo mínimo entre dois serviços do mesmo militar.
    const ultimoServico = this.ultimoServicoAntesDe(militar.id_militar, data, opcoes.estado);
    if (regra && ultimoServico) {
      const intervalo = diferencaEmDias(ultimoServico, data);
      if (intervalo < regra.intervalo_minimo) {
        return {
          apto: false,
          motivo: `Intervalo mínimo de ${regra.intervalo_minimo} dias não cumprido (último serviço em ${ultimoServico}).`
        };
      }
    }

    // Limite mensal de serviços definido na regra vigente.
    if (regra?.max_servicos_mes) {
      const total = this.servicosNoMes(militar.id_militar, data.slice(0, 7));
      if (total >= regra.max_servicos_mes) {
        return {
          apto: false,
          motivo: `Limite de ${regra.max_servicos_mes} serviços no mês já atingido.`
        };
      }
    }

    // RN16: quem encerrou impedimento na véspera segue elegível, porém sem precedência na fila.
    const retornouDeImpedimento = this.impedimentoNaData(
      militar.id_militar,
      somarDias(data, -1),
      opcoes.estado
    );

    return { apto: true, semPrioridade: Boolean(retornouDeImpedimento) };
  }

  /**
   * UC15-A1: lista de elegíveis já ordenada pela RN01 — maior contador de dias sem serviço,
   * menor número de serviços no mês e, por fim, antiguidade. Militares que retornaram de
   * impedimento entram no fim da fila (RN16).
   */
  listarElegiveis(
    idTipoServico: number,
    data: string,
    opcoes: OpcoesValidacao & { contadores?: Map<number, number> } = {}
  ): MilitarElegivel[] {
    const tipoServico = tipoServicoRepositorio.buscarPorId(idTipoServico);
    if (!tipoServico) throw new ErroNaoEncontrado('Tipo de serviço');

    const candidatos = militarRepositorio.listar({ situacao: 'ATIVO' });
    const elegiveis: MilitarElegivel[] = [];

    for (const militar of candidatos) {
      const resultado = this.avaliar(militar, tipoServico, data, opcoes);
      if (!resultado.apto) continue;
      elegiveis.push({
        militar,
        semPrioridade: Boolean(resultado.semPrioridade),
        diasSemServico: opcoes.contadores?.get(militar.id_militar) ?? militar.dias_sem_servico,
        servicosNoMes: this.servicosNoMes(militar.id_militar, data.slice(0, 7))
      });
    }

    return elegiveis.sort(compararPelaRegraDeRotatividade);
  }

  motivosDeInaptidao(
    idTipoServico: number,
    data: string,
    opcoes: OpcoesValidacao = {}
  ): { militar: MilitarDetalhado; motivo: string }[] {
    const tipoServico = tipoServicoRepositorio.buscarPorId(idTipoServico);
    if (!tipoServico) throw new ErroNaoEncontrado('Tipo de serviço');
    const resultados: { militar: MilitarDetalhado; motivo: string }[] = [];
    for (const militar of militarRepositorio.listar({ situacao: 'ATIVO' })) {
      const avaliacao = this.avaliar(militar, tipoServico, data, opcoes);
      if (!avaliacao.apto) {
        resultados.push({ militar, motivo: avaliacao.motivo ?? 'Inapto.' });
      }
    }
    return resultados;
  }

  private impedimentoNaData(idMilitar: number, data: string, estado?: EstadoDoPeriodo): Missao | null {
    if (estado) {
      const missoes = estado.missoesPorMilitar.get(idMilitar) ?? [];
      return missoes.find((m) => data >= m.data_inicio && data <= m.data_fim) ?? null;
    }
    return missaoRepositorio.impedimentoNaData(idMilitar, data);
  }

  private jaEscaladoNaData(idMilitar: number, data: string, opcoes: OpcoesValidacao): boolean {
    if (opcoes.estado) {
      return opcoes.estado.escaladosPorData.get(data)?.has(idMilitar) ?? false;
    }
    const servicos = escalaRepositorio.servicosPorPeriodo({
      inicio: data,
      fim: data,
      idMilitar,
      incluirRascunho: true
    });
    return servicos.some(
      (s) => s.situacao !== 'SUBSTITUIDO' && s.id_servico_escalado !== opcoes.ignorarServicoEscalado
    );
  }

  private ultimoServicoAntesDe(idMilitar: number, data: string, estado?: EstadoDoPeriodo): string | null {
    const emMemoria = estado?.ultimoServicoPorMilitar.get(idMilitar);
    const persistido = escalaRepositorio.dataUltimoServicoAntesDe(idMilitar, data);
    if (emMemoria && emMemoria < data) {
      return persistido && persistido > emMemoria ? persistido : emMemoria;
    }
    return persistido;
  }

  /**
   * Os serviços gerados no período já estão gravados na mesma transação, portanto a contagem sai
   * direto do banco — somar um acumulador em memória duplicaria cada alocação recém-inserida.
   */
  private servicosNoMes(idMilitar: number, anoMes: string): number {
    return escalaRepositorio.quantidadeServicosNoMes(idMilitar, anoMes);
  }
}

/** RN01 — critério de ordenação da rotatividade, isolado para permitir parametrização na LPS. */
export function compararPelaRegraDeRotatividade(a: MilitarElegivel, b: MilitarElegivel): number {
  if (a.semPrioridade !== b.semPrioridade) return a.semPrioridade ? 1 : -1;
  if (a.diasSemServico !== b.diasSemServico) return b.diasSemServico - a.diasSemServico;
  if (a.servicosNoMes !== b.servicosNoMes) return a.servicosNoMes - b.servicosNoMes;
  if (a.militar.nivel_hierarquico !== b.militar.nivel_hierarquico) {
    return b.militar.nivel_hierarquico - a.militar.nivel_hierarquico;
  }
  return a.militar.id_militar - b.militar.id_militar;
}
