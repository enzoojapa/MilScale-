import { Router } from 'express';
import { militarService } from '../../nucleo/cadastros/militarService';
import { cursoService, tipoServicoService } from '../../nucleo/cadastros/tipoServicoService';
import { regraEscalaService } from '../../nucleo/cadastros/regraEscalaService';
import { missaoService } from '../../nucleo/cadastros/missaoService';
import { postoRepositorio } from '../../infra/repositorios/catalogoRepositorio';
import { usuarioRepositorio } from '../../infra/repositorios/usuarioRepositorio';
import { autenticar, exigirPermissao, usuarioDaRequisicao } from '../middlewares/autenticar';
import { rotaAssincrona } from '../middlewares/tratarErros';

export const cadastroRotas = Router();
cadastroRotas.use(autenticar);

cadastroRotas.get(
  '/postos',
  rotaAssincrona((_req, res) => res.json(postoRepositorio.listar()))
);

cadastroRotas.get(
  '/perfis',
  rotaAssincrona((_req, res) => res.json(usuarioRepositorio.listarPerfis()))
);

// --- UC02: militares ---------------------------------------------------------------------

cadastroRotas.get(
  '/militares',
  rotaAssincrona((req, res) => {
    res.json(
      militarService.listar({
        idPosto: req.query.idPosto ? Number(req.query.idPosto) : undefined,
        idCurso: req.query.idCurso ? Number(req.query.idCurso) : undefined,
        situacao: req.query.situacao ? String(req.query.situacao) : undefined,
        busca: req.query.busca ? String(req.query.busca) : undefined
      })
    );
  })
);

cadastroRotas.get(
  '/militares/:id',
  rotaAssincrona((req, res) => res.json(militarService.buscar(Number(req.params.id))))
);

cadastroRotas.post(
  '/militares',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(militarService.incluir(req.body, usuario.id_usuario));
  })
);

cadastroRotas.put(
  '/militares/:id',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(militarService.alterar(Number(req.params.id), req.body, usuario.id_usuario));
  })
);

cadastroRotas.post(
  '/militares/:id/inativar',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    militarService.inativar(Number(req.params.id), String(req.body?.motivo ?? ''), usuario.id_usuario);
    res.json({ mensagem: 'Militar inativado; o histórico de serviços foi preservado.' });
  })
);

cadastroRotas.post(
  '/militares/:id/reativar',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    militarService.reativar(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Militar reativado.' });
  })
);

// --- RF05: cursos ------------------------------------------------------------------------

cadastroRotas.get(
  '/cursos',
  rotaAssincrona((_req, res) => res.json(cursoService.listar()))
);

cadastroRotas.post(
  '/cursos',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    const id = cursoService.incluir(req.body?.nome, req.body?.descricao ?? null, usuario.id_usuario);
    res.status(201).json({ id_curso: id });
  })
);

cadastroRotas.put(
  '/cursos/:id',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    cursoService.alterar(Number(req.params.id), req.body?.nome, req.body?.descricao ?? null, usuario.id_usuario);
    res.json({ mensagem: 'Curso atualizado.' });
  })
);

cadastroRotas.delete(
  '/cursos/:id',
  exigirPermissao('MILITAR_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    cursoService.excluir(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Curso excluído.' });
  })
);

// --- UC03: tipos de serviço ---------------------------------------------------------------

cadastroRotas.get(
  '/tipos-servico',
  rotaAssincrona((req, res) => res.json(tipoServicoService.listar(req.query.ativos === 'true')))
);

cadastroRotas.post(
  '/tipos-servico',
  exigirPermissao('TIPO_SERVICO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(tipoServicoService.incluir(req.body, usuario.id_usuario));
  })
);

cadastroRotas.put(
  '/tipos-servico/:id',
  exigirPermissao('TIPO_SERVICO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(tipoServicoService.alterar(Number(req.params.id), req.body, usuario.id_usuario));
  })
);

// --- UC04: regras da escala ---------------------------------------------------------------

cadastroRotas.get(
  '/regras',
  rotaAssincrona((_req, res) => res.json(regraEscalaService.listar()))
);

cadastroRotas.post(
  '/regras',
  exigirPermissao('REGRA_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(regraEscalaService.incluir(req.body, usuario.id_usuario));
  })
);

cadastroRotas.put(
  '/regras/:id',
  exigirPermissao('REGRA_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(regraEscalaService.alterar(Number(req.params.id), req.body, usuario.id_usuario));
  })
);

cadastroRotas.post(
  '/regras/:id/encerrar',
  exigirPermissao('REGRA_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    regraEscalaService.encerrarVigencia(Number(req.params.id), String(req.body?.vigencia_fim), usuario.id_usuario);
    res.json({ mensagem: 'Vigência encerrada.' });
  })
);

// --- UC16: missões e impedimentos ---------------------------------------------------------

cadastroRotas.get(
  '/missoes',
  rotaAssincrona((req, res) => {
    res.json(
      missaoService.listar({
        idMilitar: req.query.idMilitar ? Number(req.query.idMilitar) : undefined,
        a_partir_de: req.query.aPartirDe ? String(req.query.aPartirDe) : undefined
      })
    );
  })
);

cadastroRotas.post(
  '/missoes',
  exigirPermissao('MISSAO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.status(201).json(missaoService.incluir(req.body, usuario.id_usuario));
  })
);

cadastroRotas.put(
  '/missoes/:id',
  exigirPermissao('MISSAO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    missaoService.alterar(Number(req.params.id), req.body, usuario.id_usuario);
    res.json({ mensagem: 'Impedimento atualizado.' });
  })
);

cadastroRotas.post(
  '/missoes/:id/encerrar',
  exigirPermissao('MISSAO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    missaoService.encerrarAntecipadamente(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Impedimento encerrado; o militar retorna à fila sem prioridade.' });
  })
);

cadastroRotas.delete(
  '/missoes/:id',
  exigirPermissao('MISSAO_MANTER'),
  rotaAssincrona((req, res) => {
    const usuario = usuarioDaRequisicao(req);
    missaoService.excluir(Number(req.params.id), usuario.id_usuario);
    res.json({ mensagem: 'Impedimento excluído.' });
  })
);
