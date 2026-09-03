import { ambiente } from './config/ambiente';
import { aplicacao } from './aplicacao';
import { hojeISO } from './nucleo/dominio/periodo';

/**
 * Ator "Agendador do Sistema" (UC20). Verifica a cada minuto se chegou o horário parametrizado
 * (RN10, padrão 20h) e, uma vez por dia, aciona a apuração dos militares de serviço no dia
 * seguinte, que por sua vez inclui UC14.
 */
let ultimaExecucao: string | null = null;

export function iniciarAgendador(): void {
  const [horaAlvo, minutoAlvo] = ambiente.horaNotificacaoD1.split(':').map(Number);

  setInterval(() => {
    const agora = new Date();
    const hoje = hojeISO();
    if (ultimaExecucao === hoje) return;
    if (agora.getHours() !== horaAlvo || agora.getMinutes() < minutoAlvo) return;

    ultimaExecucao = hoje;
    const resumo = aplicacao.notificacaoService.executarRotinaD1(hoje);
    console.log(
      `[agendador] rotina D-1 de ${resumo.dataAlvo}: ${resumo.notificacoesEnviadas} notificação(ões), ` +
        `${resumo.falhas.length} falha(s).`
    );
  }, 60_000).unref();

  console.log(`Agendador D-1 ativo para as ${ambiente.horaNotificacaoD1}.`);
}
