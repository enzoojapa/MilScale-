import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Etiqueta, Modal, Vazio, dataBr, hoje, useConsulta } from '../componentes/comuns';
import type { Militar, Missao } from '../servicos/tipos';

/** UC16 – Manter missões e impedimentos (RN15, RN16). */
export function Missoes() {
  const [emEdicao, definirEmEdicao] = useState<Missao | 'nova' | null>(null);
  const [mensagem, definirMensagem] = useState('');
  const [erro, definirErro] = useState('');
  const [somenteVigentes, definirSomenteVigentes] = useState(true);

  const militares = useConsulta(() => api.get<Militar[]>('/cadastros/militares?situacao=ATIVO'), []);
  const consulta = useConsulta(
    () => api.get<Missao[]>(`/cadastros/missoes${somenteVigentes ? `?aPartirDe=${hoje()}` : ''}`),
    [somenteVigentes]
  );

  async function encerrar(missao: Missao) {
    definirErro('');
    try {
      await api.post(`/cadastros/missoes/${missao.id_missao}/encerrar`);
      definirMensagem(
        `Impedimento de ${missao.nome_guerra} encerrado. Ele retorna à fila sem prioridade na escalação.`
      );
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  async function excluir(missao: Missao) {
    definirErro('');
    if (!window.confirm(`Excluir o impedimento de ${missao.nome_guerra}?`)) return;
    try {
      await api.remover(`/cadastros/missoes/${missao.id_missao}`);
      definirMensagem('Impedimento excluído.');
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <p className="discreto" style={{ margin: 0, flex: '2 1 300px' }}>
            O militar com impedimento registrado não é escalado na data, ainda que seja o primeiro da
            fila; o serviço passa ao próximo elegível. No retorno, ele volta à fila sem precedência.
          </p>
          <label style={{ flex: '0 0 auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={somenteVigentes}
              onChange={(e) => definirSomenteVigentes(e.target.checked)}
            />
            Somente vigentes e futuros
          </label>
          <button className="primario" onClick={() => definirEmEdicao('nova')}>
            Registrar impedimento
          </button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      <Cartao titulo="Missões e impedimentos">
        {!consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhum impedimento registrado.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Militar</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Descrição</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((missao) => (
                  <tr key={missao.id_missao}>
                    <td>
                      {missao.sigla_posto} <strong>{missao.nome_guerra}</strong>
                    </td>
                    <td>
                      <Etiqueta situacao={missao.tipo} />
                    </td>
                    <td>
                      {dataBr(missao.data_inicio)} a {dataBr(missao.data_fim)}
                    </td>
                    <td className="discreto">{missao.descricao}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="pequeno" onClick={() => definirEmEdicao(missao)}>
                        Editar
                      </button>{' '}
                      {missao.data_fim > hoje() && (
                        <button className="pequeno" onClick={() => encerrar(missao)}>
                          Encerrar
                        </button>
                      )}{' '}
                      {missao.data_inicio > hoje() && (
                        <button className="pequeno perigo" onClick={() => excluir(missao)}>
                          Excluir
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

      {emEdicao && (
        <FormularioDeMissao
          missao={emEdicao === 'nova' ? null : emEdicao}
          militares={militares.dados ?? []}
          aoFechar={() => definirEmEdicao(null)}
          aoSalvar={(texto) => {
            definirEmEdicao(null);
            definirMensagem(texto);
            consulta.recarregar();
          }}
        />
      )}
    </>
  );
}

function FormularioDeMissao({
  missao,
  militares,
  aoFechar,
  aoSalvar
}: {
  missao: Missao | null;
  militares: Militar[];
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [idMilitar, definirIdMilitar] = useState(String(missao?.id_militar ?? ''));
  const [tipo, definirTipo] = useState(missao?.tipo ?? 'MISSAO');
  const [descricao, definirDescricao] = useState(missao?.descricao ?? '');
  const [dataInicio, definirDataInicio] = useState(missao?.data_inicio ?? hoje());
  const [dataFim, definirDataFim] = useState(missao?.data_fim ?? hoje());
  const [erro, definirErro] = useState('');

  async function salvar() {
    definirErro('');
    const corpo = {
      id_militar: Number(idMilitar),
      tipo,
      descricao,
      data_inicio: dataInicio,
      data_fim: dataFim
    };
    try {
      if (missao) {
        await api.put(`/cadastros/missoes/${missao.id_missao}`, corpo);
        aoSalvar('Impedimento atualizado.');
      } else {
        const resposta = await api.post<{ servicosAfetados: { data: string; tipoServico: string }[] }>(
          '/cadastros/missoes',
          corpo
        );
        aoSalvar(
          resposta.servicosAfetados.length > 0
            ? `Impedimento registrado. ${resposta.servicosAfetados.length} serviço(s) já escalado(s) ` +
                'no período foram marcados como pendentes de substituição.'
            : 'Impedimento registrado; as datas ficam bloqueadas para escalação.'
        );
      }
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <Modal
      titulo={missao ? `Editar impedimento de ${missao.nome_guerra}` : 'Registrar missão ou impedimento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={!idMilitar || !descricao.trim()}>
            Gravar
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <div className="linha-campos">
        <div className="campo" style={{ flex: '2 1 240px' }}>
          <label>Militar</label>
          <select value={idMilitar} onChange={(e) => definirIdMilitar(e.target.value)}>
            <option value="">Selecione</option>
            {militares.map((militar) => (
              <option key={militar.id_militar} value={militar.id_militar}>
                {militar.sigla_posto} {militar.nome_guerra} — {militar.nome_completo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => definirTipo(e.target.value as Missao['tipo'])}>
            <option value="MISSAO">Missão</option>
            <option value="DISPENSA">Dispensa</option>
            <option value="FERIAS">Férias</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>Data inicial</label>
          <input type="date" value={dataInicio} onChange={(e) => definirDataInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label>Data final</label>
          <input type="date" value={dataFim} onChange={(e) => definirDataFim(e.target.value)} />
        </div>
      </div>

      <div className="campo">
        <label>Descrição</label>
        <textarea value={descricao} onChange={(e) => definirDescricao(e.target.value)} />
      </div>
    </Modal>
  );
}
