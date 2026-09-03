/**
 * Telas UC11 (triagem do cabo) e UC12 (autorização do sargenteante).
 *
 * Estas duas telas pertencem à FEATURE EXCLUSIVA DO MILSCALE — a aprovação de troca em duas
 * etapas encadeadas. Elas vivem numa pasta própria de variação e são montadas a partir das etapas
 * declaradas pela estratégia de aprovação do produto: se o produto configurado passar a usar
 * aprovação em etapa única (SmartScale), a etapa de triagem simplesmente deixa de existir no
 * fluxo e a rota correspondente não é oferecida, sem alteração no restante da interface.
 */
import { useState } from 'react';
import { api } from '../../servicos/api';
import { useSessao } from '../../contextoSessao';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Modal,
  Vazio,
  dataBr,
  dataHoraBr,
  useConsulta
} from '../../componentes/comuns';
import type { DetalheSolicitacao, Solicitacao } from '../../servicos/tipos';

interface Props {
  /** Etapa da cadeia que esta tela atende. */
  etapa: 'TRIAGEM' | 'AUTORIZACAO';
}

const configuracaoDaEtapa = {
  TRIAGEM: {
    situacao: 'EM_ANALISE_CABO',
    tituloFila: 'Solicitações aguardando triagem de viabilidade',
    rotuloAprovar: 'Parecer favorável — encaminhar ao sargenteante',
    rotuloRecusar: 'Parecer desfavorável — indeferir',
    explicacao:
      'Primeira etapa da cadeia (RN08): o cabo da sargenteação verifica se a troca é possível e, ' +
      'sendo viável, encaminha ao sargenteante. O parecer é gravado com etapa TRIAGEM.'
  },
  AUTORIZACAO: {
    situacao: 'AGUARDANDO_SARGENTEANTE',
    tituloFila: 'Solicitações aguardando autorização final',
    rotuloAprovar: 'Autorizar — aplica a troca na escala',
    rotuloRecusar: 'Negar solicitação',
    explicacao:
      'Etapa final da cadeia (RN08/RN09): a autorização do sargenteante altera a escala ' +
      'automaticamente e recalcula os contadores dos militares envolvidos. O parecer é gravado ' +
      'com etapa AUTORIZACAO.'
  }
} as const;

export function AvaliacaoDeTroca({ etapa }: Props) {
  const { sessao } = useSessao();
  const configuracao = configuracaoDaEtapa[etapa];
  const [idSelecionada, definirIdSelecionada] = useState<number | null>(null);
  const [mensagem, definirMensagem] = useState('');

  const fila = useConsulta(
    () => api.get<Solicitacao[]>(`/solicitacoes?situacao=${configuracao.situacao}`),
    [configuracao.situacao]
  );

  const etapaDeclarada = sessao?.produto.fluxoAprovacao.etapas.find((e) => e.etapa === etapa);

  return (
    <>
      <div className="caixa-variacao">
        <strong>Ponto de variação do produto ({sessao?.produto.fluxoAprovacao.identificador}).</strong>{' '}
        {configuracao.explicacao}
        {etapaDeclarada && (
          <div style={{ marginTop: 6 }}>
            Etapa {etapaDeclarada.ordem} de {sessao?.produto.fluxoAprovacao.etapas.length} —{' '}
            {etapaDeclarada.rotulo}. Perfil responsável:{' '}
            {etapaDeclarada.perfilResponsavel.replaceAll('_', ' ')}.
          </div>
        )}
      </div>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{fila.erro}</Aviso>

      <Cartao titulo={configuracao.tituloFila}>
        {fila.carregando ? (
          <Vazio>Carregando a fila…</Vazio>
        ) : !fila.dados || fila.dados.length === 0 ? (
          <Vazio>Não há solicitações nesta etapa.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Data do serviço</th>
                  <th>Serviço</th>
                  <th>Solicitante</th>
                  <th>Substituto indicado</th>
                  <th>Registrada em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fila.dados.map((solicitacao) => (
                  <tr key={solicitacao.id_solicitacao}>
                    <td>
                      <strong>{dataBr(solicitacao.data_servico)}</strong>
                      {solicitacao.trancado ? (
                        <div>
                          <Etiqueta situacao="NEGADA" texto="dia trancado" />
                        </div>
                      ) : null}
                    </td>
                    <td>{solicitacao.nome_tipo_servico}</td>
                    <td>
                      {solicitacao.solicitante_posto} {solicitacao.solicitante_nome_guerra}
                    </td>
                    <td>
                      {solicitacao.substituto_nome_guerra
                        ? `${solicitacao.substituto_posto} ${solicitacao.substituto_nome_guerra}`
                        : 'Troca aberta'}
                    </td>
                    <td className="discreto">{dataHoraBr(solicitacao.data_solicitacao)}</td>
                    <td>
                      <button
                        className="pequeno primario"
                        onClick={() => definirIdSelecionada(solicitacao.id_solicitacao)}
                      >
                        Analisar
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
        <PainelDeParecer
          idSolicitacao={idSelecionada}
          etapa={etapa}
          aoFechar={() => definirIdSelecionada(null)}
          aoConcluir={(texto) => {
            definirIdSelecionada(null);
            definirMensagem(texto);
            fila.recarregar();
          }}
        />
      )}
    </>
  );
}

function PainelDeParecer({
  idSolicitacao,
  etapa,
  aoFechar,
  aoConcluir
}: {
  idSolicitacao: number;
  etapa: 'TRIAGEM' | 'AUTORIZACAO';
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const configuracao = configuracaoDaEtapa[etapa];
  const [justificativa, definirJustificativa] = useState('');
  const [idSubstituto, definirIdSubstituto] = useState('');
  const [erro, definirErro] = useState('');
  const [enviando, definirEnviando] = useState(false);

  const detalhe = useConsulta(
    () => api.get<DetalheSolicitacao>(`/solicitacoes/${idSolicitacao}`),
    [idSolicitacao]
  );

  async function registrar(decisao: 'APROVAR' | 'RECUSAR' | 'DEVOLVER') {
    definirErro('');
    definirEnviando(true);
    try {
      await api.post(`/solicitacoes/${idSolicitacao}/parecer`, {
        decisao,
        justificativa,
        idMilitarSubstitutoSugerido: idSubstituto ? Number(idSubstituto) : undefined
      });
      aoConcluir(
        decisao === 'APROVAR'
          ? etapa === 'TRIAGEM'
            ? 'Parecer favorável registrado; a solicitação foi encaminhada ao sargenteante.'
            : 'Troca autorizada: a escala foi alterada e os envolvidos foram notificados.'
          : decisao === 'DEVOLVER'
            ? 'Solicitação devolvida ao cabo para reanálise.'
            : 'Solicitação indeferida e solicitante notificado.'
      );
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirEnviando(false);
    }
  }

  const dados = detalhe.dados;
  const decisoes = dados?.etapaCorrente?.decisoesPossiveis ?? [];
  const justificativaValida = justificativa.trim().length >= 5;

  return (
    <Modal
      titulo={`Solicitação nº ${idSolicitacao}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Fechar</button>
          {decisoes.includes('DEVOLVER') && (
            <button onClick={() => registrar('DEVOLVER')} disabled={enviando || !justificativaValida}>
              Devolver ao cabo
            </button>
          )}
          {decisoes.includes('RECUSAR') && (
            <button
              className="perigo"
              onClick={() => registrar('RECUSAR')}
              disabled={enviando || !justificativaValida}
            >
              {configuracao.rotuloRecusar}
            </button>
          )}
          {decisoes.includes('APROVAR') && (
            <button
              className="primario"
              onClick={() => registrar('APROVAR')}
              disabled={enviando || !justificativaValida}
            >
              {configuracao.rotuloAprovar}
            </button>
          )}
        </>
      }
    >
      <Aviso tipo="erro">{erro || detalhe.erro}</Aviso>

      {!dados ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <>
          <table style={{ marginBottom: 16 }}>
            <tbody>
              <tr>
                <th style={{ width: 170 }}>Serviço</th>
                <td>
                  {dados.solicitacao.nome_tipo_servico} — {dataBr(dados.solicitacao.data_servico)} às{' '}
                  {dados.solicitacao.hora_inicio}
                </td>
              </tr>
              <tr>
                <th>Solicitante</th>
                <td>
                  {dados.solicitacao.solicitante_posto} {dados.solicitacao.solicitante_nome_guerra}
                </td>
              </tr>
              <tr>
                <th>Substituto indicado</th>
                <td>
                  {dados.solicitacao.substituto_nome_guerra
                    ? `${dados.solicitacao.substituto_posto} ${dados.solicitacao.substituto_nome_guerra}`
                    : 'Troca aberta — nenhum substituto indicado'}
                </td>
              </tr>
              <tr>
                <th>Motivo</th>
                <td>{dados.solicitacao.motivo}</td>
              </tr>
              <tr>
                <th>Situação atual</th>
                <td>
                  <Etiqueta
                    situacao={dados.solicitacao.situacao}
                    texto={dados.solicitacao.rotulo_situacao}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <Aviso tipo={dados.validacaoAutomatica?.apto ? 'sucesso' : 'info'}>
            <strong>Validação automática de elegibilidade (UC15):</strong>{' '}
            {dados.validacaoAutomatica?.apto
              ? 'substituto apto para assumir este serviço nesta data.'
              : dados.validacaoAutomatica?.motivo}
          </Aviso>

          {(!dados.solicitacao.id_militar_substituto || etapa === 'TRIAGEM') && (
            <div className="campo">
              <label>
                Substituto sugerido pelo sistema (opcional — substitui a indicação do solicitante)
              </label>
              <select value={idSubstituto} onChange={(e) => definirIdSubstituto(e.target.value)}>
                <option value="">Manter a indicação atual</option>
                {dados.substitutosSugeridos.map((candidato) => (
                  <option key={candidato.id_militar} value={candidato.id_militar}>
                    {candidato.sigla_posto} {candidato.nome_guerra} — {candidato.dias_sem_servico} dias
                    sem serviço
                  </option>
                ))}
              </select>
            </div>
          )}

          {dados.pareceres.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8 }}>Pareceres já registrados</h4>
              <ul className="timeline">
                {dados.pareceres.map((parecer) => (
                  <li key={parecer.id_parecer}>
                    <strong>{parecer.etapa}</strong> — {parecer.resultado}
                    <div className="discreto">
                      {parecer.avaliador_posto} {parecer.avaliador_nome_guerra} ·{' '}
                      {dataHoraBr(parecer.data_parecer)}
                    </div>
                    <div>{parecer.justificativa}</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="campo">
            <label>Justificativa do parecer (obrigatória)</label>
            <textarea value={justificativa} onChange={(e) => definirJustificativa(e.target.value)} />
          </div>
        </>
      )}
    </Modal>
  );
}
