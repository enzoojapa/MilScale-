import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Etiqueta, Vazio, dataBr, hoje, useConsulta } from '../componentes/comuns';
import type { TipoServico } from '../servicos/tipos';

interface ResultadoElegibilidade {
  regraAplicada: { identificador: string; descricao: string };
  aptos: {
    militar: { id_militar: number; nome_guerra: string; sigla_posto: string; nome_completo: string };
    diasSemServico: number;
    servicosNoMes: number;
    semPrioridade: boolean;
  }[];
  inaptos: {
    militar: { id_militar: number; nome_guerra: string; sigla_posto: string };
    motivo: string;
  }[];
}

/**
 * UC15 – Validar elegibilidade do militar, exposto como tela de conferência.
 *
 * A regra de elegibilidade é um ponto de variação da linha de produto: o cartão do topo mostra
 * qual implementação está injetada no produto configurado.
 */
export function Elegibilidade() {
  const [idTipoServico, definirIdTipoServico] = useState('');
  const [data, definirData] = useState(hoje());

  const tipos = useConsulta(() => api.get<TipoServico[]>('/cadastros/tipos-servico?ativos=true'), []);
  const consulta = useConsulta(
    () =>
      idTipoServico
        ? api.get<ResultadoElegibilidade>(
            `/escalas/elegibilidade?idTipoServico=${idTipoServico}&data=${data}`
          )
        : Promise.resolve(null),
    [idTipoServico, data]
  );

  const tipoSelecionado = tipos.dados?.find((t) => String(t.id_tipo_servico) === idTipoServico);

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <div>
            <label>Tipo de serviço</label>
            <select value={idTipoServico} onChange={(e) => definirIdTipoServico(e.target.value)}>
              <option value="">Selecione</option>
              {(tipos.dados ?? []).map((tipo) => (
                <option key={tipo.id_tipo_servico} value={tipo.id_tipo_servico}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => definirData(e.target.value)} />
          </div>
        </div>

        {tipoSelecionado && (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Requisitos de <strong>{tipoSelecionado.nome}</strong>:{' '}
            {tipoSelecionado.requisitos
              .map((r) => `${r.sigla_posto}${r.nome_curso ? ` + ${r.nome_curso}` : ''}`)
              .join(' ou ')}
            . Efetivo necessário: {tipoSelecionado.efetivo_necessario} por dia.
          </p>
        )}
      </Cartao>

      {consulta.dados && (
        <div className="caixa-variacao">
          <strong>Regra de elegibilidade injetada: {consulta.dados.regraAplicada.identificador}.</strong>{' '}
          {consulta.dados.regraAplicada.descricao}
        </div>
      )}

      <Aviso tipo="erro">{consulta.erro}</Aviso>

      {!idTipoServico ? (
        <Cartao>
          <Vazio>Selecione um tipo de serviço para verificar quem pode assumi-lo.</Vazio>
        </Cartao>
      ) : (
        <div className="grade duas">
          <Cartao titulo={`Aptos em ${dataBr(data)} — ordenados pela rotatividade`}>
            {!consulta.dados || consulta.dados.aptos.length === 0 ? (
              <Vazio>Nenhum militar apto nesta data.</Vazio>
            ) : (
              <div className="tabela-rolavel" style={{ maxHeight: 460, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ordem</th>
                      <th>Militar</th>
                      <th>Dias sem serviço</th>
                      <th>No mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consulta.dados.aptos.map((apto, indice) => (
                      <tr key={apto.militar.id_militar}>
                        <td>{indice + 1}º</td>
                        <td>
                          {apto.militar.sigla_posto} <strong>{apto.militar.nome_guerra}</strong>
                          {apto.semPrioridade && (
                            <div>
                              <Etiqueta situacao="AGUARDANDO_SARGENTEANTE" texto="retorno de missão, sem prioridade" />
                            </div>
                          )}
                        </td>
                        <td>{apto.diasSemServico}</td>
                        <td>{apto.servicosNoMes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          <Cartao titulo="Inaptos e o motivo do impedimento">
            {!consulta.dados || consulta.dados.inaptos.length === 0 ? (
              <Vazio>Todo o efetivo ativo está apto.</Vazio>
            ) : (
              <div className="tabela-rolavel" style={{ maxHeight: 460, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Militar</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consulta.dados.inaptos.map((inapto) => (
                      <tr key={inapto.militar.id_militar}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {inapto.militar.sigla_posto} {inapto.militar.nome_guerra}
                        </td>
                        <td className="discreto">{inapto.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>
        </div>
      )}
    </>
  );
}
