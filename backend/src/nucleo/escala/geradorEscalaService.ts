import { emTransacao } from '../../infra/banco';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { regraEscalaRepositorio } from '../../infra/repositorios/regraEscalaRepositorio';
import { tipoServicoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import type { TipoServicoDetalhado } from '../../infra/repositorios/catalogoRepositorio';
import { auditoriaService } from '../auditoria/auditoriaService';
import { ErroDeNegocio, ErroNaoEncontrado } from '../dominio/erros';
import { agoraISO, Periodo, formatarDataBr } from '../dominio/periodo';
import type { ValidadorElegibilidade } from '../elegibilidade/validadorElegibilidade';
import type { EstadoDoPeriodo } from '../elegibilidade/validadorElegibilidade';
import { calcularCiclo } from './calculadoraCiclo';
import type { CicloCalculado } from './calculadoraCiclo';
import type { NotificacaoService } from '../notificacao/notificacaoService';

export interface PendenciaGeracao {
  data: string;
  tipoServico: string;
  posicao: string;
  motivo: string;
}

export interface RelatorioGeracao {
  idEscala: number;
  descricao: string;
  periodo: { inicio: string; fim: string };
  situacao: string;
  ciclos: CicloCalculado[];
  totalServicosGerados: number;
  totalPendencias: number;
  pendencias: PendenciaGeracao[];
  alertas: string[];
  duracaoMs: number;
}

export interface ParametrosGeracao {
  dataInicio: string;
  dataFim: string;
  descricao?: string;
  /** UC05-A2: geração parcial de um único tipo de serviço. */
  idTipoServico?: number;
  /** UC05-A3: descarta o rascunho existente do período antes de gerar novamente. */
  substituirRascunho?: boolean;
  /** UC05-E5: confirma a geração mesmo com ciclo abaixo do mínimo da regra. */
  confirmarCicloAbaixoDoMinimo?: boolean;
  idUsuario: number;
}

/**
 * UC05 – Gerar escala do período.
 *
 * Reproduz o processo que hoje é feito na planilha do sargenteante: para cada dia e cada tipo de
 * serviço, escala o militar elegível com o maior contador de dias sem serviço (RN01), respeitando
 * impedimentos (RN15), a perda de prioridade no retorno (RN16), o intervalo mínimo (RN06) e a
 * proibição de dois serviços na mesma data (RN05). O ciclo do período é apurado pela RN20.
 */
export class GeradorEscalaService {
  constructor(
    private readonly validador: ValidadorElegibilidade,
    private readonly notificacoes: NotificacaoService
  ) {}

  gerar(parametros: ParametrosGeracao): RelatorioGeracao {
    const inicio = Date.now();
    const periodo = new Periodo(parametros.dataInicio, parametros.dataFim);

    if (periodo.quantidadeDias() > 92) {
      throw new ErroDeNegocio('O período de geração está limitado a 92 dias.');
    }

    const jaPublicada = escalaRepositorio.publicadaNoPeriodo(periodo.dataInicio, periodo.dataFim);
    if (jaPublicada) {
      throw new ErroDeNegocio(
        `Já existe a escala "${jaPublicada.descricao}" publicada sobre este período. ` +
          'Use a alteração manual (UC06) para ajustes pontuais.',
        409
      );
    }

    const rascunho = escalaRepositorio.rascunhoNoPeriodo(periodo.dataInicio, periodo.dataFim);
    if (rascunho && !parametros.substituirRascunho) {
      throw new ErroDeNegocio(
        `Já existe o rascunho "${rascunho.descricao}" para este período. Descarte-o para gerar novamente.`,
        409
      );
    }

    const tipos = this.tiposParaGerar(parametros.idTipoServico);
    const alertas: string[] = [];
    const ciclos: CicloCalculado[] = [];
    const tiposComRegra: { tipo: TipoServicoDetalhado; ciclo: CicloCalculado }[] = [];

    const estado = this.validador.criarEstadoDoPeriodo(periodo.dataInicio, periodo.dataFim);

    for (const tipo of tipos) {
      const regra = regraEscalaRepositorio.vigenteEm(tipo.id_tipo_servico, periodo.dataInicio);
      if (!regra) {
        // UC05-E3: sem regra vigente o serviço não é escalado, mas a geração prossegue.
        alertas.push(`Sem regra vigente para "${tipo.nome}": o serviço não foi escalado.`);
        continue;
      }
      const elegiveis = this.contarElegiveisNoPeriodo(tipo, periodo, estado);
      const ciclo = calcularCiclo({
        idTipoServico: tipo.id_tipo_servico,
        nomeTipoServico: tipo.nome,
        efetivoElegivel: elegiveis,
        efetivoDiarioExigido: tipo.efetivo_necessario,
        regra
      });
      ciclos.push(ciclo);
      if (ciclo.alerta) alertas.push(ciclo.alerta);
      tiposComRegra.push({ tipo, ciclo });
    }

    if (tiposComRegra.length === 0) {
      throw new ErroDeNegocio(
        'Nenhum tipo de serviço possui regra vigente no período; cadastre as regras antes de gerar a escala.'
      );
    }

    const abaixoDoMinimo = ciclos.filter((c) => c.abaixoDoMinimo);
    if (abaixoDoMinimo.length > 0 && !parametros.confirmarCicloAbaixoDoMinimo) {
      throw new ErroDeNegocio(
        'Efetivo insuficiente para manter o ciclo mínimo em: ' +
          abaixoDoMinimo.map((c) => c.nomeTipoServico).join(', ') +
          '. Confirme a geração para prosseguir mesmo assim.',
        409,
        'CICLO_ABAIXO_DO_MINIMO'
      );
    }

    const pendencias: PendenciaGeracao[] = [];
    let totalServicos = 0;

    const idEscala = emTransacao(() => {
      if (rascunho) escalaRepositorio.excluir(rascunho.id_escala);

      const descricao =
        parametros.descricao?.trim() ||
        `Escala ${formatarDataBr(periodo.dataInicio)} a ${formatarDataBr(periodo.dataFim)}`;

      const novaEscala = escalaRepositorio.inserir({
        descricao,
        data_inicio: periodo.dataInicio,
        data_fim: periodo.dataFim,
        situacao: 'RASCUNHO',
        data_geracao: agoraISO(),
        id_usuario_geracao: parametros.idUsuario
      });

      const contadores = this.carregarContadoresIniciais();

      for (const data of periodo.dias()) {
        const idDia = escalaRepositorio.inserirDia(novaEscala, data);
        const escaladosNoDia = new Set<number>();
        estado.escaladosPorData.set(data, escaladosNoDia);

        for (const { tipo } of tiposComRegra) {
          for (let vaga = 1; vaga <= tipo.efetivo_necessario; vaga += 1) {
            const posicao = tipo.efetivo_necessario > 1 ? `${tipo.nome} ${vaga}` : tipo.nome;
            const fila = this.validador.listarElegiveis(tipo.id_tipo_servico, data, {
              estado,
              contadores
            });
            const escolhido = fila[0];

            if (!escolhido) {
              // UC05-E1: sem militar elegível o dia é marcado como pendência e a geração segue.
              escalaRepositorio.inserirServico({
                id_dia_escala: idDia,
                id_tipo_servico: tipo.id_tipo_servico,
                id_militar: null,
                posicao,
                situacao: 'PREVISTO',
                observacao: 'Pendente: sem militar elegível e disponível.'
              });
              pendencias.push({
                data,
                tipoServico: tipo.nome,
                posicao,
                motivo: 'Sem militar elegível e disponível na data.'
              });
              continue;
            }

            escalaRepositorio.inserirServico({
              id_dia_escala: idDia,
              id_tipo_servico: tipo.id_tipo_servico,
              id_militar: escolhido.militar.id_militar,
              posicao,
              situacao: 'PREVISTO',
              observacao: escolhido.semPrioridade ? 'Retorno de impedimento, sem prioridade (RN16).' : null
            });
            totalServicos += 1;

            escaladosNoDia.add(escolhido.militar.id_militar);
            estado.ultimoServicoPorMilitar.set(escolhido.militar.id_militar, data);
          }
        }

        // Fecha o dia atualizando o contador de dias sem serviço de todo o efetivo (RF09).
        for (const [idMilitar, valor] of contadores) {
          contadores.set(idMilitar, escaladosNoDia.has(idMilitar) ? 0 : valor + 1);
        }
      }

      auditoriaService.registrar({
        idUsuario: parametros.idUsuario,
        entidade: 'ESCALA',
        idRegistro: novaEscala,
        acao: 'INCLUSAO',
        valorNovo: {
          descricao,
          periodo: `${periodo.dataInicio} a ${periodo.dataFim}`,
          servicos: totalServicos,
          pendencias: pendencias.length,
          ciclos: ciclos.map((c) => `${c.nomeTipoServico}: ${c.proporcao}`)
        }
      });

      return novaEscala;
    });

    return {
      idEscala,
      descricao: escalaRepositorio.buscarPorId(idEscala)?.descricao ?? '',
      periodo: { inicio: periodo.dataInicio, fim: periodo.dataFim },
      situacao: 'RASCUNHO',
      ciclos,
      totalServicosGerados: totalServicos,
      totalPendencias: pendencias.length,
      pendencias,
      alertas,
      duracaoMs: Date.now() - inicio
    };
  }

  /**
   * UC05 passos 9-10: publica o rascunho, consolida o contador de dias sem serviço no cadastro
   * dos militares e aciona a notificação da publicação.
   */
  publicar(idEscala: number, idUsuario: number): { militaresNotificados: number } {
    const escala = escalaRepositorio.buscarPorId(idEscala);
    if (!escala) throw new ErroNaoEncontrado('Escala');
    if (escala.situacao !== 'RASCUNHO') {
      throw new ErroDeNegocio('Somente escalas em rascunho podem ser publicadas.', 409);
    }

    emTransacao(() => {
      escalaRepositorio.alterarSituacao(idEscala, 'PUBLICADA');
      this.consolidarContadores(escala.data_fim);
      auditoriaService.registrar({
        idUsuario,
        entidade: 'ESCALA',
        idRegistro: idEscala,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: 'RASCUNHO' },
        valorNovo: { situacao: 'PUBLICADA' }
      });
    });

    return { militaresNotificados: this.notificacoes.notificarPublicacaoDeEscala(idEscala) };
  }

  descartarRascunho(idEscala: number, idUsuario: number): void {
    const escala = escalaRepositorio.buscarPorId(idEscala);
    if (!escala) throw new ErroNaoEncontrado('Escala');
    if (escala.situacao !== 'RASCUNHO') {
      throw new ErroDeNegocio('Apenas rascunhos podem ser descartados.', 409);
    }
    emTransacao(() => {
      escalaRepositorio.excluir(idEscala);
      auditoriaService.registrar({
        idUsuario,
        entidade: 'ESCALA',
        idRegistro: idEscala,
        acao: 'EXCLUSAO',
        valorAnterior: escala
      });
    });
  }

  encerrar(idEscala: number, idUsuario: number): void {
    const escala = escalaRepositorio.buscarPorId(idEscala);
    if (!escala) throw new ErroNaoEncontrado('Escala');
    if (escala.situacao !== 'PUBLICADA') {
      throw new ErroDeNegocio('Somente escalas publicadas podem ser encerradas.', 409);
    }
    emTransacao(() => {
      escalaRepositorio.alterarSituacao(idEscala, 'ENCERRADA');
      auditoriaService.registrar({
        idUsuario,
        entidade: 'ESCALA',
        idRegistro: idEscala,
        acao: 'ALTERACAO',
        valorAnterior: { situacao: 'PUBLICADA' },
        valorNovo: { situacao: 'ENCERRADA' }
      });
    });
  }

  private tiposParaGerar(idTipoServico?: number): TipoServicoDetalhado[] {
    if (idTipoServico) {
      const tipo = tipoServicoRepositorio.buscarPorId(idTipoServico);
      if (!tipo) throw new ErroNaoEncontrado('Tipo de serviço');
      if (!tipo.ativo) throw new ErroDeNegocio('Tipo de serviço inativo.');
      return [tipo];
    }
    return tipoServicoRepositorio.listar(true);
  }

  /**
   * Efetivo elegível do período: militares que atendem posto e cursos do serviço e que não estão
   * impedidos durante todo o intervalo. É esse número que alimenta o cálculo do ciclo (RN20).
   */
  private contarElegiveisNoPeriodo(
    tipo: TipoServicoDetalhado,
    periodo: Periodo,
    estado: EstadoDoPeriodo
  ): number {
    const candidatos = militarRepositorio.listar({ situacao: 'ATIVO' });
    let total = 0;
    for (const militar of candidatos) {
      const doProduto = this.validador.regraAplicada.avaliar({
        militar,
        tipoServico: tipo,
        data: periodo.dataInicio,
        cursosDoMilitar: militar.cursos.map((c) => c.id_curso)
      });
      if (!doProduto.apto) continue;

      const missoes = estado.missoesPorMilitar.get(militar.id_militar) ?? [];
      const impedidoTodoOPeriodo = missoes.some(
        (m) => m.data_inicio <= periodo.dataInicio && m.data_fim >= periodo.dataFim
      );
      if (!impedidoTodoOPeriodo) total += 1;
    }
    return total;
  }

  private carregarContadoresIniciais(): Map<number, number> {
    const contadores = new Map<number, number>();
    for (const militar of militarRepositorio.listar({ situacao: 'ATIVO' })) {
      contadores.set(militar.id_militar, militar.dias_sem_servico);
    }
    return contadores;
  }

  /** RF09 — grava no cadastro o contador de dias sem serviço apurado até o fim do período. */
  private consolidarContadores(dataReferencia: string): void {
    for (const militar of militarRepositorio.listar({ situacao: 'ATIVO' })) {
      const ultimo = escalaRepositorio.dataUltimoServicoAntesDe(
        militar.id_militar,
        `${dataReferencia}~`
      );
      const dias = ultimo
        ? Math.max(diasEntre(ultimo, dataReferencia), 0)
        : militar.dias_sem_servico;
      militarRepositorio.atualizar(militar.id_militar, { dias_sem_servico: dias });
    }
  }
}

function diasEntre(de: string, ate: string): number {
  const inicio = Date.parse(`${de}T00:00:00Z`);
  const fim = Date.parse(`${ate}T00:00:00Z`);
  return Math.round((fim - inicio) / 86_400_000);
}
