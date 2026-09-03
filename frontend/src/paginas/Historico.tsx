import { useState } from 'react';
import { api } from '../servicos/api';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Indicador,
  Vazio,
  dataBr,
  hoje,
  somarDias,
  useConsulta
} from '../componentes/comuns';
import type { Militar, ServicoEscalado } from '../servicos/tipos';

interface HistoricoDoMilitar {
  militar: Militar;
  servicos: ServicoEscalado[];
  totalizadores: { tipoServico: string; total: number }[];
  diasSemServico: number;
}

/** UC17 – Consultar histórico de serviços com totalizadores por tipo. */
export function Historico() {
  const [idMilitar, definirIdMilitar] = useState('');
  const [inicio, definirInicio] = useState(somarDias(hoje(), -180));
  const [fim, definirFim] = useState(hoje());

  const militares = useConsulta(() => api.get<Militar[]>('/cadastros/militares'), []);
  const consulta = useConsulta(
    () =>
      idMilitar
        ? api.get<HistoricoDoMilitar>(`/escalas/historico/${idMilitar}?inicio=${inicio}&fim=${fim}`)
        : Promise.resolve(null),
    [idMilitar, inicio, fim]
  );

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <div style={{ flex: '2 1 260px' }}>
            <label>Militar</label>
            <select value={idMilitar} onChange={(e) => definirIdMilitar(e.target.value)}>
              <option value="">Selecione</option>
              {(militares.dados ?? []).map((militar) => (
                <option key={militar.id_militar} value={militar.id_militar}>
                  {militar.sigla_posto} {militar.nome_guerra} — {militar.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>De</label>
            <input type="date" value={inicio} onChange={(e) => definirInicio(e.target.value)} />
          </div>
          <div>
            <label>Até</label>
            <input type="date" value={fim} onChange={(e) => definirFim(e.target.value)} />
          </div>
        </div>
      </Cartao>

      <Aviso tipo="erro">{consulta.erro}</Aviso>

      {!consulta.dados ? (
        <Cartao>
          <Vazio>Selecione um militar para ver os serviços cumpridos no período.</Vazio>
        </Cartao>
      ) : (
        <>
          <div className="grade quatro" style={{ marginBottom: 18 }}>
            <Indicador valor={consulta.dados.servicos.length} rotulo="Serviços no período" />
            <Indicador valor={consulta.dados.diasSemServico} rotulo="Dias sem serviço (posição no ciclo)" />
            <Indicador
              valor={consulta.dados.militar.cursos.map((c) => c.nome).join(', ') || '—'}
              rotulo="Cursos e qualificações"
            />
            <Indicador
              valor={consulta.dados.militar.sigla_posto}
              rotulo={consulta.dados.militar.descricao_posto}
            />
          </div>

          <div className="grade duas">
            <Cartao titulo="Totalizadores por tipo de serviço">
              {consulta.dados.totalizadores.length === 0 ? (
                <Vazio>Sem registros no período.</Vazio>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Tipo de serviço</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consulta.dados.totalizadores.map((total) => (
                      <tr key={total.tipoServico}>
                        <td>{total.tipoServico}</td>
                        <td>
                          <strong>{total.total}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Cartao>

            <Cartao titulo="Serviços cumpridos e previstos">
              {consulta.dados.servicos.length === 0 ? (
                <Vazio>Nenhum serviço no período informado.</Vazio>
              ) : (
                <div className="tabela-rolavel" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Serviço</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consulta.dados.servicos.map((servico) => (
                        <tr key={servico.id_servico_escalado}>
                          <td>{dataBr(servico.data)}</td>
                          <td>
                            {servico.posicao ?? servico.nome_tipo_servico}
                            {servico.observacao && <div className="discreto">{servico.observacao}</div>}
                          </td>
                          <td>
                            <Etiqueta situacao={servico.situacao} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Cartao>
          </div>
        </>
      )}
    </>
  );
}
