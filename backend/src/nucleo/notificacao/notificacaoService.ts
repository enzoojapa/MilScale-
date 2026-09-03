import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { notificacaoRepositorio } from '../../infra/repositorios/notificacaoRepositorio';
import { solicitacaoRepositorio } from '../../infra/repositorios/solicitacaoRepositorio';
import { agoraISO, formatarDataBr, somarDias } from '../dominio/periodo';
import { rotuloSituacao } from '../trocas/maquinaEstados';
import type { SituacaoSolicitacao, TipoNotificacao } from '../dominio/tipos';
import type { CanalEntrega } from './canal';

export interface ResumoRotinaD1 {
  dataAlvo: string;
  militaresApurados: number;
  notificacoesEnviadas: number;
  falhas: { nomeGuerra: string; motivo: string }[];
  jaNotificados: number;
  observacao?: string;
}

export class NotificacaoService {
  constructor(private readonly canais: CanalEntrega[]) {}

  private despachar(
    idMilitar: number,
    tipo: TipoNotificacao,
    titulo: string,
    mensagem: string
  ): { entregues: number; falhas: string[] } {
    const militar = militarRepositorio.buscarPorId(idMilitar);
    if (!militar) return { entregues: 0, falhas: ['Militar inexistente.'] };

    let entregues = 0;
    const falhas: string[] = [];
    for (const canal of this.canais) {
      const contato = canal.canal === 'EMAIL' ? militar.email : militar.telefone ?? militar.email;
      const resultado = canal.enviar({
        idMilitar,
        destinatario: `${militar.sigla_posto} ${militar.nome_guerra}`,
        contato,
        titulo,
        mensagem
      });
      notificacaoRepositorio.inserir({
        id_militar: idMilitar,
        tipo,
        titulo,
        mensagem,
        canal: canal.canal,
        data_envio: agoraISO(),
        situacao_envio: resultado.entregue ? 'ENVIADA' : 'FALHA'
      });
      if (resultado.entregue) entregues += 1;
      else falhas.push(resultado.detalhe ?? 'Falha no envio.');
    }
    return { entregues, falhas };
  }

  /**
   * UC20 – rotina temporizada que apura os militares de serviço no dia seguinte e aciona UC14.
   * O agendador chama este método; a sargenteação também pode dispará-lo manualmente (UC20-A1).
   */
  executarRotinaD1(dataReferencia: string): ResumoRotinaD1 {
    const dataAlvo = somarDias(dataReferencia, 1);
    const servicos = escalaRepositorio.servicosPorPeriodo({ inicio: dataAlvo, fim: dataAlvo });

    if (servicos.length === 0) {
      return {
        dataAlvo,
        militaresApurados: 0,
        notificacoesEnviadas: 0,
        falhas: [],
        jaNotificados: 0,
        observacao: 'Não há escala publicada para o dia seguinte; rotina encerrada sem envio.'
      };
    }

    const resumo: ResumoRotinaD1 = {
      dataAlvo,
      militaresApurados: 0,
      notificacoesEnviadas: 0,
      falhas: [],
      jaNotificados: 0
    };

    for (const servico of servicos) {
      // UC20-4: serviços pendentes e posições com troca em análise ficam de fora da relação.
      if (!servico.id_militar) continue;
      if (solicitacaoRepositorio.pendentePara(servico.id_servico_escalado)) continue;

      resumo.militaresApurados += 1;
      const referencia = `${formatarDataBr(dataAlvo)} - ${servico.nome_tipo_servico}`;

      // UC20-A2: o reprocessamento não duplica avisos já entregues.
      if (notificacaoRepositorio.jaNotificado(servico.id_militar, 'SERVICO_D1', referencia)) {
        resumo.jaNotificados += 1;
        continue;
      }

      const posicao = servico.posicao ? ` na posição ${servico.posicao}` : '';
      const envio = this.despachar(
        servico.id_militar,
        'SERVICO_D1',
        'Serviço amanhã',
        `Você está escalado para ${referencia}${posicao}, com apresentação às ${servico.hora_inicio}. ` +
          `Turno de ${servico.duracao_horas} horas.`
      );
      if (envio.entregues > 0) resumo.notificacoesEnviadas += 1;
      for (const falha of envio.falhas) {
        resumo.falhas.push({
          nomeGuerra: `${servico.sigla_posto} ${servico.nome_guerra}`,
          motivo: falha
        });
      }
    }

    return resumo;
  }

  notificarPublicacaoDeEscala(idEscala: number): number {
    const servicos = escalaRepositorio.servicosDaEscala(idEscala);
    const militares = new Set(servicos.filter((s) => s.id_militar).map((s) => s.id_militar as number));
    for (const idMilitar of militares) {
      const doMilitar = servicos.filter((s) => s.id_militar === idMilitar);
      this.despachar(
        idMilitar,
        'ESCALA_PUBLICADA',
        'Escala publicada',
        `A escala do período foi publicada. Você tem ${doMilitar.length} serviço(s) previsto(s), ` +
          `a começar por ${formatarDataBr(doMilitar[0].data)} (${doMilitar[0].nome_tipo_servico}).`
      );
    }
    return militares.size;
  }

  /** RF21 — comunica solicitante e substituto a cada mudança de situação da solicitação. */
  notificarMudancaDeSituacao(
    idSolicitacao: number,
    situacao: SituacaoSolicitacao,
    complemento?: string
  ): void {
    const solicitacao = solicitacaoRepositorio.buscarPorId(idSolicitacao);
    if (!solicitacao) return;

    const mensagem =
      `Sua solicitação de troca do serviço de ${solicitacao.nome_tipo_servico} em ` +
      `${formatarDataBr(solicitacao.data_servico)} está agora em "${rotuloSituacao[situacao]}".` +
      (complemento ? ` ${complemento}` : '');

    this.despachar(
      solicitacao.id_militar_solicitante,
      'STATUS_SOLICITACAO',
      'Solicitação de troca atualizada',
      mensagem
    );

    if (solicitacao.id_militar_substituto && situacao === 'AUTORIZADA') {
      this.despachar(
        solicitacao.id_militar_substituto,
        'STATUS_SOLICITACAO',
        'Você assumiu um serviço',
        `Você foi confirmado no serviço de ${solicitacao.nome_tipo_servico} em ` +
          `${formatarDataBr(solicitacao.data_servico)}, às ${solicitacao.hora_inicio}.`
      );
    }
  }

  notificarPerfil(idMilitar: number, titulo: string, mensagem: string): void {
    this.despachar(idMilitar, 'STATUS_SOLICITACAO', titulo, mensagem);
  }
}
