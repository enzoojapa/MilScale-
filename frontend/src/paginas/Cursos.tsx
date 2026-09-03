import { useState } from 'react';
import { api } from '../servicos/api';
import { Aviso, Cartao, Modal, Vazio, useConsulta } from '../componentes/comuns';
import type { Curso } from '../servicos/tipos';

/** RF05 – Manter cursos e qualificações (CFC, Motorista, Rancho). */
export function Cursos() {
  const [emEdicao, definirEmEdicao] = useState<Curso | 'novo' | null>(null);
  const [mensagem, definirMensagem] = useState('');
  const [erro, definirErro] = useState('');
  const consulta = useConsulta(() => api.get<Curso[]>('/cadastros/cursos'), []);

  async function excluir(curso: Curso) {
    definirErro('');
    definirMensagem('');
    if (!window.confirm(`Excluir o curso "${curso.nome}"?`)) return;
    try {
      await api.remover(`/cadastros/cursos/${curso.id_curso}`);
      definirMensagem('Curso excluído.');
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
            Os cursos vinculados ao militar são a segunda condição de elegibilidade: além do
            posto/graduação privativo, alguns serviços exigem qualificação específica.
          </p>
          <button className="primario" onClick={() => definirEmEdicao('novo')}>
            Incluir curso
          </button>
        </div>
      </Cartao>

      <Aviso tipo="sucesso">{mensagem}</Aviso>
      <Aviso tipo="erro">{erro || consulta.erro}</Aviso>

      <Cartao titulo="Cursos e qualificações">
        {!consulta.dados || consulta.dados.length === 0 ? (
          <Vazio>Nenhum curso cadastrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {consulta.dados.map((curso) => (
                <tr key={curso.id_curso}>
                  <td>
                    <strong>{curso.nome}</strong>
                  </td>
                  <td className="discreto">{curso.descricao ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="pequeno" onClick={() => definirEmEdicao(curso)}>
                      Editar
                    </button>{' '}
                    <button className="pequeno perigo" onClick={() => excluir(curso)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>

      {emEdicao && (
        <FormularioDeCurso
          curso={emEdicao === 'novo' ? null : emEdicao}
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

function FormularioDeCurso({
  curso,
  aoFechar,
  aoSalvar
}: {
  curso: Curso | null;
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [nome, definirNome] = useState(curso?.nome ?? '');
  const [descricao, definirDescricao] = useState(curso?.descricao ?? '');
  const [erro, definirErro] = useState('');

  async function salvar() {
    definirErro('');
    try {
      if (curso) {
        await api.put(`/cadastros/cursos/${curso.id_curso}`, { nome, descricao });
        aoSalvar(`Curso "${nome}" atualizado.`);
      } else {
        await api.post('/cadastros/cursos', { nome, descricao });
        aoSalvar(`Curso "${nome}" incluído.`);
      }
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <Modal
      titulo={curso ? `Editar ${curso.nome}` : 'Incluir curso'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={!nome.trim()}>
            Gravar
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <div className="campo">
        <label>Nome do curso</label>
        <input value={nome} onChange={(e) => definirNome(e.target.value)} />
      </div>
      <div className="campo">
        <label>Descrição</label>
        <textarea value={descricao} onChange={(e) => definirDescricao(e.target.value)} />
      </div>
    </Modal>
  );
}
