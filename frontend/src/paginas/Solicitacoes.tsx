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
  dataHoraBr,
  useConsulta
} from '../componentes/comuns';
import type { DetalheSolicitacao, Solicitacao } from '../servicos/tipos';

const situacoes = [
  { valor: '', rotulo: 'Todas as situações' },
  { valor: 'EM_ANALISE_CABO', rotulo: 'Em análise pelo cabo' },
  { valor: 'AGUARDANDO_SARGENTEANTE', rotulo: 'Aguardando o sargenteante' },
  { valor: 'AUTORIZADA', rotulo: 'Autorizada' },
  { valor: 'NEGADA', rotulo: 'Negada' },
  { valor: 'CANCELADA', rotulo: 'Cancelada' }
];

/**
 * UC13 (sargenteação vê todas) e UC19 (militar escalado vê apenas as próprias).
 * A restrição da RN19 é aplicada no servidor; aqui a diferença é só o filtro apresentado.
 */
export function Solicitacoes({ somenteProprias }: { somenteProprias: boolean }) {
  const { sessao } = useSessao();
  const [situacao, definirSituacao] = useState('');
  const [idSelecionada, definirIdSelecionada] = useState<number | null>(null);
  const [mensagem, definirMensagem] = useState('');

  const consulta = useConsulta(
    () =>
      api.get<Solicitacao[]>(
        `/solicitacoes?somenteProprias=${somenteProprias}` + (situacao ? `&situacao=${situacao}` : '')
      ),
    [situacao, somenteProprias]
  );

  return (
    <>
      {somenteProprias && sessao && (
        <div className="caixa-variacao">
          Sua solicitação percorre {sessao.produto.fluxoAprovacao.etapas.length} etapa(s):{' '}
          {sessao.produto.fluxoAprovacao.etapas.map((e) => e.rotulo).join(' → ')}.
        </div>
      )}

      <Cartao>
        <div className="linha-campos">
          <div>
            <label>Situação</label>
            <select value={situacao} onChange={(e) => definirSituacao(e.target.value)}>
              {situacoes.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </div>
          <button onClick={consulta.recarregar}>Atualizar</button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{consulta.erro}</Aviso>

      <Cartao titulo={somenteProprias ? 'Solicitações que registrei' : 'Todas as solicitações'}>
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhuma solicitação encontrada.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data do serviço</th>
                  <th>Serviço</th>
                  {!somenteProprias && <th>Solicitante</th>}
                  <th>Substituto</th>
                  <th>Situação</th>
                  <th>Etapa atual</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((solicitacao) => (
                  <tr key={solicitacao.id_solicitacao}>
                    <td>{solicitacao.id_solicitacao}</td>
                    <td>{dataBr(solicitacao.data_servico)}</td>
                    <td>{solicitacao.nome_tipo_servico}</td>
                    {!somenteProprias && (
                      <td>
                        {solicitacao.solicitante_posto} {solicitacao.solicitante_nome_guerra}
                      </td>
                    )}
                    <td>
                      {solicitacao.substituto_nome_guerra
                        ? `${solicitacao.substituto_posto} ${solicitacao.substituto_nome_guerra}`
                        : '—'}
                    </td>
                    <td>
                      <Etiqueta situacao={solicitacao.situacao} texto={solicitacao.rotulo_situacao} />
                    </td>
                    <td className="discreto">{solicitacao.etapa_atual ?? 'Fluxo encerrado'}</td>
                    <td>
                      <button
                        className="pequeno"
                        onClick={() => definirIdSelecionada(solicitacao.id_solicitacao)}
                      >
                        Linha do tempo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {idSelecionada && (
        <LinhaDoTempo
          idSolicitacao={idSelecionada}
          permitirCancelamento={somenteProprias}
          aoFechar={() => definirIdSelecionada(null)}
          aoCancelar={() => {
            definirIdSelecionada(null);
            definirMensagem('Solicitação cancelada.');
            consulta.recarregar();
          }}
        />
      )}
    </>
  );
}

function LinhaDoTempo({
  idSolicitacao,
  permitirCancelamento,
  aoFechar,
  aoCancelar
}: {
  idSolicitacao: number;
  permitirCancelamento: boolean;
  aoFechar: () => void;
  aoCancelar: () => void;
}) {
  const [erro, definirErro] = useState('');
  const detalhe = useConsulta(
    () => api.get<DetalheSolicitacao>(`/solicitacoes/${idSolicitacao}`),
    [idSolicitacao]
  );

  async function cancelar() {
    definirErro('');
    try {
      await api.post(`/solicitacoes/${idSolicitacao}/cancelar`);
      aoCancelar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  const dados = detalhe.dados;
  const podeCancelar =
    permitirCancelamento &&
    dados?.solicitacao.situacao === dados?.etapas[0]?.situacaoAguardando &&
    dados?.solicitacao.situacao !== 'CANCELADA';

  return (
    <Modal
      titulo={`Solicitação nº ${idSolicitacao}`}
      aoFechar={aoFechar}
      rodape={
        <>
          {podeCancelar && (
            <button className="perigo" onClick={cancelar}>
              Cancelar solicitação
            </button>
          )}
          <button onClick={aoFechar}>Fechar</button>
        </>
      }
    >
      <Aviso tipo="erro">{erro || detalhe.erro}</Aviso>
      {!dados ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            {dados.solicitacao.nome_tipo_servico} em {dataBr(dados.solicitacao.data_servico)} ·{' '}
            <Etiqueta situacao={dados.solicitacao.situacao} texto={dados.solicitacao.rotulo_situacao} />
          </p>

          <ul className="timeline">
            <li>
              <strong>Solicitação registrada</strong>
              <div className="discreto">
                {dados.solicitacao.solicitante_posto} {dados.solicitacao.solicitante_nome_guerra} ·{' '}
                {dataHoraBr(dados.solicitacao.data_solicitacao)}
              </div>
              <div>{dados.solicitacao.motivo}</div>
            </li>

            {dados.pareceres.map((parecer) => (
              <li key={parecer.id_parecer}>
                <strong>
                  {parecer.etapa === 'TRIAGEM' ? 'Triagem do cabo' : 'Autorização do sargenteante'} —{' '}
                  {parecer.resultado}
                </strong>
                <div className="discreto">
                  {parecer.avaliador_posto} {parecer.avaliador_nome_guerra} ·{' '}
                  {dataHoraBr(parecer.data_parecer)}
                </div>
                <div>{parecer.justificativa}</div>
              </li>
            ))}

            {dados.etapaCorrente && (
              <li>
                <strong>Aguardando: {dados.etapaCorrente.rotulo}</strong>
                <div className="discreto">
                  Responsável: {dados.etapaCorrente.perfilResponsavel.replaceAll('_', ' ')}
                </div>
              </li>
            )}
          </ul>
        </>
      )}
    </Modal>
  );
}
