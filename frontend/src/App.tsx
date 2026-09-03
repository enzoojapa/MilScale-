import { Navigate, Route, Routes } from 'react-router-dom';
import { useSessao } from './contextoSessao';
import { Layout } from './componentes/Layout';
import { Login } from './paginas/Login';
import { Painel } from './paginas/Painel';
import { MinhaEscala } from './paginas/MinhaEscala';
import { EscalaCompleta } from './paginas/EscalaCompleta';
import { GerarEscala } from './paginas/GerarEscala';
import { Trancamento } from './paginas/Trancamento';
import { Elegibilidade } from './paginas/Elegibilidade';
import { Historico } from './paginas/Historico';
import { Solicitacoes } from './paginas/Solicitacoes';
import { Militares } from './paginas/Militares';
import { Cursos } from './paginas/Cursos';
import { TiposServico } from './paginas/TiposServico';
import { Regras } from './paginas/Regras';
import { Missoes } from './paginas/Missoes';
import { Notificacoes } from './paginas/Notificacoes';
import { Auditoria } from './paginas/Auditoria';
import { AvaliacaoDeTroca } from './paginas/variacaoMilscale/AvaliacaoDeTroca';

/** Bloqueia a rota quando o perfil não possui a permissão — o servidor valida de novo (RNF02). */
function Protegida({ permissoes, children }: { permissoes: string[]; children: JSX.Element }) {
  const { temPermissao } = useSessao();
  return temPermissao(...permissoes) ? children : <Navigate to="/painel" replace />;
}

export function App() {
  const { sessao, carregando } = useSessao();

  if (carregando) {
    return <div className="vazio">Carregando o MilScale…</div>;
  }

  if (!sessao) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const fluxo = sessao.produto.fluxoAprovacao;
  const temEtapaDeTriagem = fluxo.etapas.some((etapa) => etapa.etapa === 'TRIAGEM');

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/login" element={<Navigate to="/painel" replace />} />
        <Route path="/painel" element={<Painel />} />
        <Route path="/minha-escala" element={<MinhaEscala />} />
        <Route path="/minhas-solicitacoes" element={<Solicitacoes somenteProprias />} />
        <Route path="/notificacoes" element={<Notificacoes />} />

        <Route
          path="/escala"
          element={
            <Protegida permissoes={['ESCALA_CONSULTAR_COMPLETA']}>
              <EscalaCompleta />
            </Protegida>
          }
        />
        <Route
          path="/gerar-escala"
          element={
            <Protegida permissoes={['ESCALA_GERAR']}>
              <GerarEscala />
            </Protegida>
          }
        />
        <Route
          path="/trancamento"
          element={
            <Protegida permissoes={['DIA_TRANCAR']}>
              <Trancamento />
            </Protegida>
          }
        />
        <Route
          path="/elegibilidade"
          element={
            <Protegida permissoes={['ESCALA_CONSULTAR_COMPLETA']}>
              <Elegibilidade />
            </Protegida>
          }
        />
        <Route
          path="/historico"
          element={
            <Protegida permissoes={['HISTORICO_CONSULTAR']}>
              <Historico />
            </Protegida>
          }
        />

        <Route
          path="/solicitacoes"
          element={
            <Protegida permissoes={['SOLICITACAO_CONSULTAR_TODAS']}>
              <Solicitacoes somenteProprias={false} />
            </Protegida>
          }
        />

        {/*
          Rotas da variação exclusiva do MilScale: só existem enquanto a estratégia de aprovação
          configurada declarar a etapa correspondente. Num produto de etapa única, a triagem
          desaparece do roteamento sem que nada mais precise mudar.
        */}
        {temEtapaDeTriagem && (
          <Route
            path="/triagem"
            element={
              <Protegida permissoes={['SOLICITACAO_TRIAR']}>
                <AvaliacaoDeTroca etapa="TRIAGEM" />
              </Protegida>
            }
          />
        )}
        <Route
          path="/autorizacao"
          element={
            <Protegida permissoes={['SOLICITACAO_AUTORIZAR']}>
              <AvaliacaoDeTroca etapa="AUTORIZACAO" />
            </Protegida>
          }
        />

        <Route
          path="/militares"
          element={
            <Protegida permissoes={['MILITAR_MANTER']}>
              <Militares />
            </Protegida>
          }
        />
        <Route
          path="/cursos"
          element={
            <Protegida permissoes={['MILITAR_MANTER']}>
              <Cursos />
            </Protegida>
          }
        />
        <Route
          path="/tipos-servico"
          element={
            <Protegida permissoes={['TIPO_SERVICO_MANTER']}>
              <TiposServico />
            </Protegida>
          }
        />
        <Route
          path="/regras"
          element={
            <Protegida permissoes={['REGRA_MANTER']}>
              <Regras />
            </Protegida>
          }
        />
        <Route
          path="/missoes"
          element={
            <Protegida permissoes={['MISSAO_MANTER']}>
              <Missoes />
            </Protegida>
          }
        />
        <Route
          path="/auditoria"
          element={
            <Protegida permissoes={['AUDITORIA_CONSULTAR']}>
              <Auditoria />
            </Protegida>
          }
        />

        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Route>
    </Routes>
  );
}
