import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import { ambiente } from './config/ambiente';
import { produtoAtual } from './config/produto';
import { aplicacao } from './aplicacao';
import { autenticacaoRotas } from './api/rotas/autenticacaoRotas';
import { cadastroRotas } from './api/rotas/cadastroRotas';
import { escalaRotas } from './api/rotas/escalaRotas';
import { solicitacaoRotas } from './api/rotas/solicitacaoRotas';
import { apoioRotas } from './api/rotas/apoioRotas';
import { tratarErros } from './api/middlewares/tratarErros';
import { iniciarAgendador } from './agendador';

const servidor = express();
servidor.use(cors());
servidor.use(express.json());

servidor.get('/api/saude', (_req, res) => {
  res.json({
    produto: produtoAtual.codigo,
    regraElegibilidade: aplicacao.plugins.regraElegibilidade.identificador,
    estrategiaAprovacao: aplicacao.plugins.estrategiaAprovacaoTroca.identificador,
    banco: path.basename(ambiente.caminhoBanco)
  });
});

servidor.use('/api/auth', autenticacaoRotas);
servidor.use('/api/cadastros', cadastroRotas);
servidor.use('/api/escalas', escalaRotas);
servidor.use('/api/solicitacoes', solicitacaoRotas);
servidor.use('/api', apoioRotas);

// A interface compilada é servida pelo próprio backend quando existe (npm run build no frontend).
const interfaceCompilada = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(interfaceCompilada)) {
  servidor.use(express.static(interfaceCompilada));
  servidor.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(interfaceCompilada, 'index.html'));
  });
}

servidor.use(tratarErros);

servidor.listen(ambiente.porta, () => {
  console.log(`${produtoAtual.nomeExibicao} — API em http://localhost:${ambiente.porta}`);
  console.log(`Produto configurado: ${produtoAtual.codigo}`);
  console.log(`  elegibilidade   → ${aplicacao.plugins.regraElegibilidade.identificador}`);
  console.log(`  aprovação troca → ${aplicacao.plugins.estrategiaAprovacaoTroca.identificador}`);
  iniciarAgendador();
});
