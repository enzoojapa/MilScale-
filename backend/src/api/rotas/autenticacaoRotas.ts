import { Router } from 'express';
import { autenticacaoService } from '../../nucleo/seguranca/autenticacaoService';
import { produtoAtual } from '../../config/produto';
import { aplicacao } from '../../aplicacao';
import { autenticar, usuarioDaRequisicao } from '../middlewares/autenticar';
import { rotaAssincrona } from '../middlewares/tratarErros';
import { notificacaoRepositorio } from '../../infra/repositorios/notificacaoRepositorio';

export const autenticacaoRotas = Router();

autenticacaoRotas.post(
  '/login',
  rotaAssincrona((req, res) => {
    const { login, senha } = req.body ?? {};
    res.json(autenticacaoService.autenticar(String(login ?? ''), String(senha ?? '')));
  })
);

autenticacaoRotas.post(
  '/senha-provisoria',
  rotaAssincrona((req, res) => {
    const provisoria = autenticacaoService.gerarSenhaProvisoria(String(req.body?.cpf ?? ''));
    // Não há SMTP nesta entrega: a senha provisória volta na resposta para permitir a demonstração.
    res.json({
      mensagem: 'Senha provisória gerada e encaminhada ao contato cadastrado.',
      senhaProvisoria: provisoria
    });
  })
);

autenticacaoRotas.get(
  '/sessao',
  autenticar,
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json({
      usuario,
      produto: {
        codigo: produtoAtual.codigo,
        nome: produtoAtual.nomeExibicao,
        rotulos: produtoAtual.rotulos,
        regraElegibilidade: {
          identificador: aplicacao.plugins.regraElegibilidade.identificador,
          descricao: aplicacao.plugins.regraElegibilidade.descricao
        },
        fluxoAprovacao: aplicacao.solicitacaoTrocaService.fluxoConfigurado
      },
      notificacoesNaoLidas: notificacaoRepositorio.naoLidasDe(usuario.id_militar)
    });
  })
);

autenticacaoRotas.put(
  '/senha',
  autenticar,
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    autenticacaoService.alterarSenha(
      usuario.id_usuario,
      String(req.body?.senhaAtual ?? ''),
      String(req.body?.novaSenha ?? '')
    );
    res.json({ mensagem: 'Senha alterada.' });
  })
);
