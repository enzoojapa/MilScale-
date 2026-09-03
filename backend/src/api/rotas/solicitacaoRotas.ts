import { Router } from 'express';
import { aplicacao } from '../../aplicacao';
import { autenticar, exigirPermissao, usuarioDaRequisicao } from '../middlewares/autenticar';
import { rotaAssincrona } from '../middlewares/tratarErros';

export const solicitacaoRotas = Router();
solicitacaoRotas.use(autenticar);

const { solicitacaoTrocaService } = aplicacao;

/** Descreve o fluxo configurado para o produto — é o que a interface usa para montar as telas. */
solicitacaoRotas.get(
  '/fluxo',
  rotaAssincrona((_req, res) => res.json(solicitacaoTrocaService.fluxoConfigurado))
);

/**
 * UC13 (sargenteação: todas) e UC19 (militar escalado: apenas as próprias).
 * A RN19 é aplicada aqui: sem a permissão de consulta ampla, a listagem é restrita ao solicitante.
 */
solicitacaoRotas.get(
  '/',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    const podeVerTodas = usuario.permissoes.includes('SOLICITACAO_CONSULTAR_TODAS');
    const somenteProprias = req.query.somenteProprias === 'true';
    res.json(
      solicitacaoTrocaService.listar({
        situacao: req.query.situacao ? String(req.query.situacao) : undefined,
        inicio: req.query.inicio ? String(req.query.inicio) : undefined,
        fim: req.query.fim ? String(req.query.fim) : undefined,
        restringirAoMilitar: podeVerTodas && !somenteProprias ? undefined : usuario.id_militar
      })
    );
  })
);

solicitacaoRotas.get(
  '/:id',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(solicitacaoTrocaService.detalhar(Number(req.params.id), usuario));
  })
);

/** UC10 – Solicitar troca de serviço. */
solicitacaoRotas.post(
  '/',
  exigirPermissao('SOLICITACAO_REGISTRAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(
      solicitacaoTrocaService.registrar({
        idServicoEscalado: Number(req.body?.idServicoEscalado),
        idMilitarSolicitante: usuario.id_militar,
        idMilitarSubstituto: req.body?.idMilitarSubstituto ? Number(req.body.idMilitarSubstituto) : null,
        motivo: String(req.body?.motivo ?? ''),
        idUsuario: usuario.id_usuario
      })
    );
  })
);

solicitacaoRotas.get(
  '/servicos/:idServico/substitutos',
  rotaAssincrona((req, res) =>
    res.json(solicitacaoTrocaService.substitutosPossiveis(Number(req.params.idServico)))
  )
);

solicitacaoRotas.post(
  '/:id/cancelar',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    solicitacaoTrocaService.cancelar(Number(req.params.id), usuario);
    res.json({ mensagem: 'Solicitação cancelada.' });
  })
);

/**
 * UC11 e UC12 – registro de parecer.
 *
 * Uma única rota atende às duas etapas da cadeia: quem determina qual etapa está em curso e se o
 * perfil do usuário responde por ela é a estratégia de aprovação do produto.
 */
solicitacaoRotas.post(
  '/:id/parecer',
  exigirPermissao('SOLICITACAO_TRIAR', 'SOLICITACAO_AUTORIZAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      solicitacaoTrocaService.avaliar({
        idSolicitacao: Number(req.params.id),
        decisao: req.body?.decisao,
        justificativa: String(req.body?.justificativa ?? ''),
        idMilitarSubstitutoSugerido:
          req.body?.idMilitarSubstitutoSugerido !== undefined
            ? Number(req.body.idMilitarSubstitutoSugerido)
            : undefined,
        usuario
      })
    );
  })
);
