import { emTransacao } from '../../infra/banco';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import type { ServicoEscaladoDetalhado } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { solicitacaoRepositorio } from '../../infra/repositorios/solicitacaoRepositorio';
import { tipoServicoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import {
  ErroDeNegocio,
  ErroNaoEncontrado,
  ExcecaoDiaTrancado,
  ExcecaoElegibilidade
} from '../dominio/erros';
import { agoraISO, hojeISO, Periodo } from '../dominio/periodo';
import type { ValidadorElegibilidade } from '../elegibilidade/validadorElegibilidade';
import type { NotificacaoService } from '../notificacao/notificacaoService';

export class EscalaService {
  constructor(
    private readonly validador: ValidadorElegibilidade,
    private readonly notificacoes: NotificacaoService
  ) {}

  /** UC09 – Consulta da escala completa de um dia ou período, agrupada por data. */
  consultarPeriodo(filtros: {
    inicio: string;
    fim: string;
    idTipoServico?: number;
    idMilitar?: number;
    incluirRascunho: boolean;
  }) {
    const periodo = new Periodo(filtros.inicio, filtros.fim);
    if (periodo.quantidadeDias() > 90) {
      // UC09-E2: a consulta é limitada a 90 dias.
      throw new ErroDeNegocio('A consulta da escala está limitada a 90 dias.');
    }
    const servicos = escalaRepositorio.servicosPorPeriodo(filtros);
    return agruparPorData(servicos);
  }

  /** UC08 – Consulta da escala do próprio militar; só enxerga escala publicada (RN14). */
  consultarDoMilitar(idMilitar: number, inicio: string, fim: string) {
    const servicos = escalaRepositorio.servicosPorPeriodo({ inicio, fim, idMilitar });
    return servicos.map((servico) => ({
      ...servico,
      podeSolicitarTroca: this.podeSolicitarTroca(servico).permitido,
      motivoBloqueioTroca: this.podeSolicitarTroca(servico).motivo
    }));
  }

  /**
   * UC10 pré-condições: serviço futuro, dia destrancado (RN04) e antecedência mínima de 24h
   * antes do início do turno (RN12).
   */
  podeSolicitarTroca(servico: ServicoEscaladoDetalhado): { permitido: boolean; motivo?: string } {
    if (servico.situacao !== 'PREVISTO') {
      return { permitido: false, motivo: 'Serviço já cumprido ou substituído.' };
    }
    if (servico.trancado) {
      return { permitido: false, motivo: `Dia trancado: ${servico.motivo_trancamento ?? 'sem motivo'}.` };
    }
    if (servico.situacao_escala !== 'PUBLICADA') {
      return { permitido: false, motivo: 'A escala do período ainda não foi publicada.' };
    }
    const inicioServico = Date.parse(`${servico.data}T${servico.hora_inicio}:00`);
    if (Number.isFinite(inicioServico) && inicioServico - Date.now() < 24 * 3_600_000) {
      return { permitido: false, motivo: 'Antecedência mínima de 24 horas não cumprida.' };
    }
    return { permitido: true };
  }

  /** UC06 – Alteração manual da escala, privativa do sargenteante (RN18). */
  alterarManualmente(parametros: {
    idServicoEscalado: number;
    idMilitarSubstituto: number | null;
    justificativa: string;
    idUsuario: number;
  }) {
    const servico = escalaRepositorio.buscarServico(parametros.idServicoEscalado);
    if (!servico) throw new ErroNaoEncontrado('Serviço escalado');
    if (!parametros.justificativa?.trim()) {
      throw new ErroDeNegocio('A justificativa é obrigatória na alteração manual.');
    }
    if (servico.trancado) throw new ExcecaoDiaTrancado(servico.motivo_trancamento);
    if (servico.situacao_escala === 'ENCERRADA') {
      throw new ErroDeNegocio('Escala encerrada não aceita alterações.', 409);
    }

    if (parametros.idMilitarSubstituto !== null) {
      this.exigirElegibilidade(
        parametros.idMilitarSubstituto,
        servico.id_tipo_servico,
        servico.data,
        servico.id_servico_escalado
      );
    }

    const anterior = { ...servico };
    emTransacao(() => {
      escalaRepositorio.atualizarServico(servico.id_servico_escalado, {
        id_militar: parametros.idMilitarSubstituto,
        observacao: parametros.idMilitarSubstituto
          ? `Alteração manual: ${parametros.justificativa}`
          : `Removido sem substituto: ${parametros.justificativa}`
      });
      auditoriaService.registrar({
        idUsuario: parametros.idUsuario,
        entidade: 'SERVICO_ESCALADO',
        idRegistro: servico.id_servico_escalado,
        acao: 'ALTERACAO',
        valorAnterior: { id_militar: anterior.id_militar, militar: anterior.nome_guerra },
        valorNovo: {
          id_militar: parametros.idMilitarSubstituto,
          justificativa: parametros.justificativa
        }
      });
    });

    if (anterior.id_militar) {
      this.notificacoes.notificarPerfil(
        anterior.id_militar,
        'Alteração na escala',
        `Você foi retirado do serviço de ${servico.nome_tipo_servico} em ${servico.data}. Motivo: ${parametros.justificativa}`
      );
    }
    if (parametros.idMilitarSubstituto) {
      this.notificacoes.notificarPerfil(
        parametros.idMilitarSubstituto,
        'Alteração na escala',
        `Você foi escalado para ${servico.nome_tipo_servico} em ${servico.data}. Motivo: ${parametros.justificativa}`
      );
    }

    return escalaRepositorio.buscarServico(servico.id_servico_escalado);
  }

  /** UC06-A1 – Permuta direta entre dois militares já escalados. */
  permutar(parametros: { idServicoA: number; idServicoB: number; justificativa: string; idUsuario: number }) {
    const servicoA = escalaRepositorio.buscarServico(parametros.idServicoA);
    const servicoB = escalaRepositorio.buscarServico(parametros.idServicoB);
    if (!servicoA || !servicoB) throw new ErroNaoEncontrado('Serviço escalado');
    if (servicoA.trancado) throw new ExcecaoDiaTrancado(servicoA.motivo_trancamento);
    if (servicoB.trancado) throw new ExcecaoDiaTrancado(servicoB.motivo_trancamento);
    if (!servicoA.id_militar || !servicoB.id_militar) {
      throw new ErroDeNegocio('A permuta exige dois militares escalados.');
    }

    this.exigirElegibilidade(
      servicoB.id_militar,
      servicoA.id_tipo_servico,
      servicoA.data,
      servicoA.id_servico_escalado
    );
    this.exigirElegibilidade(
      servicoA.id_militar,
      servicoB.id_tipo_servico,
      servicoB.data,
      servicoB.id_servico_escalado
    );

    emTransacao(() => {
      escalaRepositorio.atualizarServico(servicoA.id_servico_escalado, { id_militar: null });
      escalaRepositorio.atualizarServico(servicoB.id_servico_escalado, {
        id_militar: servicoA.id_militar,
        observacao: `Permuta: ${parametros.justificativa}`
      });
      escalaRepositorio.atualizarServico(servicoA.id_servico_escalado, {
        id_militar: servicoB.id_militar,
        observacao: `Permuta: ${parametros.justificativa}`
      });
      auditoriaService.registrar({
        idUsuario: parametros.idUsuario,
        entidade: 'SERVICO_ESCALADO',
        idRegistro: servicoA.id_servico_escalado,
        acao: 'ALTERACAO',
        valorAnterior: { a: servicoA.nome_guerra, b: servicoB.nome_guerra },
        valorNovo: { permuta: true, justificativa: parametros.justificativa }
      });
    });
  }

  /** UC15 aplicada à alteração manual: lista quem pode assumir a vaga, já ordenado pela RN01. */
  elegiveisParaServico(idServicoEscalado: number) {
    const servico = escalaRepositorio.buscarServico(idServicoEscalado);
    if (!servico) throw new ErroNaoEncontrado('Serviço escalado');
    const aptos = this.validador.listarElegiveis(servico.id_tipo_servico, servico.data, {
      ignorarServicoEscalado: idServicoEscalado
    });
    const inaptos = this.validador.motivosDeInaptidao(servico.id_tipo_servico, servico.data, {
      ignorarServicoEscalado: idServicoEscalado
    });
    return { servico, aptos, inaptos };
  }

  /** UC07 – Trancar / destrancar dia (privativo do sargenteante, RN11). */
  trancarDia(parametros: {
    idDiaEscala: number;
    motivo: string;
    idUsuario: number;
    indeferirPendentes?: boolean;
  }) {
    const dia = escalaRepositorio.buscarDia(parametros.idDiaEscala);
    if (!dia) throw new ErroNaoEncontrado('Dia da escala');
    if (dia.trancado) throw new ErroDeNegocio('Dia já se encontra trancado.', 409);
    if (dia.data < hojeISO()) {
      throw new ErroDeNegocio('Não é permitido trancar data anterior à data atual.');
    }
    if (!parametros.motivo?.trim()) {
      throw new ErroDeNegocio('Informe o motivo do trancamento.');
    }

    const pendentes = solicitacaoRepositorio.pendentesNoDia(parametros.idDiaEscala);
    if (pendentes.length > 0 && !parametros.indeferirPendentes) {
      throw new ErroDeNegocio(
        `Existem ${pendentes.length} solicitação(ões) pendente(s) para esta data. ` +
          'Decida-as antes ou confirme o indeferimento automático.',
        409,
        'SOLICITACOES_PENDENTES'
      );
    }

    emTransacao(() => {
      for (const pendente of pendentes) {
        solicitacaoRepositorio.atualizar(pendente.id_solicitacao, { situacao: 'NEGADA' });
        solicitacaoRepositorio.inserirParecer({
          id_solicitacao: pendente.id_solicitacao,
          id_usuario_avaliador: parametros.idUsuario,
          etapa: 'AUTORIZACAO',
          resultado: 'NEGADA',
          justificativa: `Indeferida automaticamente: dia trancado (${parametros.motivo}).`,
          data_parecer: agoraISO()
        });
      }
      escalaRepositorio.atualizarTrancamento(
        parametros.idDiaEscala,
        1,
        parametros.motivo,
        parametros.idUsuario,
        agoraISO()
      );
      auditoriaService.registrar({
        idUsuario: parametros.idUsuario,
        entidade: 'DIA_ESCALA',
        idRegistro: parametros.idDiaEscala,
        acao: 'ALTERACAO',
        valorAnterior: { trancado: false },
        valorNovo: { trancado: true, motivo: parametros.motivo, solicitacoesIndeferidas: pendentes.length }
      });
    });

    for (const pendente of pendentes) {
      this.notificacoes.notificarMudancaDeSituacao(pendente.id_solicitacao, 'NEGADA', 'Dia trancado pela sargenteação.');
    }

    return { solicitacoesIndeferidas: pendentes.length };
  }

  destrancarDia(idDiaEscala: number, justificativa: string, idUsuario: number) {
    const dia = escalaRepositorio.buscarDia(idDiaEscala);
    if (!dia) throw new ErroNaoEncontrado('Dia da escala');
    if (!dia.trancado) throw new ErroDeNegocio('Dia não está trancado.', 409);

    emTransacao(() => {
      escalaRepositorio.atualizarTrancamento(idDiaEscala, 0, null, null, null);
      auditoriaService.registrar({
        idUsuario,
        entidade: 'DIA_ESCALA',
        idRegistro: idDiaEscala,
        acao: 'ALTERACAO',
        valorAnterior: { trancado: true, motivo: dia.motivo_trancamento },
        valorNovo: { trancado: false, justificativa }
      });
    });
  }

  trancarIntervalo(parametros: {
    inicio: string;
    fim: string;
    motivo: string;
    idUsuario: number;
    indeferirPendentes?: boolean;
  }) {
    const periodo = new Periodo(parametros.inicio, parametros.fim);
    const trancados: string[] = [];
    for (const data of periodo.dias()) {
      const dia = escalaRepositorio.buscarDiaPorData(data);
      if (!dia || dia.trancado) continue;
      this.trancarDia({
        idDiaEscala: dia.id_dia_escala,
        motivo: parametros.motivo,
        idUsuario: parametros.idUsuario,
        indeferirPendentes: parametros.indeferirPendentes
      });
      trancados.push(data);
    }
    return { trancados };
  }

  /** UC17 – Histórico de serviços do militar com totalizadores por tipo. */
  historicoDoMilitar(idMilitar: number, inicio: string, fim: string) {
    const militar = militarRepositorio.buscarPorId(idMilitar);
    if (!militar) throw new ErroNaoEncontrado('Militar');
    const servicos = escalaRepositorio.historicoDoMilitar(idMilitar, inicio, fim);

    const totalizadores = new Map<string, number>();
    for (const servico of servicos) {
      totalizadores.set(servico.nome_tipo_servico, (totalizadores.get(servico.nome_tipo_servico) ?? 0) + 1);
    }

    return {
      militar,
      servicos,
      totalizadores: [...totalizadores.entries()].map(([tipoServico, total]) => ({ tipoServico, total })),
      diasSemServico: militar.dias_sem_servico
    };
  }

  private exigirElegibilidade(
    idMilitar: number,
    idTipoServico: number,
    data: string,
    idServicoIgnorado?: number
  ) {
    const militar = militarRepositorio.buscarPorId(idMilitar);
    if (!militar) throw new ErroNaoEncontrado('Militar');
    const tipoServico = tipoServicoRepositorio.buscarPorId(idTipoServico);
    if (!tipoServico) throw new ErroNaoEncontrado('Tipo de serviço');

    const resultado = this.validador.avaliar(militar, tipoServico, data, {
      ignorarServicoEscalado: idServicoIgnorado
    });
    if (!resultado.apto) {
      throw new ExcecaoElegibilidade(
        `${militar.sigla_posto} ${militar.nome_guerra} não pode assumir este serviço. ${resultado.motivo}`
      );
    }
  }
}

function agruparPorData(servicos: ServicoEscaladoDetalhado[]) {
  const porData = new Map<string, ServicoEscaladoDetalhado[]>();
  for (const servico of servicos) {
    const lista = porData.get(servico.data) ?? [];
    lista.push(servico);
    porData.set(servico.data, lista);
  }
  return [...porData.entries()].map(([data, itens]) => ({
    data,
    trancado: Boolean(itens[0].trancado),
    motivoTrancamento: itens[0].motivo_trancamento,
    idDiaEscala: itens[0].id_dia_escala,
    situacaoEscala: itens[0].situacao_escala,
    servicos: itens,
    pendencias: itens.filter((s) => !s.id_militar).length
  }));
}
