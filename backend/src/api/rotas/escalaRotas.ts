import { Router } from 'express';
import { aplicacao } from '../../aplicacao';
import { escalaRepositorio } from '../../infra/repositorios/escalaRepositorio';
import { gerarPdfDaEscala } from '../../nucleo/relatorios/geradorPdfEscala';
import { auditoriaService } from '../../nucleo/auditoria/auditoriaService';
import { hojeISO, somarDias } from '../../nucleo/dominio/periodo';
import { autenticar, exigirPermissao, usuarioDaRequisicao } from '../middlewares/autenticar';
import { rotaAssincrona } from '../middlewares/tratarErros';

export const escalaRotas = Router();
escalaRotas.use(autenticar);

const { escalaService, geradorEscalaService, validadorElegibilidade } = aplicacao;

escalaRotas.get(
  '/',
  rotaAssincrona((_req, res) => res.json(escalaRepositorio.listar()))
);

/** UC05 – Gerar escala do período. */
escalaRotas.post(
  '/gerar',
  exigirPermissao('ESCALA_GERAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(
      geradorEscalaService.gerar({
        dataInicio: String(req.body?.dataInicio),
        dataFim: String(req.body?.dataFim),
        descricao: req.body?.descricao,
        idTipoServico: req.body?.idTipoServico ? Number(req.body.idTipoServico) : undefined,
        substituirRascunho: Boolean(req.body?.substituirRascunho),
        confirmarCicloAbaixoDoMinimo: Boolean(req.body?.confirmarCicloAbaixoDoMinimo),
        idUsuario: usuario.id_usuario
      })
    );
  })
);

escalaRotas.post(
  '/:id/publicar',
  exigirPermissao('ESCALA_PUBLICAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(geradorEscalaService.publicar(Number(req.params.id), usuario.id_usuario));
  })
);

escalaRotas.post(
  '/:id/encerrar',
  exigirPermissao('ESCALA_ALTERAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    geradorEscalaService.encerrar(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Escala encerrada.' });
  })
);

escalaRotas.delete(
  '/:id',
  exigirPermissao('ESCALA_GERAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    geradorEscalaService.descartarRascunho(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Rascunho descartado.' });
  })
);

escalaRotas.get(
  '/:id/servicos',
  rotaAssincrona((req, res) => res.json(escalaRepositorio.servicosDaEscala(Number(req.params.id))))
);

/** UC09 – Consulta da escala completa. */
escalaRotas.get(
  '/consulta/periodo',
  exigirPermissao('ESCALA_CONSULTAR_COMPLETA'),
  rotaAssincrona((req, res) => {
    res.json(
      escalaService.consultarPeriodo({
        inicio: String(req.query.inicio ?? hojeISO()),
        fim: String(req.query.fim ?? somarDias(hojeISO(), 30)),
        idTipoServico: req.query.idTipoServico ? Number(req.query.idTipoServico) : undefined,
        idMilitar: req.query.idMilitar ? Number(req.query.idMilitar) : undefined,
        incluirRascunho: req.query.incluirRascunho === 'true'
      })
    );
  })
);

/** UC08 – Consulta da escala própria (RN14: apenas escala publicada). */
escalaRotas.get(
  '/consulta/minha',
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      escalaService.consultarDoMilitar(
        usuario.id_militar,
        String(req.query.inicio ?? hojeISO()),
        String(req.query.fim ?? somarDias(hojeISO(), 60))
      )
    );
  })
);

/** UC06 – Alteração manual (privativa do sargenteante). */
escalaRotas.get(
  '/servicos/:id/elegiveis',
  exigirPermissao('ESCALA_ALTERAR', 'SOLICITACAO_TRIAR'),
  rotaAssincrona((req, res) => res.json(escalaService.elegiveisParaServico(Number(req.params.id))))
);

escalaRotas.put(
  '/servicos/:id',
  exigirPermissao('ESCALA_ALTERAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      escalaService.alterarManualmente({
        idServicoEscalado: Number(req.params.id),
        idMilitarSubstituto:
          req.body?.idMilitarSubstituto === null || req.body?.idMilitarSubstituto === undefined
            ? null
            : Number(req.body.idMilitarSubstituto),
        justificativa: String(req.body?.justificativa ?? ''),
        idUsuario: usuario.id_usuario
      })
    );
  })
);

escalaRotas.post(
  '/servicos/permutar',
  exigirPermissao('ESCALA_ALTERAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    escalaService.permutar({
      idServicoA: Number(req.body?.idServicoA),
      idServicoB: Number(req.body?.idServicoB),
      justificativa: String(req.body?.justificativa ?? ''),
      idUsuario: usuario.id_usuario
    });
    res.json({ mensagem: 'Permuta registrada.' });
  })
);

/** UC07 – Trancar / destrancar dia. */
escalaRotas.post(
  '/dias/:id/trancar',
  exigirPermissao('DIA_TRANCAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      escalaService.trancarDia({
        idDiaEscala: Number(req.params.id),
        motivo: String(req.body?.motivo ?? ''),
        indeferirPendentes: Boolean(req.body?.indeferirPendentes),
        idUsuario: usuario.id_usuario
      })
    );
  })
);

escalaRotas.post(
  '/dias/:id/destrancar',
  exigirPermissao('DIA_TRANCAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    escalaService.destrancarDia(
      Number(req.params.id),
      String(req.body?.justificativa ?? ''),
      usuario.id_usuario
    );
    res.json({ mensagem: 'Dia destrancado; as trocas voltam a ser aceitas.' });
  })
);

/** UC07-A2 – trancamento em lote de um intervalo de datas. */
escalaRotas.post(
  '/dias/trancar-intervalo',
  exigirPermissao('DIA_TRANCAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      escalaService.trancarIntervalo({
        inicio: String(req.body?.inicio),
        fim: String(req.body?.fim),
        motivo: String(req.body?.motivo ?? ''),
        indeferirPendentes: Boolean(req.body?.indeferirPendentes),
        idUsuario: usuario.id_usuario
      })
    );
  })
);

/** UC17 – Histórico de serviços com totalizadores. */
escalaRotas.get(
  '/historico/:idMilitar',
  exigirPermissao('HISTORICO_CONSULTAR'),
  rotaAssincrona((req, res) => {
    res.json(
      escalaService.historicoDoMilitar(
        Number(req.params.idMilitar),
        String(req.query.inicio ?? somarDias(hojeISO(), -180)),
        String(req.query.fim ?? hojeISO())
      )
    );
  })
);

/** UC15 exposto para conferência: lista de aptos e o motivo de cada inapto. */
escalaRotas.get(
  '/elegibilidade',
  exigirPermissao('ESCALA_CONSULTAR_COMPLETA'),
  rotaAssincrona((req, res) => {
    const idTipoServico = Number(req.query.idTipoServico);
    const data = String(req.query.data ?? hojeISO());
    res.json({
      regraAplicada: {
        identificador: validadorElegibilidade.regraAplicada.identificador,
        descricao: validadorElegibilidade.regraAplicada.descricao
      },
      aptos: validadorElegibilidade.listarElegiveis(idTipoServico, data),
      inaptos: validadorElegibilidade.motivosDeInaptidao(idTipoServico, data)
    });
  })
);

/** UC18 – Exportação da escala publicada em PDF. */
escalaRotas.get(
  '/exportar/pdf',
  exigirPermissao('ESCALA_EXPORTAR'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    const inicio = String(req.query.inicio ?? hojeISO());
    const fim = String(req.query.fim ?? somarDias(hojeISO(), 30));

    const documento = gerarPdfDaEscala({
      inicio,
      fim,
      idTipoServico: req.query.idTipoServico ? Number(req.query.idTipoServico) : undefined,
      responsavel: `${usuario.sigla_posto} ${usuario.nome_guerra}`
    });

    auditoriaService.registrar({
      idUsuario: usuario.id_usuario,
      entidade: 'ESCALA',
      idRegistro: 0,
      acao: 'ACESSO',
      valorNovo: { exportacao: 'PDF', periodo: `${inicio} a ${fim}` }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="escala-${inicio}-a-${fim}.pdf"`);
    documento.pipe(res);
  })
);
