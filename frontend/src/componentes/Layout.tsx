import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSessao } from '../contextoSessao';

interface ItemMenu {
  para: string;
  rotulo: string;
  permissoes?: string[];
  /** Marca as telas que só existem no produto militar (feature exclusiva RF12b). */
  exclusivaDoProduto?: boolean;
}

interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

const grupos: GrupoMenu[] = [
  {
    titulo: 'Minha rotina',
    itens: [
      { para: '/painel', rotulo: 'Painel' },
      { para: '/minha-escala', rotulo: 'Minha escala' },
      { para: '/minhas-solicitacoes', rotulo: 'Minhas solicitações' },
      { para: '/notificacoes', rotulo: 'Notificações' }
    ]
  },
  {
    titulo: 'Escala',
    itens: [
      { para: '/escala', rotulo: 'Escala do dia', permissoes: ['ESCALA_CONSULTAR_COMPLETA'] },
      { para: '/gerar-escala', rotulo: 'Gerar escala', permissoes: ['ESCALA_GERAR'] },
      { para: '/trancamento', rotulo: 'Trancar dias', permissoes: ['DIA_TRANCAR'] },
      { para: '/elegibilidade', rotulo: 'Validar elegibilidade', permissoes: ['ESCALA_CONSULTAR_COMPLETA'] },
      { para: '/historico', rotulo: 'Histórico de serviços', permissoes: ['HISTORICO_CONSULTAR'] }
    ]
  },
  {
    titulo: 'Trocas de serviço',
    itens: [
      { para: '/solicitacoes', rotulo: 'Todas as solicitações', permissoes: ['SOLICITACAO_CONSULTAR_TODAS'] },
      {
        para: '/triagem',
        rotulo: 'Triagem do cabo',
        permissoes: ['SOLICITACAO_TRIAR'],
        exclusivaDoProduto: true
      },
      {
        para: '/autorizacao',
        rotulo: 'Autorização final',
        permissoes: ['SOLICITACAO_AUTORIZAR'],
        exclusivaDoProduto: true
      }
    ]
  },
  {
    titulo: 'Cadastros',
    itens: [
      { para: '/militares', rotulo: 'Militares', permissoes: ['MILITAR_MANTER'] },
      { para: '/cursos', rotulo: 'Cursos e qualificações', permissoes: ['MILITAR_MANTER'] },
      { para: '/tipos-servico', rotulo: 'Tipos de serviço', permissoes: ['TIPO_SERVICO_MANTER'] },
      { para: '/regras', rotulo: 'Regras da escala', permissoes: ['REGRA_MANTER'] },
      { para: '/missoes', rotulo: 'Missões e impedimentos', permissoes: ['MISSAO_MANTER'] },
      { para: '/auditoria', rotulo: 'Trilha de auditoria', permissoes: ['AUDITORIA_CONSULTAR'] }
    ]
  }
];

const titulosPorRota: Record<string, { titulo: string; descricao: string }> = {
  '/painel': { titulo: 'Painel', descricao: 'Situação do serviço e das suas pendências.' },
  '/minha-escala': { titulo: 'Minha escala', descricao: 'UC08 — dias em que você está escalado.' },
  '/minhas-solicitacoes': {
    titulo: 'Minhas solicitações',
    descricao: 'UC19 — acompanhamento das trocas que você registrou.'
  },
  '/notificacoes': { titulo: 'Notificações', descricao: 'UC14 — avisos de serviço e de troca.' },
  '/escala': { titulo: 'Escala do dia', descricao: 'UC09 — efetivo escalado por dia e tipo de serviço.' },
  '/gerar-escala': { titulo: 'Gerar escala', descricao: 'UC05 — geração automática por rotatividade.' },
  '/trancamento': { titulo: 'Trancar e destrancar dias', descricao: 'UC07 — bloqueio de trocas em uma data.' },
  '/elegibilidade': {
    titulo: 'Validar elegibilidade',
    descricao: 'UC15 — quem pode assumir cada serviço e por quê.'
  },
  '/historico': { titulo: 'Histórico de serviços', descricao: 'UC17 — serviços cumpridos e totalizadores.' },
  '/solicitacoes': { titulo: 'Solicitações de troca', descricao: 'UC13 — situação de todas as solicitações.' },
  '/triagem': {
    titulo: 'Triagem de viabilidade',
    descricao: 'UC11 — primeira etapa da cadeia de aprovação do MilScale.'
  },
  '/autorizacao': {
    titulo: 'Autorização de troca',
    descricao: 'UC12 — etapa final da cadeia de aprovação do MilScale.'
  },
  '/militares': { titulo: 'Militares', descricao: 'UC02 — perfil, posto/graduação e cursos.' },
  '/cursos': { titulo: 'Cursos e qualificações', descricao: 'RF05 — CFC, Motorista e Rancho.' },
  '/tipos-servico': { titulo: 'Tipos de serviço', descricao: 'UC03 — requisitos de elegibilidade e efetivo.' },
  '/regras': { titulo: 'Regras da escala', descricao: 'UC04 — limites do ciclo e intervalo mínimo.' },
  '/missoes': { titulo: 'Missões e impedimentos', descricao: 'UC16 — datas em que o militar não pode ser escalado.' },
  '/auditoria': { titulo: 'Trilha de auditoria', descricao: 'RF22 — histórico de todas as alterações relevantes.' }
};

export function Layout() {
  const { sessao, sair, temPermissao } = useSessao();
  const local = useLocation();
  if (!sessao) return null;

  const cabecalho = titulosPorRota[local.pathname] ?? {
    titulo: 'MilScale',
    descricao: 'Gestão da escala de serviço.'
  };

  return (
    <div className="layout">
      <aside className="barra-lateral">
        <div className="marca">
          <strong>{sessao.produto.nome}</strong>
          <span>Escala de serviço · 5º BI Curitiba</span>
        </div>

        <nav className="menu">
          {grupos.map((grupo) => {
            const visiveis = grupo.itens.filter(
              (item) => !item.permissoes || temPermissao(...item.permissoes)
            );
            if (visiveis.length === 0) return null;
            return (
              <div key={grupo.titulo}>
                <div className="menu-grupo">{grupo.titulo}</div>
                {visiveis.map((item) => (
                  <NavLink
                    key={item.para}
                    to={item.para}
                    className={({ isActive }) => (isActive ? 'ativo' : '')}
                  >
                    {item.rotulo}
                    {item.para === '/notificacoes' && sessao.notificacoesNaoLidas > 0 && (
                      <span className="marcador">{sessao.notificacoesNaoLidas}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="rodape-lateral">
          <div>
            <strong>
              {sessao.usuario.sigla_posto} {sessao.usuario.nome_guerra}
            </strong>
          </div>
          <div style={{ opacity: 0.75, fontSize: 11.5 }}>
            {sessao.usuario.perfil.replaceAll('_', ' ')}
          </div>
          <button onClick={sair}>Encerrar sessão</button>
        </div>
      </aside>

      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <h1>{cabecalho.titulo}</h1>
            <p>{cabecalho.descricao}</p>
          </div>
        </header>
        <div className="pagina">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
