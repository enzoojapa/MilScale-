import type { CanalNotificacao } from '../dominio/tipos';

export interface MensagemNotificacao {
  idMilitar: number;
  destinatario: string;
  contato: string | null;
  titulo: string;
  mensagem: string;
}

export interface ResultadoEnvio {
  entregue: boolean;
  detalhe?: string;
}

/** Ativo reutilizável 6 — canal de entrega injetável (e-mail, push ou caixa interna). */
export interface CanalEntrega {
  readonly canal: CanalNotificacao;
  enviar(mensagem: MensagemNotificacao): ResultadoEnvio;
}

/** Entrega na caixa de mensagens do próprio sistema: sempre disponível, sem serviço externo. */
export class CanalSistema implements CanalEntrega {
  readonly canal: CanalNotificacao = 'SISTEMA';
  enviar(): ResultadoEnvio {
    return { entregue: true };
  }
}

/**
 * Simulação do ator externo "Serviço de Notificação". Não há SMTP nesta entrega: o envio é
 * registrado na fila de saída e a falha por contato ausente (UC14-E2) é reproduzida fielmente.
 */
export class CanalEmailSimulado implements CanalEntrega {
  readonly canal: CanalNotificacao = 'EMAIL';
  private readonly filaDeSaida: { destino: string; titulo: string; momento: string }[] = [];

  enviar(mensagem: MensagemNotificacao): ResultadoEnvio {
    if (!mensagem.contato) {
      return { entregue: false, detalhe: 'Militar sem contato de e-mail cadastrado.' };
    }
    this.filaDeSaida.push({
      destino: mensagem.contato,
      titulo: mensagem.titulo,
      momento: new Date().toISOString()
    });
    return { entregue: true };
  }

  get saida() {
    return [...this.filaDeSaida];
  }
}
