import { Link } from 'react-router-dom';
import { api } from '../servicos/api';
import { useSessao } from '../contextoSessao';
import { Aviso, Cartao, dataBr, diaDaSemana, Etiqueta, Indicador, useConsulta, Vazio } from '../componentes/comuns';
import type { Escala, ServicoEscalado } from '../servicos/tipos';

interface DadosPainel {
  hoje: string;
  meusProximosServicos: ServicoEscalado[];
  totalMeusServicos: number;
  notificacoesNaoLidas: number;
  minhasSolicitacoesEmAndamento: number;
  sargenteacao: {
    servicosDeHoje: ServicoEscalado[];
    pendenciasDeHoje: number;
    efetivoAtivo: number;
    aguardandoTriagem: number;
    aguardandoAutorizacao: number;
    escalas: Escala[];
  } | null;
}

export function Painel() {
  const { sessao } = useSessao();
  const { dados, erro, carregando } = useConsulta(() => api.get<DadosPainel>('/painel'), []);

  if (carregando) return <Vazio>Carregando o painel…</Vazio>;
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados || !sessao) return null;

  const proximo = dados.meusProximosServicos[0];

  return (
    <>
      <div className="grade quatro" style={{ marginBottom: 18 }}>
        <Indicador valor={dados.totalMeusServicos} rotulo="Meus serviços nos próximos 45 dias" />
        <Indicador
          valor={proximo ? dataBr(proximo.data) : '—'}
          rotulo={proximo ? `Próximo: ${proximo.nome_tipo_servico}` : 'Sem serviço previsto'}
        />
        <Indicador valor={dados.minhasSolicitacoesEmAndamento} rotulo="Minhas trocas em andamento" />
        <Indicador valor={dados.notificacoesNaoLidas} rotulo="Notificações não lidas" />
      </div>

      {dados.sargenteacao && (
        <div className="grade quatro" style={{ marginBottom: 18 }}>
          <Indicador valor={dados.sargenteacao.efetivoAtivo} rotulo="Efetivo ativo do batalhão" />
          <Indicador
            valor={dados.sargenteacao.servicosDeHoje.length}
            rotulo={`Serviços escalados em ${dataBr(dados.hoje)}`}
          />
          <Indicador valor={dados.sargenteacao.aguardandoTriagem} rotulo="Aguardando triagem do cabo" />
          <Indicador
            valor={dados.sargenteacao.aguardandoAutorizacao}
            rotulo="Aguardando autorização do sargenteante"
          />
        </div>
      )}

      <div className="grade duas">
        <Cartao titulo="Meus próximos serviços">
          {dados.meusProximosServicos.length === 0 ? (
            <Vazio>Você não tem serviço previsto no período.</Vazio>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviço</th>
                  <th>Apresentação</th>
                </tr>
              </thead>
              <tbody>
                {dados.meusProximosServicos.map((servico) => (
                  <tr key={servico.id_servico_escalado}>
                    <td>
                      {dataBr(servico.data)}
                      <div className="discreto">{diaDaSemana(servico.data)}</div>
                    </td>
                    <td>
                      {servico.nome_tipo_servico}
                      {servico.trancado ? <> <Etiqueta situacao="NEGADA" texto="dia trancado" /></> : null}
                    </td>
                    <td>
                      {servico.hora_inicio}
                      <div className="discreto">{servico.duracao_horas}h</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 12 }}>
            <Link to="/minha-escala">Ver a escala completa do mês →</Link>
          </div>
        </Cartao>

        {dados.sargenteacao ? (
          <Cartao titulo={`Serviço de ${dataBr(dados.hoje)}`}>
            {dados.sargenteacao.servicosDeHoje.length === 0 ? (
              <Vazio>Não há escala publicada para hoje.</Vazio>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Militar</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.sargenteacao.servicosDeHoje.map((servico) => (
                    <tr key={servico.id_servico_escalado}>
                      <td>{servico.posicao ?? servico.nome_tipo_servico}</td>
                      <td>
                        {servico.id_militar ? (
                          `${servico.sigla_posto} ${servico.nome_guerra}`
                        ) : (
                          <Etiqueta situacao="NEGADA" texto="pendente" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        ) : (
          <Cartao titulo="Fluxo de aprovação de troca">
            <p className="discreto" style={{ marginTop: 0 }}>
              {sessao.produto.fluxoAprovacao.descricao}
            </p>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {sessao.produto.fluxoAprovacao.etapas.map((etapa) => (
                <li key={etapa.ordem} style={{ marginBottom: 6 }}>
                  {etapa.rotulo}
                </li>
              ))}
            </ol>
          </Cartao>
        )}
      </div>

      {dados.sargenteacao && (
        <Cartao titulo="Escalas do batalhão">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Período</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {dados.sargenteacao.escalas.map((escala) => (
                <tr key={escala.id_escala}>
                  <td>{escala.descricao}</td>
                  <td>
                    {dataBr(escala.data_inicio)} a {dataBr(escala.data_fim)}
                  </td>
                  <td>
                    <Etiqueta situacao={escala.situacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
    </>
  );
}
