import path from 'node:path';
import fs from 'node:fs';

function carregarArquivoEnv(): void {
  const caminho = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(caminho)) return;
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const separador = limpa.indexOf('=');
    if (separador < 0) continue;
    const chave = limpa.slice(0, separador).trim();
    if (process.env[chave] === undefined) {
      process.env[chave] = limpa.slice(separador + 1).trim();
    }
  }
}

carregarArquivoEnv();

export const ambiente = {
  porta: Number(process.env.PORTA ?? 3333),
  caminhoBanco: path.resolve(__dirname, '..', '..', process.env.CAMINHO_BANCO ?? 'milscale.db'),
  segredoJwt: process.env.SEGREDO_JWT ?? 'milscale-desenvolvimento',
  horaNotificacaoD1: process.env.HORA_NOTIFICACAO_D1 ?? '20:00',
  organizacaoMilitar: process.env.ORGANIZACAO_MILITAR ?? '5º Batalhão de Infantaria - Curitiba/PR'
};
