import { useState } from 'react';
import { api } from '../servicos/api';
import {
  Aviso,
  Cartao,
  Etiqueta,
  Modal,
  Vazio,
  dataBr,
  useConsulta
} from '../componentes/comuns';
import type { Curso, Militar, PostoGraduacao } from '../servicos/tipos';

interface FormularioMilitar {
  nome_completo: string;
  nome_guerra: string;
  cpf: string;
  id_posto: string;
  email: string;
  telefone: string;
  situacao: 'ATIVO' | 'AFASTADO' | 'DESLIGADO';
  cursos: number[];
  perfil: string;
}

const formularioVazio: FormularioMilitar = {
  nome_completo: '',
  nome_guerra: '',
  cpf: '',
  id_posto: '',
  email: '',
  telefone: '',
  situacao: 'ATIVO',
  cursos: [],
  perfil: 'MILITAR_ESCALADO'
};

/** UC02 – Manter perfil de militar. */
export function Militares() {
  const [busca, definirBusca] = useState('');
  const [idPosto, definirIdPosto] = useState('');
  const [situacao, definirSituacao] = useState('');
  const [emEdicao, definirEmEdicao] = useState<Militar | 'novo' | null>(null);
  const [mensagem, definirMensagem] = useState('');
  const [erro, definirErro] = useState('');

  const postos = useConsulta(() => api.get<PostoGraduacao[]>('/cadastros/postos'), []);
  const cursos = useConsulta(() => api.get<Curso[]>('/cadastros/cursos'), []);
  const consulta = useConsulta(
    () =>
      api.get<Militar[]>(
        '/cadastros/militares?' +
          new URLSearchParams({
            ...(busca ? { busca } : {}),
            ...(idPosto ? { idPosto } : {}),
            ...(situacao ? { situacao } : {})
          }).toString()
      ),
    [busca, idPosto, situacao]
  );

  async function alternarSituacao(militar: Militar) {
    definirErro('');
    definirMensagem('');
    try {
      if (militar.situacao === 'ATIVO') {
        const motivo = window.prompt('Motivo da inativação:');
        if (!motivo) return;
        await api.post(`/cadastros/militares/${militar.id_militar}/inativar`, { motivo });
        definirMensagem(`${militar.nome_guerra} inativado; o histórico de serviços foi mantido.`);
      } else {
        await api.post(`/cadastros/militares/${militar.id_militar}/reativar`);
        definirMensagem(`${militar.nome_guerra} reativado.`);
      }
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
            <label>Buscar por nome, nome de guerra ou CPF</label>
            <input value={busca} onChange={(e) => definirBusca(e.target.value)} />
          </div>
          <div>
            <label>Posto/graduação</label>
            <select value={idPosto} onChange={(e) => definirIdPosto(e.target.value)}>
              <option value="">Todos</option>
              {(postos.dados ?? []).map((posto) => (
                <option key={posto.id_posto} value={posto.id_posto}>
                  {posto.sigla} — {posto.descricao}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Situação</label>
            <select value={situacao} onChange={(e) => definirSituacao(e.target.value)}>
              <option value="">Todas</option>
              <option value="ATIVO">Ativo</option>
              <option value="AFASTADO">Afastado</option>
              <option value="DESLIGADO">Desligado</option>
            </select>
          </div>
          <button className="primario" onClick={() => definirEmEdicao('novo')}>
            Incluir militar
          </button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      <Cartao titulo={`${consulta.dados?.length ?? 0} militar(es)`}>
        {consulta.carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : !consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhum militar encontrado com os filtros aplicados.</Vazio>
        ) : (
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Posto</th>
                  <th>Nome de guerra</th>
                  <th>Nome completo</th>
                  <th>Cursos</th>
                  <th>Dias sem serviço</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consulta.dados.map((militar) => (
                  <tr key={militar.id_militar}>
                    <td>{militar.sigla_posto}</td>
                    <td>
                      <strong>{militar.nome_guerra}</strong>
                    </td>
                    <td>
                      {militar.nome_completo}
                      <div className="discreto">{militar.email}</div>
                    </td>
                    <td>
                      {militar.cursos.length === 0 ? (
                        <span className="discreto">—</span>
                      ) : (
                        militar.cursos.map((curso) => (
                          <span key={curso.id_curso} className="etiqueta neutra" style={{ marginRight: 4 }}>
                            {curso.nome}
                          </span>
                        ))
                      )}
                    </td>
                    <td>{militar.dias_sem_servico}</td>
                    <td>
                      <Etiqueta situacao={militar.situacao} />
                      {militar.data_fim_ultima_missao && (
                        <div className="discreto">
                          missão até {dataBr(militar.data_fim_ultima_missao)}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="pequeno" onClick={() => definirEmEdicao(militar)}>
                        Editar
                      </button>{' '}
                      <button className="pequeno" onClick={() => alternarSituacao(militar)}>
                        {militar.situacao === 'ATIVO' ? 'Inativar' : 'Reativar'}
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
        <FormularioDeMilitar
          militar={emEdicao === 'novo' ? null : emEdicao}
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

function FormularioDeMilitar({
  militar,
  postos,
  cursos,
  aoFechar,
  aoSalvar
}: {
  militar: Militar | null;
  postos: PostoGraduacao[];
  cursos: Curso[];
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [formulario, definirFormulario] = useState<FormularioMilitar>(
    militar
      ? {
          nome_completo: militar.nome_completo,
          nome_guerra: militar.nome_guerra,
          cpf: militar.cpf,
          id_posto: String(militar.id_posto),
          email: militar.email ?? '',
          telefone: militar.telefone ?? '',
          situacao: militar.situacao,
          cursos: militar.cursos.map((c) => c.id_curso),
          perfil: ''
        }
      : formularioVazio
  );
  const [erro, definirErro] = useState('');
  const [enviando, definirEnviando] = useState(false);

  function atualizar<K extends keyof FormularioMilitar>(campo: K, valor: FormularioMilitar[K]) {
    definirFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    definirErro('');
    definirEnviando(true);
    const corpo = {
      ...formulario,
      id_posto: Number(formulario.id_posto),
      email: formulario.email || null,
      telefone: formulario.telefone || null,
      perfil: formulario.perfil || undefined,
      cursos: formulario.cursos.map((id_curso) => ({
        id_curso,
        data_conclusao: new Date().toISOString().slice(0, 10)
      }))
    };
    try {
      if (militar) {
        await api.put(`/cadastros/militares/${militar.id_militar}`, corpo);
        aoSalvar(`Cadastro de ${formulario.nome_guerra} atualizado.`);
      } else {
        await api.post('/cadastros/militares', corpo);
        aoSalvar(
          `${formulario.nome_guerra} cadastrado. O usuário de acesso foi criado com senha provisória ` +
            '(seis primeiros dígitos do CPF).'
        );
      }
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <Modal
      titulo={militar ? `Editar ${militar.nome_guerra}` : 'Incluir militar'}
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

      <div className="linha-campos">
        <div className="campo" style={{ flex: '2 1 260px' }}>
          <label>Nome completo</label>
          <input
            value={formulario.nome_completo}
            onChange={(e) => atualizar('nome_completo', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Nome de guerra</label>
          <input
            value={formulario.nome_guerra}
            onChange={(e) => atualizar('nome_guerra', e.target.value)}
          />
        </div>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>CPF (11 dígitos)</label>
          <input value={formulario.cpf} onChange={(e) => atualizar('cpf', e.target.value)} />
        </div>
        <div className="campo">
          <label>Posto/graduação</label>
          <select value={formulario.id_posto} onChange={(e) => atualizar('id_posto', e.target.value)}>
            <option value="">Selecione</option>
            {postos.map((posto) => (
              <option key={posto.id_posto} value={posto.id_posto}>
                {posto.sigla} — {posto.descricao}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Situação</label>
          <select
            value={formulario.situacao}
            onChange={(e) => atualizar('situacao', e.target.value as FormularioMilitar['situacao'])}
          >
            <option value="ATIVO">Ativo</option>
            <option value="AFASTADO">Afastado</option>
            <option value="DESLIGADO">Desligado</option>
          </select>
        </div>
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label>E-mail para notificação</label>
          <input value={formulario.email} onChange={(e) => atualizar('email', e.target.value)} />
        </div>
        <div className="campo">
          <label>Telefone</label>
          <input value={formulario.telefone} onChange={(e) => atualizar('telefone', e.target.value)} />
        </div>
        <div className="campo">
          <label>Perfil de acesso</label>
          <select value={formulario.perfil} onChange={(e) => atualizar('perfil', e.target.value)}>
            <option value="">Manter o perfil atual</option>
            <option value="MILITAR_ESCALADO">Militar Escalado</option>
            <option value="SD_EP_SARGENTEACAO">Soldado EP da Sargenteação</option>
            <option value="CABO_SARGENTEACAO">Cabo da Sargenteação</option>
            <option value="SARGENTEANTE">Sargenteante</option>
          </select>
        </div>
      </div>

      <div className="campo">
        <label>Cursos e qualificações concluídos</label>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {cursos.map((curso) => (
            <label key={curso.id_curso} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={formulario.cursos.includes(curso.id_curso)}
                onChange={(e) =>
                  atualizar(
                    'cursos',
                    e.target.checked
                      ? [...formulario.cursos, curso.id_curso]
                      : formulario.cursos.filter((id) => id !== curso.id_curso)
                  )
                }
              />
              {curso.nome}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
