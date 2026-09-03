import { useState } from 'react';
import { api } from '../servicos/api';
import { useSessao } from '../contextoSessao';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Modal,
  Vazio,
  dataBr,
  diaDaSemana,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
  useConsulta
} from '../componentes/comuns';
import type { DiaDaEscala, ServicoEscalado, SubstitutoSugerido, TipoServico } from '../servicos/tipos';

interface ElegiveisDoServico {
  servico: ServicoEscalado;
  aptos: { militar: { id_militar: number; nome_guerra: string; sigla_posto: string }; diasSemServico: number; semPrioridade: boolean }[];
  inaptos: { militar: { id_militar: number; nome_guerra: string; sigla_posto: string }; motivo: string }[];
}

export function EscalaCompleta() {
  const { temPermissao } = useSessao();
  const [inicio, definirInicio] = useState(primeiroDiaDoMes());
  const [fim, definirFim] = useState(ultimoDiaDoMes());
  const [idTipoServico, definirIdTipoServico] = useState('');
  const [incluirRascunho, definirIncluirRascunho] = useState(false);
  const [servicoEmEdicao, definirServicoEmEdicao] = useState<ServicoEscalado | null>(null);
  const [mensagem, definirMensagem] = useState('');

  const tipos = useConsulta(() => api.get<TipoServico[]>('/cadastros/tipos-servico'), []);
  const consulta = useConsulta(
    () =>
      api.get<DiaDaEscala[]>(
        `/escalas/consulta/periodo?inicio=${inicio}&fim=${fim}` +
          (idTipoServico ? `&idTipoServico=${idTipoServico}` : '') +
          (incluirRascunho ? '&incluirRascunho=true' : '')
      ),
    [inicio, fim, idTipoServico, incluirRascunho]
  );

  async function exportar() {
    definirMensagem('');
    try {
      await api.baixarArquivo(
        `/escalas/exportar/pdf?inicio=${inicio}&fim=${fim}` +
          (idTipoServico ? `&idTipoServico=${idTipoServico}` : ''),
        `escala-${inicio}-a-${fim}.pdf`
      );
    } catch (e) {
      definirMensagem((e as Error).message);
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
          <div>
            <label>Tipo de serviço</label>
            <select value={idTipoServico} onChange={(e) => definirIdTipoServico(e.target.value)}>
              <option value="">Todos</option>
              {(tipos.dados ?? []).map((tipo) => (
                <option key={tipo.id_tipo_servico} value={tipo.id_tipo_servico}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label>
              <input
                type="checkbox"
                style={{ width: 'auto', marginRight: 6 }}
                checked={incluirRascunho}
                onChange={(e) => definirIncluirRascunho(e.target.checked)}
              />
              Incluir rascunhos
            </label>
          </div>
          {temPermissao('ESCALA_EXPORTAR') && <button onClick={exportar}>Exportar PDF</button>}
        </div>
      </Cartao>

      <Aviso tipo="erro">{consulta.erro || mensagem}</Aviso>

      {consulta.carregando ? (
        <Vazio>Carregando a escala…</Vazio>
      ) : !consulta.dados || consulta.dados.length === 0 ? (
        <Cartao>
          <Vazio>Não há escala registrada no período informado.</Vazio>
        </Cartao>
      ) : (
        consulta.dados.map((dia) => (
          <article key={dia.data} className={`dia-escala${dia.trancado ? ' trancado' : ''}`}>
            <header>
              <div>
                <strong>{dataBr(dia.data)}</strong>{' '}
                <span className="discreto">{diaDaSemana(dia.data)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Etiqueta situacao={dia.situacaoEscala} />
                {dia.trancado && <Etiqueta situacao="NEGADA" texto={`trancado: ${dia.motivoTrancamento}`} />}
                {dia.pendencias > 0 && (
                  <Etiqueta situacao="AGUARDANDO_SARGENTEANTE" texto={`${dia.pendencias} pendência(s)`} />
                )}
              </div>
            </header>

            {dia.servicos.map((servico) => (
              <div
                key={servico.id_servico_escalado}
                className={`linha-servico${servico.id_militar ? '' : ' pendente'}`}
              >
                <div>
                  <strong>{servico.posicao ?? servico.nome_tipo_servico}</strong>
                  {servico.observacao && <div className="discreto">{servico.observacao}</div>}
                </div>
                <div>
                  {servico.id_militar ? (
                    <>
                      {servico.sigla_posto} {servico.nome_guerra}
                      <div className="discreto">{servico.nome_completo}</div>
                    </>
                  ) : (
                    <Etiqueta situacao="NEGADA" texto="vaga pendente" />
                  )}
                </div>
                <div className="discreto">
                  {servico.hora_inicio} · {servico.duracao_horas}h
                </div>
                <div>
                  {temPermissao('ESCALA_ALTERAR') && !dia.trancado && (
                    <button className="pequeno" onClick={() => definirServicoEmEdicao(servico)}>
                      Alterar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </article>
        ))
      )}

      {servicoEmEdicao && (
        <ModalAlterarServico
          servico={servicoEmEdicao}
          aoFechar={() => definirServicoEmEdicao(null)}
          aoConcluir={() => {
            definirServicoEmEdicao(null);
            consulta.recarregar();
          }}
        />
      )}
    </>
  );
}

/** UC06 – Alteração manual da escala, privativa do sargenteante, com justificativa obrigatória. */
function ModalAlterarServico({
  servico,
  aoFechar,
  aoConcluir
}: {
  servico: ServicoEscalado;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [idSubstituto, definirIdSubstituto] = useState(String(servico.id_militar ?? ''));
  const [justificativa, definirJustificativa] = useState('');
  const [erro, definirErro] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [verInaptos, definirVerInaptos] = useState(false);

  const elegiveis = useConsulta(
    () => api.get<ElegiveisDoServico>(`/escalas/servicos/${servico.id_servico_escalado}/elegiveis`),
    [servico.id_servico_escalado]
  );

  async function salvar() {
    definirErro('');
    definirEnviando(true);
    try {
      await api.put(`/escalas/servicos/${servico.id_servico_escalado}`, {
        idMilitarSubstituto: idSubstituto ? Number(idSubstituto) : null,
        justificativa
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
      titulo={`Alterar ${servico.posicao ?? servico.nome_tipo_servico} — ${dataBr(servico.data)}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={enviando || justificativa.trim().length < 5}>
            {enviando ? 'Gravando…' : 'Confirmar alteração'}
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro || elegiveis.erro}</Aviso>

      <div className="campo">
        <label>Militar escalado</label>
        <select value={idSubstituto} onChange={(e) => definirIdSubstituto(e.target.value)}>
          <option value="">Remover sem substituto (marca a vaga como pendente)</option>
          {servico.id_militar && (
            <option value={servico.id_militar}>
              {servico.sigla_posto} {servico.nome_guerra} (atual)
            </option>
          )}
          {(elegiveis.dados?.aptos ?? []).map((apto) => (
            <option key={apto.militar.id_militar} value={apto.militar.id_militar}>
              {apto.militar.sigla_posto} {apto.militar.nome_guerra} — {apto.diasSemServico} dias sem serviço
              {apto.semPrioridade ? ' (sem prioridade)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label>Justificativa (obrigatória)</label>
        <textarea value={justificativa} onChange={(e) => definirJustificativa(e.target.value)} />
      </div>

      <button className="pequeno" onClick={() => definirVerInaptos((v) => !v)}>
        {verInaptos ? 'Ocultar' : 'Ver'} militares inaptos e o motivo ({elegiveis.dados?.inaptos.length ?? 0})
      </button>

      {verInaptos && (
        <div className="tabela-rolavel" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Militar</th>
                <th>Motivo da inaptidão</th>
              </tr>
            </thead>
            <tbody>
              {(elegiveis.dados?.inaptos ?? []).map((inapto) => (
                <tr key={inapto.militar.id_militar}>
                  <td>
                    {inapto.militar.sigla_posto} {inapto.militar.nome_guerra}
                  </td>
                  <td className="discreto">{inapto.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
