import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Etiqueta, Modal, Vazio, dataBr, hoje, useConsulta } from '../componentes/comuns';
import type { RegraEscala, TipoServico } from '../servicos/tipos';

interface FormularioRegra {
  id_tipo_servico: string;
  ciclo_minimo: string;
  ciclo_maximo: string;
  dias_servico: string;
  intervalo_minimo: string;
  max_servicos_mes: string;
  vigencia_inicio: string;
  vigencia_fim: string;
}

/** UC04 – Manter regras da escala. O ciclo efetivo não é cadastrado: é apurado a cada geração. */
export function Regras() {
  const [emEdicao, definirEmEdicao] = useState<RegraEscala | 'nova' | null>(null);
  const [mensagem, definirMensagem] = useState('');
  const [erro, definirErro] = useState('');

  const tipos = useConsulta(() => api.get<TipoServico[]>('/cadastros/tipos-servico'), []);
  const consulta = useConsulta(() => api.get<RegraEscala[]>('/cadastros/regras'), []);

  async function encerrar(regra: RegraEscala) {
    definirErro('');
    const dataFim = window.prompt('Data final da vigência (AAAA-MM-DD):', hoje());
    if (!dataFim) return;
    try {
      await api.post(`/cadastros/regras/${regra.id_regra}/encerrar`, { vigencia_fim: dataFim });
      definirMensagem('Vigência encerrada.');
      consulta.recarregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <p className="discreto" style={{ margin: 0 }}>
            A regra define os limites aceitáveis do ciclo, o intervalo mínimo entre dois serviços do
            mesmo militar e o limite mensal. O tamanho efetivo do ciclo (5x1, 4x1…) é calculado pelo
            sistema a cada geração, conforme o efetivo disponível no período.
          </p>
          <button className="primario" onClick={() => definirEmEdicao('nova')}>
            Incluir regra
          </button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      <Cartao titulo="Regras cadastradas">
        {!consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhuma regra cadastrada.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Tipo de serviço</th>
                  <th>Ciclo mín./máx.</th>
                  <th>Dias de serviço</th>
                  <th>Intervalo mínimo</th>
                  <th>Limite mensal</th>
                  <th>Vigência</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((regra) => (
                  <tr key={regra.id_regra}>
                    <td>
                      <strong>{regra.nome_tipo_servico}</strong>
                    </td>
                    <td>
                      {regra.ciclo_minimo} a {regra.ciclo_maximo ?? '∞'}
                    </td>
                    <td>{regra.dias_servico}</td>
                    <td>{regra.intervalo_minimo} dias</td>
                    <td>{regra.max_servicos_mes ?? 'sem limite'}</td>
                    <td>
                      {dataBr(regra.vigencia_inicio)} —{' '}
                      {regra.vigencia_fim ? (
                        dataBr(regra.vigencia_fim)
                      ) : (
                        <Etiqueta situacao="ATIVO" texto="vigente" />
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="pequeno" onClick={() => definirEmEdicao(regra)}>
                        Nova versão
                      </button>{' '}
                      {!regra.vigencia_fim && (
                        <button className="pequeno" onClick={() => encerrar(regra)}>
                          Encerrar
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
        <FormularioDeRegra
          regra={emEdicao === 'nova' ? null : emEdicao}
          tipos={tipos.dados ?? []}
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

function FormularioDeRegra({
  regra,
  tipos,
  aoFechar,
  aoSalvar
}: {
  regra: RegraEscala | null;
  tipos: TipoServico[];
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [formulario, definirFormulario] = useState<FormularioRegra>({
    id_tipo_servico: regra ? String(regra.id_tipo_servico) : '',
    ciclo_minimo: String(regra?.ciclo_minimo ?? 4),
    ciclo_maximo: regra?.ciclo_maximo ? String(regra.ciclo_maximo) : '',
    dias_servico: String(regra?.dias_servico ?? 1),
    intervalo_minimo: String(regra?.intervalo_minimo ?? 4),
    max_servicos_mes: regra?.max_servicos_mes ? String(regra.max_servicos_mes) : '',
    vigencia_inicio: hoje(),
    vigencia_fim: ''
  });
  const [erro, definirErro] = useState('');

  function atualizar(campo: keyof FormularioRegra, valor: string) {
    definirFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    definirErro('');
    const corpo = {
      id_tipo_servico: Number(formulario.id_tipo_servico),
      ciclo_minimo: Number(formulario.ciclo_minimo),
      ciclo_maximo: formulario.ciclo_maximo ? Number(formulario.ciclo_maximo) : null,
      dias_servico: Number(formulario.dias_servico),
      intervalo_minimo: Number(formulario.intervalo_minimo),
      max_servicos_mes: formulario.max_servicos_mes ? Number(formulario.max_servicos_mes) : null,
      vigencia_inicio: formulario.vigencia_inicio,
      vigencia_fim: formulario.vigencia_fim || null
    };
    try {
      if (regra) {
        await api.put(`/cadastros/regras/${regra.id_regra}`, corpo);
        aoSalvar('Nova versão da regra gravada; a vigência anterior foi encerrada.');
      } else {
        await api.post('/cadastros/regras', corpo);
        aoSalvar('Regra incluída.');
      }
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <Modal
      titulo={regra ? `Nova versão — ${regra.nome_tipo_servico}` : 'Incluir regra da escala'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={!formulario.id_tipo_servico}>
            Gravar
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <div className="campo">
        <label>Tipo de serviço</label>
        <select
          value={formulario.id_tipo_servico}
          onChange={(e) => atualizar('id_tipo_servico', e.target.value)}
          disabled={Boolean(regra)}
        >
          <option value="">Selecione</option>
          {tipos.map((tipo) => (
            <option key={tipo.id_tipo_servico} value={tipo.id_tipo_servico}>
              {tipo.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>Ciclo mínimo</label>
          <input
            type="number"
            min={1}
            value={formulario.ciclo_minimo}
            onChange={(e) => atualizar('ciclo_minimo', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Ciclo máximo (opcional)</label>
          <input
            type="number"
            min={1}
            value={formulario.ciclo_maximo}
            onChange={(e) => atualizar('ciclo_maximo', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Dias de serviço do ciclo</label>
          <input
            type="number"
            min={1}
            value={formulario.dias_servico}
            onChange={(e) => atualizar('dias_servico', e.target.value)}
          />
        </div>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>Intervalo mínimo entre serviços (dias)</label>
          <input
            type="number"
            min={1}
            value={formulario.intervalo_minimo}
            onChange={(e) => atualizar('intervalo_minimo', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Limite de serviços por mês</label>
          <input
            type="number"
            min={1}
            value={formulario.max_servicos_mes}
            onChange={(e) => atualizar('max_servicos_mes', e.target.value)}
          />
        </div>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>Início da vigência</label>
          <input
            type="date"
            value={formulario.vigencia_inicio}
            onChange={(e) => atualizar('vigencia_inicio', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Fim da vigência (vazio = vigente)</label>
          <input
            type="date"
            value={formulario.vigencia_fim}
            onChange={(e) => atualizar('vigencia_fim', e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
