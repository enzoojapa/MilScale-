import { useState } from 'react';
import { api } from '../servicos/api';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Modal,
  Vazio,
  dataBr,
  diaDaSemana,
  hoje,
  somarDias,
  useConsulta
} from '../componentes/comuns';
import type { ServicoEscalado, SubstitutoSugerido } from '../servicos/tipos';

export function MinhaEscala() {
  const [inicio, definirInicio] = useState(hoje());
  const [fim, definirFim] = useState(somarDias(hoje(), 60));
  const [servicoEmTroca, definirServicoEmTroca] = useState<ServicoEscalado | null>(null);

  const consulta = useConsulta(
    () => api.get<ServicoEscalado[]>(`/escalas/consulta/minha?inicio=${inicio}&fim=${fim}`),
    [inicio, fim]
  );

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
        </div>
      </Cartao>

      <Aviso tipo="erro">{consulta.erro}</Aviso>

      <Cartao titulo={`Serviços de ${dataBr(inicio)} a ${dataBr(fim)}`}>
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>
            Nenhum serviço encontrado no período. Se a escala ainda não foi divulgada, ela não aparece aqui.
          </Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo de serviço</th>
                  <th>Posição</th>
                  <th>Apresentação</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((servico) => (
                  <tr key={servico.id_servico_escalado}>
                    <td>
                      <strong>{dataBr(servico.data)}</strong>
                      <div className="discreto">{diaDaSemana(servico.data)}</div>
                    </td>
                    <td>{servico.nome_tipo_servico}</td>
                    <td>{servico.posicao ?? '—'}</td>
                    <td>
                      {servico.hora_inicio}
                      <div className="discreto">turno de {servico.duracao_horas}h</div>
                    </td>
                    <td>
                      <Etiqueta situacao={servico.situacao} />
                      {servico.trancado ? (
                        <div style={{ marginTop: 4 }}>
                          <Etiqueta situacao="NEGADA" texto="dia trancado" />
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {servico.podeSolicitarTroca ? (
                        <button className="pequeno" onClick={() => definirServicoEmTroca(servico)}>
                          Solicitar troca
                        </button>
                      ) : (
                        <span className="discreto">{servico.motivoBloqueioTroca}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {servicoEmTroca && (
        <ModalSolicitarTroca
          servico={servicoEmTroca}
          aoFechar={() => definirServicoEmTroca(null)}
          aoConcluir={() => {
            definirServicoEmTroca(null);
            consulta.recarregar();
          }}
        />
      )}
    </>
  );
}

/** UC10 – Solicitar troca de serviço, com filtro automático de substitutos elegíveis (UC15). */
function ModalSolicitarTroca({
  servico,
  aoFechar,
  aoConcluir
}: {
  servico: ServicoEscalado;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [motivo, definirMotivo] = useState('');
  const [idSubstituto, definirIdSubstituto] = useState('');
  const [erro, definirErro] = useState('');
  const [enviando, definirEnviando] = useState(false);

  const substitutos = useConsulta(
    () =>
      api.get<SubstitutoSugerido[]>(
        `/solicitacoes/servicos/${servico.id_servico_escalado}/substitutos`
      ),
    [servico.id_servico_escalado]
  );

  async function enviar() {
    definirErro('');
    definirEnviando(true);
    try {
      await api.post('/solicitacoes', {
        idServicoEscalado: servico.id_servico_escalado,
        idMilitarSubstituto: idSubstituto ? Number(idSubstituto) : null,
        motivo
      });
      aoConcluir();
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Solicitar troca — ${servico.nome_tipo_servico}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={enviar} disabled={enviando || motivo.trim().length < 5}>
            {enviando ? 'Enviando…' : 'Registrar solicitação'}
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <p style={{ marginTop: 0 }}>
        Serviço de <strong>{dataBr(servico.data)}</strong> ({diaDaSemana(servico.data)}), apresentação às{' '}
        {servico.hora_inicio}. A solicitação exige antecedência mínima de 24 horas.
      </p>

      <div className="campo">
        <label>Motivo da solicitação</label>
        <textarea
          value={motivo}
          onChange={(e) => definirMotivo(e.target.value)}
          placeholder="Descreva o motivo que justifica a troca."
        />
      </div>

      <div className="campo">
        <label>Militar substituto (opcional — sem indicação, a sargenteação escolhe)</label>
        <select value={idSubstituto} onChange={(e) => definirIdSubstituto(e.target.value)}>
          <option value="">Troca aberta, sem substituto indicado</option>
          {(substitutos.dados ?? []).map((candidato) => (
            <option key={candidato.id_militar} value={candidato.id_militar}>
              {candidato.sigla_posto} {candidato.nome_guerra} — {candidato.dias_sem_servico} dias sem serviço
              {candidato.sem_prioridade ? ' (retorno de missão, sem prioridade)' : ''}
            </option>
          ))}
        </select>
        <div className="discreto" style={{ marginTop: 5 }}>
          A lista traz apenas militares elegíveis para este serviço nesta data, ordenados pelo maior
          contador de dias sem serviço.
        </div>
      </div>
    </Modal>
  );
}
