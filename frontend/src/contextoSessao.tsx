import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, guardarToken, limparToken, tokenArmazenado } from './servicos/api';
import type { Sessao } from './servicos/tipos';

interface ContextoSessao {
  sessao: Sessao | null;
  carregando: boolean;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => void;
  recarregar: () => Promise<void>;
  temPermissao: (...codigos: string[]) => boolean;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, definirSessao] = useState<Sessao | null>(null);
  const [carregando, definirCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    if (!tokenArmazenado()) {
      definirSessao(null);
      definirCarregando(false);
      return;
    }
    try {
      definirSessao(await api.get<Sessao>('/auth/sessao'));
    } catch {
      limparToken();
      definirSessao(null);
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const entrar = useCallback(
    async (login: string, senha: string) => {
      const resposta = await api.post<{ token: string }>('/auth/login', { login, senha });
      guardarToken(resposta.token);
      await recarregar();
    },
    [recarregar]
  );

  const sair = useCallback(() => {
    limparToken();
    definirSessao(null);
  }, []);

  const valor = useMemo<ContextoSessao>(
    () => ({
      sessao,
      carregando,
      entrar,
      sair,
      recarregar,
      temPermissao: (...codigos: string[]) =>
        codigos.some((codigo) => sessao?.usuario.permissoes.includes(codigo) ?? false)
    }),
    [sessao, carregando, entrar, sair, recarregar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de ProvedorSessao.');
  return contexto;
}
