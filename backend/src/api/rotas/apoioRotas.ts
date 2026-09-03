import { Router } from 'express';
import { aplicacao } from '../../aplicacao';
import { auditoriaService } from '../../nucleo/auditoria/auditoriaService';
import { notificacaoRepositorio } from '../../infra/repositorios/notificacaoRepositorio';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { militarRepositorio } from '../../infra/repositorios/militarRepositorio';
import { solicitacaoRepositorio } from '../../infra/repositorios/solicitacaoRepositorio';
import { hojeISO, somarDias } from '../../nucleo/dominio/periodo';
import { autenticar, exigirPermissao, usuarioDaRequisicao } from '../middlewares/autenticar';
import { rotaAssincrona } from '../middlewares/tratarErros';

export const apoioRotas = Router();
apoioRotas.use(autenticar);

/** Painel inicial (UC01 passo 6): números do dia conforme o perfil do usuário. */
apoioRotas.get(
  '/painel',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    const hoje = hojeISO();
    const proximos = escalaRepositorio.servicosPorPeriodo({
      inicio: hoje,
      fim: somarDias(hoje, 45),
      idMilitar: usuario.id_militar
    });

    const daSargenteacao = usuario.permissoes.includes('ESCALA_CONSULTAR_COMPLETA');
    const servicosDeHoje = daSargenteacao
      ? escalaRepositorio.servicosPorPeriodo({ inicio: hoje, fim: hoje })
      : [];

    return res.json({
      hoje,
      meusProximosServicos: proximos.slice(0, 5),
      totalMeusServicos: proximos.length,
      notificacoesNaoLidas: notificacaoRepositorio.naoLidasDe(usuario.id_militar),
      minhasSolicitacoesEmAndamento: solicitacaoRepositorio
        .listar({ idSolicitante: usuario.id_militar })
        .filter((s) => s.situacao === 'EM_ANALISE_CABO' || s.situacao === 'AGUARDANDO_SARGENTEANTE').length,
      sargenteacao: daSargenteacao
        ? {
            servicosDeHoje,
            pendenciasDeHoje: servicosDeHoje.filter((s) => !s.id_militar).length,
            efetivoAtivo: militarRepositorio.listar({ situacao: 'ATIVO' }).length,
            aguardandoTriagem: solicitacaoRepositorio.listar({ situacao: 'EM_ANALISE_CABO' }).length,
            aguardandoAutorizacao: solicitacaoRepositorio.listar({
              situacao: 'AGUARDANDO_SARGENTEANTE'
            }).length,
            escalas: escalaRepositorio.listar().slice(0, 5)
          }
        : null
    });
  })
);

// --- UC14 / UC20: notificações -------------------------------------------------------------

apoioRotas.get(
  '/notificacoes',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    const todas = req.query.todas === 'true' && usuario.permissoes.includes('NOTIFICACAO_DISPARAR');
    res.json(
      notificacaoRepositorio.listar({
        idMilitar: todas ? undefined : usuario.id_militar,
        tipo: req.query.tipo ? String(req.query.tipo) : undefined
      })
    );
  })
);

apoioRotas.post(
  '/notificacoes/:id/lida',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    notificacaoRepositorio.marcarComoLida(Number(req.params.id), usuario.id_militar);
    res.json({ mensagem: 'Notificação marcada como lida.' });
  })
);

/**
 * UC20 – rotina temporizada de apuração dos militares de serviço no dia seguinte, aqui exposta
 * também para disparo manual pela sargenteação (UC20-A1).
 */
apoioRotas.post(
  '/notificacoes/rotina-d1',
  exigirPermissao('NOTIFICACAO_DISPARAR'),
  rotaAssincrona((req, res) => {
    const referencia = String(req.body?.dataReferencia ?? hojeISO());
    res.json(aplicacao.notificacaoService.executarRotinaD1(referencia));
  })
);

// --- RF22: auditoria -----------------------------------------------------------------------

apoioRotas.get(
  '/auditoria',
  exigirPermissao('AUDITORIA_CONSULTAR'),
  rotaAssincrona((req, res) => {
    res.json({
      entidades: auditoriaService.entidades(),
      registros: auditoriaService.consultar({
        entidade: req.query.entidade ? String(req.query.entidade) : undefined,
        acao: req.query.acao ? String(req.query.acao) : undefined,
        limite: req.query.limite ? Number(req.query.limite) : 300
      })
    });
  })
);
