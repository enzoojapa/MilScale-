import { useState } from 'react';
import { api, ErroApi } from '../servicos/api';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Vazio,
  dataBr,
  diaDaSemana,
  hoje,
  somarDias,
  useConsulta
} from '../componentes/comuns';
import type { DiaDaEscala } from '../servicos/tipos';

/** UC07 – Trancar e destrancar dias da escala (RN04, RN11). */
export function Trancamento() {
  const [inicio, definirInicio] = useState(hoje());
  const [fim, definirFim] = useState(somarDias(hoje(), 30));
  const [mensagem, definirMensagem] = useState('');
  const [erro, definirErro] = useState('');
  const [confirmacaoPendente, definirConfirmacaoPendente] = useState<{
    idDiaEscala: number;
    motivo: string;
  } | null>(null);

  const consulta = useConsulta(
    () => api.get<DiaDaEscala[]>(`/escalas/consulta/periodo?inicio=${inicio}&fim=${fim}&incluirRascunho=true`),
    [inicio, fim]
  );

  async function trancar(dia: DiaDaEscala, indeferirPendentes = false) {
    definirErro('');
    definirMensagem('');
    const motivo =
      confirmacaoPendente?.idDiaEscala === dia.idDiaEscala
        ? confirmacaoPendente.motivo
        : window.prompt(`Motivo do trancamento de ${dataBr(dia.data)}:`);
    if (!motivo) return;
    try {
      const resposta = await api.post<{ solicitacoesIndeferidas: number }>(
        `/escalas/dias/${dia.idDiaEscala}/trancar`,
        { motivo, indeferirPendentes }
      );
      definirMensagem(
        `Dia ${dataBr(dia.data)} trancado.` +
          (resposta.solicitacoesIndeferidas > 0
            ? ` ${resposta.solicitacoesIndeferidas} solicitação(ões) pendente(s) foram indeferidas.`
            : '')
      );
      definirConfirmacaoPendente(null);
      consulta.recarregar();
    } catch (e) {
      const erroApi = e as ErroApi;
      definirErro(erroApi.message);
      if (erroApi.codigo === 'SOLICITACOES_PENDENTES') {
        definirConfirmacaoPendente({ idDiaEscala: dia.idDiaEscala, motivo });
      }
    }
  }

  async function destrancar(dia: DiaDaEscala) {
    definirErro('');
    const justificativa = window.prompt(`Justificativa para destrancar ${dataBr(dia.data)}:`);
    if (!justificativa) return;
    try {
      await api.post(`/escalas/dias/${dia.idDiaEscala}/destrancar`, { justificativa });
      definirMensagem(`Dia ${dataBr(dia.data)} destrancado; as trocas voltam a ser aceitas.`);
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  async function trancarIntervalo() {
    definirErro('');
    const motivo = window.prompt(`Motivo do trancamento de ${dataBr(inicio)} a ${dataBr(fim)}:`);
    if (!motivo) return;
    try {
      const resposta = await api.post<{ trancados: string[] }>('/escalas/dias/trancar-intervalo', {
        inicio,
        fim,
        motivo,
        indeferirPendentes: true
      });
      definirMensagem(`${resposta.trancados.length} dia(s) trancado(s) no intervalo.`);
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <div>
            <label>De</label>
            <input type="date" value={inicio} onChange={(e) => definirInicio(e.target.value)} />
          </div>
          <div>
            <label>Até</label>
            <input type="date" value={fim} onChange={(e) => definirFim(e.target.value)} />
          </div>
          <button onClick={consulta.recarregar}>Atualizar</button>
          <button onClick={trancarIntervalo}>Trancar todo o intervalo</button>
        </div>
        <p className="discreto" style={{ marginBottom: 0 }}>
          Um dia trancado não aceita nenhuma solicitação nem alteração de troca. Não é permitido
          trancar data anterior à data atual.
        </p>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      {confirmacaoPendente && (
        <Cartao>
          <p style={{ marginTop: 0 }}>
            Existem solicitações pendentes nesta data. Confirmar o trancamento as indefere
            automaticamente.
          </p>
          <button
            className="perigo"
            onClick={() => {
              const dia = consulta.dados?.find((d) => d.idDiaEscala === confirmacaoPendente.idDiaEscala);
              if (dia) void trancar(dia, true);
            }}
          >
            Trancar e indeferir as pendentes
          </button>{' '}
          <button onClick={() => definirConfirmacaoPendente(null)}>Cancelar</button>
        </Cartao>
      )}

      <Cartao titulo="Dias da escala">
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Não há dias de escala no período.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Escala</th>
                  <th>Serviços</th>
                  <th>Situação do dia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((dia) => (
                  <tr key={dia.data}>
                    <td>
                      <strong>{dataBr(dia.data)}</strong>
                      <div className="discreto">{diaDaSemana(dia.data)}</div>
                    </td>
                    <td>
                      <Etiqueta situacao={dia.situacaoEscala} />
                    </td>
                    <td>
                      {dia.servicos.length}
                      {dia.pendencias > 0 && (
                        <span className="discreto"> ({dia.pendencias} pendente(s))</span>
                      )}
                    </td>
                    <td>
                      {dia.trancado ? (
                        <>
                          <Etiqueta situacao="NEGADA" texto="trancado" />
                          <div className="discreto">{dia.motivoTrancamento}</div>
                        </>
                      ) : (
                        <Etiqueta situacao="AUTORIZADA" texto="aberto" />
                      )}
                    </td>
                    <td>
                      {dia.trancado ? (
                        <button className="pequeno" onClick={() => destrancar(dia)}>
                          Destrancar
                        </button>
                      ) : (
                        <button className="pequeno" onClick={() => trancar(dia)} disabled={dia.data < hoje()}>
                          Trancar
                        </button>
                      )}
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
