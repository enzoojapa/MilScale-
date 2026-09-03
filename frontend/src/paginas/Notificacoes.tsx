import { useState } from 'react';
import { api } from '../servicos/api';
import { useSessao } from '../contextoSessao';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Vazio,
  dataBr,
  dataHoraBr,
  hoje,
  useConsulta
} from '../componentes/comuns';
import type { Notificacao } from '../servicos/tipos';

interface ResumoRotinaD1 {
  dataAlvo: string;
  militaresApurados: number;
  notificacoesEnviadas: number;
  jaNotificados: number;
  falhas: { nomeGuerra: string; motivo: string }[];
  observacao?: string;
}

/** UC14 e UC20 – caixa de notificações e disparo manual da rotina D-1. */
export function Notificacoes() {
  const { temPermissao, recarregar } = useSessao();
  const podeDisparar = temPermissao('NOTIFICACAO_DISPARAR');
  const [verTodas, definirVerTodas] = useState(false);
  const [dataReferencia, definirDataReferencia] = useState(hoje());
  const [resumo, definirResumo] = useState<ResumoRotinaD1 | null>(null);
  const [erro, definirErro] = useState('');

  const consulta = useConsulta(
    () => api.get<Notificacao[]>(`/notificacoes${verTodas ? '?todas=true' : ''}`),
    [verTodas]
  );

  async function dispararRotina() {
    definirErro('');
    try {
      definirResumo(await api.post<ResumoRotinaD1>('/notificacoes/rotina-d1', { dataReferencia }));
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  async function marcarComoLida(notificacao: Notificacao) {
    await api.post(`/notificacoes/${notificacao.id_notificacao}/lida`);
    consulta.recarregar();
    await recarregar();
  }

  return (
    <>
      {podeDisparar && (
        <Cartao titulo="Rotina D-1 (UC20)">
          <p className="discreto" style={{ marginTop: 0 }}>
            O agendador do sistema executa esta rotina diariamente no horário parametrizado. Aqui ela
            pode ser disparada manualmente: são apurados os militares escalados para o dia seguinte à
            data de referência, desconsiderando vagas pendentes e posições com troca em análise.
          </p>
          <div className="linha-campos">
            <div>
              <label>Data de referência</label>
              <input
                type="date"
                value={dataReferencia}
                onChange={(e) => definirDataReferencia(e.target.value)}
              />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <label>&nbsp;</label>
              <button className="primario" onClick={dispararRotina}>
                Executar rotina agora
              </button>
            </div>
            <label style={{ flex: '0 0 auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={verTodas}
                onChange={(e) => definirVerTodas(e.target.checked)}
              />
              Ver notificações de todo o efetivo
            </label>
          </div>

          {resumo && (
            <Aviso tipo={resumo.falhas.length > 0 ? 'info' : 'sucesso'}>
              {resumo.observacao ?? (
                <>
                  Serviço de <strong>{dataBr(resumo.dataAlvo)}</strong>: {resumo.militaresApurados}{' '}
                  militar(es) apurado(s), {resumo.notificacoesEnviadas} notificação(ões) enviada(s),{' '}
                  {resumo.jaNotificados} já notificado(s) anteriormente.
                  {resumo.falhas.length > 0 && (
                    <ul style={{ marginBottom: 0 }}>
                      {resumo.falhas.map((falha, indice) => (
                        <li key={indice}>
                          {falha.nomeGuerra}: {falha.motivo}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Aviso>
          )}
        </Cartao>
      )}

      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      <Cartao titulo={verTodas ? 'Fila de envio do batalhão' : 'Minhas notificações'}>
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhuma notificação registrada.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  {verTodas && <th>Destinatário</th>}
                  <th>Tipo</th>
                  <th>Mensagem</th>
                  <th>Canal</th>
                  <th>Envio</th>
                  <th>Situação</th>
                  {!verTodas && <th />}
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((notificacao) => (
                  <tr key={notificacao.id_notificacao}>
                    {verTodas && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {notificacao.sigla_posto} {notificacao.nome_guerra}
                      </td>
                    )}
                    <td className="discreto">{notificacao.tipo.replaceAll('_', ' ')}</td>
                    <td>
                      <strong>{notificacao.titulo}</strong>
                      <div className="discreto">{notificacao.mensagem}</div>
                    </td>
                    <td className="discreto">{notificacao.canal}</td>
                    <td className="discreto">{dataHoraBr(notificacao.data_envio)}</td>
                    <td>
                      <Etiqueta situacao={notificacao.situacao_envio} />
                    </td>
                    {!verTodas && (
                      <td>
                        {notificacao.situacao_envio === 'ENVIADA' && (
                          <button className="pequeno" onClick={() => marcarComoLida(notificacao)}>
                            Marcar como lida
                          </button>
                        )}
                      </td>
                    )}
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
