import { useState } from 'react';
import { api, ErroApi } from '../servicos/api';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Vazio,
  dataBr,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
  useConsulta
} from '../componentes/comuns';
import type { Escala, RelatorioGeracao, TipoServico } from '../servicos/tipos';

/** UC05 – Gerar escala do período: apura o ciclo pela RN20 e devolve o relatório da geração. */
export function GerarEscala() {
  const [inicio, definirInicio] = useState(primeiroDiaDoMes());
  const [fim, definirFim] = useState(ultimoDiaDoMes());
  const [descricao, definirDescricao] = useState('');
  const [idTipoServico, definirIdTipoServico] = useState('');
  const [relatorio, definirRelatorio] = useState<RelatorioGeracao | null>(null);
  const [erro, definirErro] = useState('');
  const [sucesso, definirSucesso] = useState('');
  const [confirmacaoNecessaria, definirConfirmacaoNecessaria] = useState(false);
  const [gerando, definirGerando] = useState(false);

  const tipos = useConsulta(() => api.get<TipoServico[]>('/cadastros/tipos-servico?ativos=true'), []);
  const escalas = useConsulta(() => api.get<Escala[]>('/escalas'), []);

  async function gerar(opcoes: { confirmarCiclo?: boolean; substituirRascunho?: boolean } = {}) {
    definirErro('');
    definirSucesso('');
    definirGerando(true);
    try {
      const resultado = await api.post<RelatorioGeracao>('/escalas/gerar', {
        dataInicio: inicio,
        dataFim: fim,
        descricao: descricao || undefined,
        idTipoServico: idTipoServico ? Number(idTipoServico) : undefined,
        confirmarCicloAbaixoDoMinimo: opcoes.confirmarCiclo ?? false,
        substituirRascunho: opcoes.substituirRascunho ?? false
      });
      definirRelatorio(resultado);
      definirConfirmacaoNecessaria(false);
      escalas.recarregar();
    } catch (e) {
      const erroApi = e as ErroApi;
      definirErro(erroApi.message);
      definirConfirmacaoNecessaria(erroApi.codigo === 'CICLO_ABAIXO_DO_MINIMO');
    } finally {
      definirGerando(false);
    }
  }

  async function publicar(idEscala: number) {
    definirErro('');
    try {
      const resposta = await api.post<{ militaresNotificados: number }>(`/escalas/${idEscala}/publicar`);
      definirSucesso(
        `Escala publicada. ${resposta.militaresNotificados} militar(es) notificado(s) da publicação.`
      );
      definirRelatorio(null);
      escalas.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  async function descartar(idEscala: number) {
    definirErro('');
    try {
      await api.remover(`/escalas/${idEscala}`);
      definirRelatorio(null);
      definirSucesso('Rascunho descartado.');
      escalas.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <>
      <Cartao titulo="Parâmetros da geração">
        <div className="linha-campos">
          <div>
            <label>Data inicial</label>
            <input type="date" value={inicio} onChange={(e) => definirInicio(e.target.value)} />
          </div>
          <div>
            <label>Data final</label>
            <input type="date" value={fim} onChange={(e) => definirFim(e.target.value)} />
          </div>
          <div>
            <label>Descrição (opcional)</label>
            <input
              value={descricao}
              onChange={(e) => definirDescricao(e.target.value)}
              placeholder="Escala Outubro/2026"
            />
          </div>
          <div>
            <label>Geração parcial</label>
            <select value={idTipoServico} onChange={(e) => definirIdTipoServico(e.target.value)}>
              <option value="">Todos os tipos de serviço ativos</option>
              {(tipos.dados ?? []).map((tipo) => (
                <option key={tipo.id_tipo_servico} value={tipo.id_tipo_servico}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </div>
          <button className="primario" onClick={() => gerar()} disabled={gerando}>
            {gerando ? 'Gerando…' : 'Gerar escala'}
          </button>
        </div>
        <p className="discreto" style={{ marginBottom: 0 }}>
          O ciclo não é informado: ele é apurado a cada geração, dividindo o efetivo elegível e
          disponível pelo efetivo diário exigido por cada tipo de serviço.
        </p>
      </Cartao>

      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      {confirmacaoNecessaria && (
        <Cartao>
          <p style={{ marginTop: 0 }}>
            O efetivo disponível não sustenta o ciclo mínimo cadastrado. Confirme para gerar mesmo assim.
          </p>
          <button className="primario" onClick={() => gerar({ confirmarCiclo: true, substituirRascunho: true })}>
            Gerar assim mesmo
          </button>
        </Cartao>
      )}

      {relatorio && (
        <>
          <Cartao titulo={`Rascunho gerado — ${relatorio.descricao}`}>
            <div className="grade quatro" style={{ marginBottom: 14 }}>
              <div className="indicador">
                <div className="valor">{relatorio.totalServicosGerados}</div>
                <div className="rotulo">Serviços escalados</div>
              </div>
              <div className="indicador">
                <div className="valor">{relatorio.totalPendencias}</div>
                <div className="rotulo">Vagas sem militar elegível</div>
              </div>
              <div className="indicador">
                <div className="valor">{relatorio.duracaoMs} ms</div>
                <div className="rotulo">Tempo de processamento</div>
              </div>
              <div className="indicador">
                <div className="valor">
                  {dataBr(relatorio.periodo.inicio)}
                  <div style={{ fontSize: 13 }}>a {dataBr(relatorio.periodo.fim)}</div>
                </div>
                <div className="rotulo">Período</div>
              </div>
            </div>

            {relatorio.alertas.map((alerta, indice) => (
              <Aviso key={indice} tipo="info">
                {alerta}
              </Aviso>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primario" onClick={() => publicar(relatorio.idEscala)}>
                Conferir e publicar
              </button>
              <button className="perigo" onClick={() => descartar(relatorio.idEscala)}>
                Descartar rascunho
              </button>
            </div>
          </Cartao>

          <Cartao titulo="Ciclo apurado por tipo de serviço">
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Tipo de serviço</th>
                    <th>Efetivo elegível</th>
                    <th>Por dia</th>
                    <th>Ciclo apurado</th>
                    <th>Ciclo aplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.ciclos.map((ciclo) => (
                    <tr key={ciclo.nomeTipoServico}>
                      <td>{ciclo.nomeTipoServico}</td>
                      <td>{ciclo.efetivoElegivel}</td>
                      <td>{ciclo.efetivoDiarioExigido}</td>
                      <td>{ciclo.cicloCalculado}x1</td>
                      <td>
                        <Etiqueta
                          situacao={ciclo.abaixoDoMinimo ? 'NEGADA' : 'AUTORIZADA'}
                          texto={ciclo.proporcao}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          {relatorio.pendencias.length > 0 && (
            <Cartao titulo="Pendências da geração">
              <div className="tabela-rolavel" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Posição</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.pendencias.map((pendencia, indice) => (
                      <tr key={indice}>
                        <td>{dataBr(pendencia.data)}</td>
                        <td>{pendencia.posicao}</td>
                        <td className="discreto">{pendencia.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          )}
        </>
      )}

      <Cartao titulo="Escalas registradas">
        {!escalas.dados || escalas.dados.length === 0 ? (
          <Vazio>Nenhuma escala gerada até o momento.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Período</th>
                <th>Situação</th>
                <th>Gerada em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {escalas.dados.map((escala) => (
                <tr key={escala.id_escala}>
                  <td>{escala.descricao}</td>
                  <td>
                    {dataBr(escala.data_inicio)} a {dataBr(escala.data_fim)}
                  </td>
                  <td>
                    <Etiqueta situacao={escala.situacao} />
                  </td>
                  <td className="discreto">{escala.data_geracao.slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    {escala.situacao === 'RASCUNHO' && (
                      <>
                        <button className="pequeno primario" onClick={() => publicar(escala.id_escala)}>
                          Publicar
                        </button>{' '}
                        <button className="pequeno perigo" onClick={() => descartar(escala.id_escala)}>
                          Descartar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </>
  );
}
