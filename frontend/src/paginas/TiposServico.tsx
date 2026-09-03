import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Etiqueta, Modal, Vazio, useConsulta } from '../componentes/comuns';
import type { Curso, PostoGraduacao, TipoServico } from '../servicos/tipos';

interface RequisitoFormulario {
  id_posto: string;
  id_curso: string;
}

interface FormularioTipo {
  nome: string;
  descricao: string;
  efetivo_necessario: string;
  hora_inicio: string;
  duracao_horas: string;
  exige_pernoite: boolean;
  ativo: boolean;
  requisitos: RequisitoFormulario[];
}

/** UC03 – Manter tipos de serviço e seus requisitos de elegibilidade (RN02, RN03). */
export function TiposServico() {
  const [emEdicao, definirEmEdicao] = useState<TipoServico | 'novo' | null>(null);
  const [mensagem, definirMensagem] = useState('');

  const postos = useConsulta(() => api.get<PostoGraduacao[]>('/cadastros/postos'), []);
  const cursos = useConsulta(() => api.get<Curso[]>('/cadastros/cursos'), []);
  const consulta = useConsulta(() => api.get<TipoServico[]>('/cadastros/tipos-servico'), []);

  return (
    <>
      <Cartao>
        <div className="linha-campos">
          <p className="discreto" style={{ margin: 0 }}>
            Cada tipo de serviço é privativo de um posto/graduação e pode exigir curso específico. É
            essa configuração, armazenada como dado, que alimenta o filtro automático de elegibilidade.
          </p>
          <button className="primario" onClick={() => definirEmEdicao('novo')}>
            Incluir tipo de serviço
          </button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{consulta.erro}</Aviso>

      <Cartao titulo="Tipos de serviço do batalhão">
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Tipo de serviço</th>
                  <th>Efetivo/dia</th>
                  <th>Turno</th>
                  <th>Posto/graduação habilitado</th>
                  <th>Curso exigido</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(consulta.dados ?? []).map((tipo) => (
                  <tr key={tipo.id_tipo_servico}>
                    <td>
                      <strong>{tipo.nome}</strong>
                      <div className="discreto">{tipo.descricao}</div>
                    </td>
                    <td>{tipo.efetivo_necessario}</td>
                    <td className="discreto">
                      {tipo.hora_inicio} · {tipo.duracao_horas}h
                    </td>
                    <td>{tipo.requisitos.map((r) => r.sigla_posto).join(', ') || '—'}</td>
                    <td>
                      {tipo.requisitos
                        .filter((r) => r.nome_curso)
                        .map((r) => r.nome_curso)
                        .join(', ') || <span className="discreto">nenhum</span>}
                    </td>
                    <td>
                      <Etiqueta situacao={tipo.ativo ? 'ATIVO' : 'DESLIGADO'} texto={tipo.ativo ? 'ativo' : 'inativo'} />
                    </td>
                    <td>
                      <button className="pequeno" onClick={() => definirEmEdicao(tipo)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {emEdicao && (
        <FormularioDeTipo
          tipo={emEdicao === 'novo' ? null : emEdicao}
          postos={postos.dados ?? []}
          cursos={cursos.dados ?? []}
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

function FormularioDeTipo({
  tipo,
  postos,
  cursos,
  aoFechar,
  aoSalvar
}: {
  tipo: TipoServico | null;
  postos: PostoGraduacao[];
  cursos: Curso[];
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [formulario, definirFormulario] = useState<FormularioTipo>(
    tipo
      ? {
          nome: tipo.nome,
          descricao: tipo.descricao ?? '',
          efetivo_necessario: String(tipo.efetivo_necessario),
          hora_inicio: tipo.hora_inicio,
          duracao_horas: String(tipo.duracao_horas),
          exige_pernoite: Boolean(tipo.exige_pernoite),
          ativo: Boolean(tipo.ativo),
          requisitos: tipo.requisitos.map((r) => ({
            id_posto: String(r.id_posto),
            id_curso: r.id_curso ? String(r.id_curso) : ''
          }))
        }
      : {
          nome: '',
          descricao: '',
          efetivo_necessario: '1',
          hora_inicio: '08:00',
          duracao_horas: '24',
          exige_pernoite: true,
          ativo: true,
          requisitos: [{ id_posto: '', id_curso: '' }]
        }
  );
  const [erro, definirErro] = useState('');
  const [enviando, definirEnviando] = useState(false);

  async function salvar() {
    definirErro('');
    definirEnviando(true);
    const corpo = {
      nome: formulario.nome,
      descricao: formulario.descricao || null,
      efetivo_necessario: Number(formulario.efetivo_necessario),
      hora_inicio: formulario.hora_inicio,
      duracao_horas: Number(formulario.duracao_horas),
      exige_pernoite: formulario.exige_pernoite,
      ativo: formulario.ativo,
      requisitos: formulario.requisitos
        .filter((r) => r.id_posto)
        .map((r) => ({
          id_posto: Number(r.id_posto),
          id_curso: r.id_curso ? Number(r.id_curso) : null,
          obrigatorio: true
        }))
    };
    try {
      if (tipo) {
        await api.put(`/cadastros/tipos-servico/${tipo.id_tipo_servico}`, corpo);
        aoSalvar(`Tipo de serviço "${formulario.nome}" atualizado.`);
      } else {
        await api.post('/cadastros/tipos-servico', corpo);
        aoSalvar(`Tipo de serviço "${formulario.nome}" incluído.`);
      }
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <Modal
      titulo={tipo ? `Editar ${tipo.nome}` : 'Incluir tipo de serviço'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={enviando}>
            {enviando ? 'Gravando…' : 'Gravar'}
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <div className="campo">
        <label>Nome</label>
        <input
          value={formulario.nome}
          onChange={(e) => definirFormulario({ ...formulario, nome: e.target.value })}
        />
      </div>

      <div className="campo">
        <label>Descrição das atribuições</label>
        <textarea
          value={formulario.descricao}
          onChange={(e) => definirFormulario({ ...formulario, descricao: e.target.value })}
        />
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>Efetivo necessário por dia</label>
          <input
            type="number"
            min={1}
            value={formulario.efetivo_necessario}
            onChange={(e) => definirFormulario({ ...formulario, efetivo_necessario: e.target.value })}
          />
        </div>
        <div className="campo">
          <label>Início do turno</label>
          <input
            type="time"
            value={formulario.hora_inicio}
            onChange={(e) => definirFormulario({ ...formulario, hora_inicio: e.target.value })}
          />
        </div>
        <div className="campo">
          <label>Duração (horas)</label>
          <input
            type="number"
            min={1}
            value={formulario.duracao_horas}
            onChange={(e) => definirFormulario({ ...formulario, duracao_horas: e.target.value })}
          />
        </div>
      </div>

      <div className="linha-campos" style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={formulario.exige_pernoite}
            onChange={(e) => definirFormulario({ ...formulario, exige_pernoite: e.target.checked })}
          />
          Exige pernoite
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={formulario.ativo}
            onChange={(e) => definirFormulario({ ...formulario, ativo: e.target.checked })}
          />
          Ativo
        </label>
      </div>

      <label>Requisitos de elegibilidade</label>
      {formulario.requisitos.map((requisito, indice) => (
        <div className="linha-campos" key={indice} style={{ marginBottom: 8 }}>
          <select
            value={requisito.id_posto}
            onChange={(e) => {
              const copia = [...formulario.requisitos];
              copia[indice] = { ...copia[indice], id_posto: e.target.value };
              definirFormulario({ ...formulario, requisitos: copia });
            }}
          >
            <option value="">Posto/graduação habilitado</option>
            {postos.map((posto) => (
              <option key={posto.id_posto} value={posto.id_posto}>
                {posto.sigla} — {posto.descricao}
              </option>
            ))}
          </select>
          <select
            value={requisito.id_curso}
            onChange={(e) => {
              const copia = [...formulario.requisitos];
              copia[indice] = { ...copia[indice], id_curso: e.target.value };
              definirFormulario({ ...formulario, requisitos: copia });
            }}
          >
            <option value="">Sem curso exigido</option>
            {cursos.map((curso) => (
              <option key={curso.id_curso} value={curso.id_curso}>
                {curso.nome}
              </option>
            ))}
          </select>
          <button
            className="pequeno"
            onClick={() =>
              definirFormulario({
                ...formulario,
                requisitos: formulario.requisitos.filter((_, i) => i !== indice)
              })
            }
          >
            Remover
          </button>
        </div>
      ))}
      <button
        className="pequeno"
        onClick={() =>
          definirFormulario({
            ...formulario,
            requisitos: [...formulario.requisitos, { id_posto: '', id_curso: '' }]
          })
        }
      >
        Adicionar requisito
      </button>
    </Modal>
  );
}
