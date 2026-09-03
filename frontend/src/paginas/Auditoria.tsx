import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Etiqueta, Vazio, dataHoraBr, useConsulta } from '../componentes/comuns';
import type { RegistroAuditoria } from '../servicos/tipos';

interface RespostaAuditoria {
  entidades: string[];
  registros: RegistroAuditoria[];
}

/** RF22 / RNF07 – trilha de auditoria imutável das alterações relevantes. */
export function Auditoria() {
  const [entidade, definirEntidade] = useState('');
  const [acao, definirAcao] = useState('');

  const consulta = useConsulta(
    () =>
      api.get<RespostaAuditoria>(
        '/auditoria?' +
          new URLSearchParams({ ...(entidade ? { entidade } : {}), ...(acao ? { acao } : {}) }).toString()
      ),
    [entidade, acao]
  );

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <div>
            <label>Entidade</label>
            <select value={entidade} onChange={(e) => definirEntidade(e.target.value)}>
              <option value="">Todas</option>
              {(consulta.dados?.entidades ?? []).map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Ação</label>
            <select value={acao} onChange={(e) => definirAcao(e.target.value)}>
              <option value="">Todas</option>
              <option value="INCLUSAO">Inclusão</option>
              <option value="ALTERACAO">Alteração</option>
              <option value="EXCLUSAO">Exclusão</option>
              <option value="ACESSO">Acesso</option>
            </select>
          </div>
          <button onClick={consulta.recarregar}>Atualizar</button>
        </div>
      </Cartao>

      <Aviso tipo="erro">{consulta.erro}</Aviso>

      <Cartao titulo={`${consulta.dados?.registros.length ?? 0} registro(s) mais recentes`}>
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.registros.length === 0 ? (
          <Vazio>Nenhum registro de auditoria com os filtros aplicados.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Usuário</th>
                  <th>Entidade</th>
                  <th>Registro</th>
                  <th>Ação</th>
                  <th>Valor anterior</th>
                  <th>Valor novo</th>
                </tr>
              </thead>
              <tbody>
                {consulta.dados.registros.map((registro) => (
                  <tr key={registro.id_log}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dataHoraBr(registro.data_hora)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {registro.nome_guerra
                        ? `${registro.sigla_posto} ${registro.nome_guerra}`
                        : 'sistema'}
                    </td>
                    <td>{registro.entidade}</td>
                    <td>{registro.id_registro || '—'}</td>
                    <td>
                      <Etiqueta
                        situacao={registro.acao === 'EXCLUSAO' ? 'NEGADA' : 'PREVISTO'}
                        texto={registro.acao.toLowerCase()}
                      />
                    </td>
                    <td className="discreto" style={{ maxWidth: 260, wordBreak: 'break-word' }}>
                      {registro.valor_anterior ?? '—'}
                    </td>
                    <td className="discreto" style={{ maxWidth: 300, wordBreak: 'break-word' }}>
                      {registro.valor_novo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  );
}
