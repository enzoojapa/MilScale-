const CHAVE_TOKEN = 'milscale.token';

export function tokenArmazenado(): string | null {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function guardarToken(token: string): void {
  localStorage.setItem(CHAVE_TOKEN, token);
}

export function limparToken(): void {
  localStorage.removeItem(CHAVE_TOKEN);
}

export class ErroApi extends Error {
  constructor(mensagem: string, readonly status: number, readonly codigo?: string) {
    super(mensagem);
  }
}

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = tokenArmazenado();
  const resposta = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers ?? {})
    }
  });

  if (resposta.status === 401 && tokenArmazenado()) {
    limparToken();
    window.location.href = '/login';
  }

  const conteudo = resposta.headers.get('content-type') ?? '';
  const corpo = conteudo.includes('application/json') ? await resposta.json() : await resposta.text();

  if (!resposta.ok) {
    const detalhe = typeof corpo === 'object' && corpo ? corpo : { mensagem: String(corpo) };
    throw new ErroApi(detalhe.mensagem ?? 'Falha na requisição.', resposta.status, detalhe.codigo);
  }
  return corpo as T;
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) }),
  put: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo ?? {}) }),
  remover: <T>(caminho: string) => requisitar<T>(caminho, { method: 'DELETE' }),

  baixarArquivo: async (caminho: string, nomeArquivo: string) => {
    const resposta = await fetch(`/api${caminho}`, {
      headers: { Authorization: `Bearer ${tokenArmazenado() ?? ''}` }
    });
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({ mensagem: 'Falha na exportação.' }));
      throw new ErroApi(erro.mensagem, resposta.status);
    }
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  }
};
