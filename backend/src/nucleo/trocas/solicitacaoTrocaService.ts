import { emTransacao } from '../../infra/banco';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { solicitacaoRepositorio } from '../../infra/repositorios/solicitacaoRepositorio';
import { tipoServicoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import {
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
  ExcecaoDiaTrancado,
  ExcecaoElegibilidade
} from '../dominio/erros';
import { agoraISO } from '../dominio/periodo';
import type { ValidadorElegibilidade } from '../elegibilidade/validadorElegibilidade';
import type { NotificacaoService } from '../notificacao/notificacaoService';
import type { EscalaService } from '../escala/escalaService';
import { estaEmAndamento, rotuloSituacao } from './maquinaEstados';
import type { DecisaoAvaliacao, EstrategiaAprovacaoTroca } from './contrato';
import type { NomePerfil, UsuarioAutenticado } from '../dominio/tipos';

/**
 * UC10 a UC13 e UC19 – fluxo de solicitação de troca.
 *
 * O serviço é comum à linha de produto: ele registra a solicitação, valida elegibilidade,
 * grava os pareceres e aplica a troca na escala. Quantas etapas de avaliação existem e quem
 * responde por cada uma vem da EstrategiaAprovacaoTroca injetada — no MilScale, a cadeia de
 * duas etapas (RF12b); no SmartScale, a etapa única (RF12).
 */
export class SolicitacaoTrocaService {
  constructor(
    private readonly estrategia: EstrategiaAprovacaoTroca,
    private readonly validador: ValidadorElegibilidade,
    private readonly escalas: EscalaService,
    private readonly notificacoes: NotificacaoService
  ) {}

  get fluxoConfigurado() {
    return {
      identificador: this.estrategia.identificador,
      descricao: this.estrategia.descricao,
      etapas: this.estrategia.etapas()
    };
  }

  /** UC10 – Solicitar troca de serviço. */
  registrar(parametros: {
    idServicoEscalado: number;
    idMilitarSolicitante: number;
    idMilitarSubstituto: number | null;
    motivo: string;
    idUsuario: number;
  }) {
    const servico = escalaRepositorio.buscarServico(parametros.idServicoEscalado);
    if (!servico) throw new ErroNaoEncontrado('Serviço escalado');
    if (servico.id_militar !== parametros.idMilitarSolicitante) {
      throw new ErroDePermissao('Só é possível solicitar a troca de um serviço em que você está escalado.');
    }
    if (!parametros.motivo?.trim()) {
      throw new ErroDeNegocio('Informe o motivo da solicitação.');
    }
    if (servico.trancado) throw new ExcecaoDiaTrancado(servico.motivo_trancamento);

    const permissao = this.escalas.podeSolicitarTroca(servico);
    if (!permissao.permitido) {
      throw new ErroDeNegocio(permissao.motivo ?? 'Solicitação não permitida para este serviço.', 409);
    }

    // UC10-E4: uma solicitação em andamento por serviço.
    if (solicitacaoRepositorio.pendentePara(parametros.idServicoEscalado)) {
      throw new ErroDeNegocio('Já existe uma solicitação em andamento para este serviço.', 409);
    }

    // RN07 e RN13: o substituto indicado precisa ser elegível e estar livre na data.
    if (parametros.idMilitarSubstituto) {
      this.exigirSubstitutoElegivel(
        parametros.idMilitarSubstituto,
        servico.id_tipo_servico,
        servico.data,
        servico.id_servico_escalado
      );
    }

    const situacaoInicial = this.estrategia.situacaoInicial();
    const idSolicitacao = emTransacao(() => {
      const novoId = solicitacaoRepositorio.inserir({
        id_servico_escalado: parametros.idServicoEscalado,
        id_militar_solicitante: parametros.idMilitarSolicitante,
        id_militar_substituto: parametros.idMilitarSubstituto,
        motivo: parametros.motivo,
        data_solicitacao: agoraISO(),
        situacao: situacaoInicial
      });
      auditoriaService.registrar({
        idUsuario: parametros.idUsuario,
        entidade: 'SOLICITACAO_TROCA',
        idRegistro: novoId,
        acao: 'INCLUSAO',
        valorNovo: {
          servico: `${servico.nome_tipo_servico} em ${servico.data}`,
          substituto: parametros.idMilitarSubstituto,
          situacao: situacaoInicial
        }
      });
      return novoId;
    });

    this.notificacoes.notificarMudancaDeSituacao(idSolicitacao, situacaoInicial);
    return solicitacaoRepositorio.buscarPorId(idSolicitacao);
  }

  /** UC10-A3 / UC19-A2 – o militar cancela a própria solicitação enquanto ela está em triagem. */
  cancelar(idSolicitacao: number, usuario: UsuarioAutenticado) {
    const solicitacao = solicitacaoRepositorio.buscarPorId(idSolicitacao);
    if (!solicitacao) throw new ErroNaoEncontrado('Solicitação');
    if (solicitacao.id_militar_solicitante !== usuario.id_militar) {
      throw new ErroDePermissao('Só o próprio solicitante pode cancelar a solicitação.');
    }
    if (solicitacao.situacao !== this.estrategia.situacaoInicial()) {
      throw new ErroDeNegocio(
        `A solicitação está em "${rotuloSituacao[solicitacao.situacao]}" e não pode mais ser cancelada.`,
        409
      );
    }
    emTransacao(() => {
      solicitacaoRepositorio.atualizar(idSolicitacao, { situacao: 'CANCELADA' });
      auditoriaService.registrar({
        idUsuario: usuario.id_usuario,
        entidade: 'SOLICITACAO_TROCA',
        idRegistro: idSolicitacao,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: solicitacao.situacao },
        valorNovo: { situacao: 'CANCELADA' }
      });
    });
  }

  /**
   * UC11 e UC12 – registro de parecer. Um único método atende às duas telas: a etapa e o perfil
   * responsável vêm da estratégia, e é ela que decide a situação seguinte.
   */
  avaliar(parametros: {
    idSolicitacao: number;
    decisao: DecisaoAvaliacao;
    justificativa: string;
    idMilitarSubstitutoSugerido?: number | null;
    usuario: UsuarioAutenticado;
  }) {
    const solicitacao = solicitacaoRepositorio.buscarPorId(parametros.idSolicitacao);
    if (!solicitacao) throw new ErroNaoEncontrado('Solicitação');
    if (!parametros.justificativa?.trim()) {
      throw new ErroDeNegocio('A justificativa do parecer é obrigatória.');
    }

    const etapaCorrente = this.estrategia.etapaCorrente(solicitacao.situacao);
    if (!etapaCorrente) {
      throw new ErroDeNegocio(
        `A solicitação está em "${rotuloSituacao[solicitacao.situacao]}" e não aguarda parecer.`,
        409
      );
    }
    if (!perfilAtende(parametros.usuario.perfil, etapaCorrente.perfilResponsavel)) {
      throw new ErroDePermissao(
        `Esta etapa (${etapaCorrente.rotulo}) é privativa do perfil ${etapaCorrente.perfilResponsavel}.`
      );
    }

    const servico = escalaRepositorio.buscarServico(solicitacao.id_servico_escalado);
    if (!servico) throw new ErroNaoEncontrado('Serviço escalado');

    // UC11-E2 / UC12-E1: o dia pode ter sido trancado depois do registro da solicitação.
    if (servico.trancado && parametros.decisao === 'APROVAR') {
      throw new ExcecaoDiaTrancado(servico.motivo_trancamento);
    }

    // UC11-A1: o avaliador pode indicar outro substituto elegível apresentado pelo sistema.
    let idSubstituto = solicitacao.id_militar_substituto;
    if (parametros.idMilitarSubstitutoSugerido !== undefined && parametros.idMilitarSubstitutoSugerido !== null) {
      idSubstituto = parametros.idMilitarSubstitutoSugerido;
    }

    const resultado = this.estrategia.avaliar({
      solicitacao,
      etapa: etapaCorrente.etapa,
      decisao: parametros.decisao,
      justificativa: parametros.justificativa
    });

    // RN07: a elegibilidade é revalidada no momento em que a troca de fato altera a escala.
    if (resultado.aplicarTrocaNaEscala) {
      if (!idSubstituto) {
        throw new ErroDeNegocio(
          'A troca não pode ser autorizada sem um substituto indicado. Selecione um militar elegível.',
          409
        );
      }
      this.exigirSubstitutoElegivel(
        idSubstituto,
        servico.id_tipo_servico,
        servico.data,
        servico.id_servico_escalado
      );
    }

    emTransacao(() => {
      solicitacaoRepositorio.inserirParecer({
        id_solicitacao: parametros.idSolicitacao,
        id_usuario_avaliador: parametros.usuario.id_usuario,
        etapa: etapaCorrente.etapa,
        resultado: resultado.resultadoParecer,
        justificativa: parametros.justificativa,
        data_parecer: agoraISO()
      });

      solicitacaoRepositorio.atualizar(parametros.idSolicitacao, {
        situacao: resultado.novaSituacao,
        id_militar_substituto: idSubstituto
      });

      // RN09: a autorização altera a escala e recalcula o contador dos militares envolvidos.
      if (resultado.aplicarTrocaNaEscala && idSubstituto) {
        escalaRepositorio.atualizarServico(servico.id_servico_escalado, {
          id_militar: idSubstituto,
          observacao: `Troca autorizada (solicitação ${parametros.idSolicitacao}).`
        });
        this.recalcularContadores([solicitacao.id_militar_solicitante, idSubstituto], servico.data);
      }

      auditoriaService.registrar({
        idUsuario: parametros.usuario.id_usuario,
        entidade: 'SOLICITACAO_TROCA',
        idRegistro: parametros.idSolicitacao,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: solicitacao.situacao },
        valorNovo: {
          situacao: resultado.novaSituacao,
          etapa: etapaCorrente.etapa,
          resultado: resultado.resultadoParecer,
          justificativa: parametros.justificativa
        }
      });
    });

    this.notificacoes.notificarMudancaDeSituacao(parametros.idSolicitacao, resultado.novaSituacao);
    return solicitacaoRepositorio.buscarPorId(parametros.idSolicitacao);
  }

  /** UC13 (todas) e UC19 (apenas as próprias) — a RN19 é aplicada pelo chamador via `restringirA`. */
  listar(filtros: {
    situacao?: string;
    inicio?: string;
    fim?: string;
    restringirAoMilitar?: number;
  }) {
    return solicitacaoRepositorio
      .listar({
        situacao: filtros.situacao,
        inicio: filtros.inicio,
        fim: filtros.fim,
        idSolicitante: filtros.restringirAoMilitar
      })
      .map((solicitacao) => ({
        ...solicitacao,
        rotulo_situacao: rotuloSituacao[solicitacao.situacao],
        em_andamento: estaEmAndamento(solicitacao.situacao),
        etapa_atual: this.estrategia.etapaCorrente(solicitacao.situacao)?.rotulo ?? null
      }));
  }

  detalhar(idSolicitacao: number, usuario: UsuarioAutenticado) {
    const solicitacao = solicitacaoRepositorio.buscarPorId(idSolicitacao);
    if (!solicitacao) throw new ErroNaoEncontrado('Solicitação');

    // RN19 / UC19-E2: militar sem perfil da sargenteação só acessa as próprias solicitações.
    const daSargenteacao = usuario.perfil !== 'MILITAR_ESCALADO';
    if (!daSargenteacao && solicitacao.id_militar_solicitante !== usuario.id_militar) {
      throw new ErroDePermissao('Solicitação de outro militar.');
    }

    const servico = escalaRepositorio.buscarServico(solicitacao.id_servico_escalado);
    const etapaCorrente = this.estrategia.etapaCorrente(solicitacao.situacao);

    return {
      solicitacao: { ...solicitacao, rotulo_situacao: rotuloSituacao[solicitacao.situacao] },
      pareceres: solicitacaoRepositorio.pareceresDe(idSolicitacao),
      etapas: this.estrategia.etapas(),
      etapaCorrente,
      podeAvaliar: Boolean(etapaCorrente && perfilAtende(usuario.perfil, etapaCorrente.perfilResponsavel)),
      validacaoAutomatica: servico ? this.validarAutomaticamente(solicitacao, servico) : null,
      substitutosSugeridos: servico
        ? this.validador
            .listarElegiveis(servico.id_tipo_servico, servico.data, {
              ignorarServicoEscalado: servico.id_servico_escalado
            })
            .slice(0, 10)
            .map((e) => ({
              id_militar: e.militar.id_militar,
              nome_guerra: e.militar.nome_guerra,
              sigla_posto: e.militar.sigla_posto,
              dias_sem_servico: e.diasSemServico,
              sem_prioridade: e.semPrioridade
            }))
        : []
    };
  }

  /** Substitutos elegíveis oferecidos ao militar na tela de solicitação (UC10 passo 3). */
  substitutosPossiveis(idServicoEscalado: number) {
    const servico = escalaRepositorio.buscarServico(idServicoEscalado);
    if (!servico) throw new ErroNaoEncontrado('Serviço escalado');
    return this.validador
      .listarElegiveis(servico.id_tipo_servico, servico.data, {
        ignorarServicoEscalado: idServicoEscalado
      })
      .filter((e) => e.militar.id_militar !== servico.id_militar)
      .map((e) => ({
        id_militar: e.militar.id_militar,
        nome_guerra: e.militar.nome_guerra,
        nome_completo: e.militar.nome_completo,
        sigla_posto: e.militar.sigla_posto,
        dias_sem_servico: e.diasSemServico,
        sem_prioridade: e.semPrioridade
      }));
  }

  private validarAutomaticamente(
    solicitacao: { id_militar_substituto: number | null },
    servico: { id_tipo_servico: number; data: string; id_servico_escalado: number }
  ) {
    if (!solicitacao.id_militar_substituto) {
      return { apto: false, motivo: 'Troca aberta: nenhum substituto indicado pelo solicitante.' };
    }
    const militar = militarRepositorio.buscarPorId(solicitacao.id_militar_substituto);
    const tipoServico = tipoServicoRepositorio.buscarPorId(servico.id_tipo_servico);
    if (!militar || !tipoServico) return { apto: false, motivo: 'Cadastro indisponível.' };
    return this.validador.avaliar(militar, tipoServico, servico.data, {
      ignorarServicoEscalado: servico.id_servico_escalado,
      considerarTrancamento: true
    });
  }

  private exigirSubstitutoElegivel(
    idSubstituto: number,
    idTipoServico: number,
    data: string,
    idServicoEscalado: number
  ) {
    const militar = militarRepositorio.buscarPorId(idSubstituto);
    if (!militar) throw new ErroNaoEncontrado('Militar substituto');
    const tipoServico = tipoServicoRepositorio.buscarPorId(idTipoServico);
    if (!tipoServico) throw new ErroNaoEncontrado('Tipo de serviço');

    const resultado = this.validador.avaliar(militar, tipoServico, data, {
      ignorarServicoEscalado: idServicoEscalado,
      considerarTrancamento: true
    });
    if (!resultado.apto) {
      throw new ExcecaoElegibilidade(
        `${militar.sigla_posto} ${militar.nome_guerra} não pode assumir o serviço: ${resultado.motivo}`
      );
    }
  }

  private recalcularContadores(idsMilitares: number[], dataReferencia: string) {
    for (const idMilitar of idsMilitares) {
      const ultimo = escalaRepositorio.dataUltimoServicoAntesDe(idMilitar, `${dataReferencia}~`);
      if (!ultimo) continue;
      const dias = Math.round(
        (Date.parse(`${dataReferencia}T00:00:00Z`) - Date.parse(`${ultimo}T00:00:00Z`)) / 86_400_000
      );
      militarRepositorio.atualizar(idMilitar, { dias_sem_servico: Math.max(dias, 0) });
    }
  }
}

/** Generalização dos atores (seção 2): cada perfil acumula as funções do nível anterior. */
const escalaDePerfis: NomePerfil[] = [
  'MILITAR_ESCALADO',
  'SD_EP_SARGENTEACAO',
  'CABO_SARGENTEACAO',
  'SARGENTEANTE'
];

function perfilAtende(perfilDoUsuario: NomePerfil, perfilExigido: NomePerfil): boolean {
  return escalaDePerfis.indexOf(perfilDoUsuario) >= escalaDePerfis.indexOf(perfilExigido);
}
