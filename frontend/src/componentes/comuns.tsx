import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export function Cartao({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="cartao">
      {titulo && <h2>{titulo}</h2>}
      <div className="corpo">{children}</div>
    </section>
  );
}

export function Indicador({ valor, rotulo }: { valor: ReactNode; rotulo: string }) {
  return (
    <div className="indicador">
      <div className="valor">{valor}</div>
      <div className="rotulo">{rotulo}</div>
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'sucesso' | 'info'; children: ReactNode }) {
  if (!children) return null;
  return <div className={`aviso ${tipo}`}>{children}</div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

export function Modal({
  titulo,
  aoFechar,
  children,
  rodape
}: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => evento.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal">
        <header>
          <h3>{titulo}</h3>
          <button className="pequeno" onClick={aoFechar}>
            Fechar
          </button>
        </header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  );
}

const coresDeSituacao: Record<string, string> = {
  PUBLICADA: 'verde',
  RASCUNHO: 'ambar',
  ENCERRADA: 'neutra',
  ATIVO: 'verde',
  AFASTADO: 'ambar',
  DESLIGADO: 'vermelha',
  PREVISTO: 'azul',
  CUMPRIDO: 'verde',
  SUBSTITUIDO: 'neutra',
  EM_ANALISE_CABO: 'ambar',
  AGUARDANDO_SARGENTEANTE: 'azul',
  AUTORIZADA: 'verde',
  NEGADA: 'vermelha',
  CANCELADA: 'neutra',
  ENVIADA: 'azul',
  LIDA: 'verde',
  FALHA: 'vermelha',
  MISSAO: 'azul',
  DISPENSA: 'ambar',
  FERIAS: 'verde',
  OUTRO: 'neutra'
};

export function Etiqueta({ situacao, texto }: { situacao: string; texto?: string }) {
  return (
    <span className={`etiqueta ${coresDeSituacao[situacao] ?? 'neutra'}`}>
      {texto ?? situacao.replaceAll('_', ' ')}
    </span>
  );
}

/** Hook de carregamento com estado de erro, usado por todas as telas de consulta. */
export function useConsulta<T>(consultar: () => Promise<T>, dependencias: unknown[]) {
  const [dados, definirDados] = useState<T | null>(null);
  const [erro, definirErro] = useState('');
  const [carregando, definirCarregando] = useState(true);
  const [versao, definirVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    definirCarregando(true);
    consultar()
      .then((resultado) => !cancelado && (definirDados(resultado), definirErro('')))
      .catch((e) => !cancelado && definirErro(e.message))
      .finally(() => !cancelado && definirCarregando(false));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao]);

  return { dados, erro, carregando, recarregar: () => definirVersao((v) => v + 1), definirErro };
}

export function dataBr(data: string | null | undefined): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function dataHoraBr(valor: string | null | undefined): string {
  if (!valor) return '—';
  return `${dataBr(valor)} ${valor.slice(11, 16)}`;
}

export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function somarDias(data: string, dias: number): string {
  const referencia = new Date(`${data}T12:00:00Z`);
  referencia.setUTCDate(referencia.getUTCDate() + dias);
  return referencia.toISOString().slice(0, 10);
}

export function primeiroDiaDoMes(): string {
  return `${hoje().slice(0, 8)}01`;
}

export function ultimoDiaDoMes(): string {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth() + 1, 0)).toISOString().slice(0, 10);
}

const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function diaDaSemana(data: string): string {
  return diasDaSemana[new Date(`${data}T12:00:00Z`).getUTCDay()];
}
