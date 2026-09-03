import { useState } from 'react';
import { useSessao } from '../contextoSessao';
import { api } from '../servicos/api';
import { Aviso } from '../componentes/comuns';

const acessosDeDemonstracao = [
  { login: '10000000090', descricao: '2º Sgt Rossato — Sargenteante' },
  { login: '10000000061', descricao: 'Cb Petry — Cabo da Sargenteação' },
  { login: '10000000037', descricao: 'Sd EP Bueno — Soldado EP da Sargenteação' },
  { login: '10000000005', descricao: 'Rct Kaminski — Militar Escalado' }
];

export function Login() {
  const { entrar } = useSessao();
  const [login, definirLogin] = useState('');
  const [senha, definirSenha] = useState('');
  const [erro, definirErro] = useState('');
  const [aviso, definirAviso] = useState('');
  const [enviando, definirEnviando] = useState(false);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    definirErro('');
    definirEnviando(true);
    try {
      await entrar(login, senha);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirEnviando(false);
    }
  }

  async function recuperarSenha() {
    definirErro('');
    try {
      const resposta = await api.post<{ mensagem: string; senhaProvisoria: string }>(
        '/auth/senha-provisoria',
        { cpf: login }
      );
      definirAviso(`${resposta.mensagem} Senha provisória: ${resposta.senhaProvisoria}`);
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <div className="tela-login">
      <form className="caixa-login" onSubmit={submeter}>
        <h1>MilScale</h1>
        <p className="subtitulo">Gestão da escala de serviço · 5º Batalhão de Infantaria</p>

        <Aviso tipo="erro">{erro}</Aviso>
        <Aviso tipo="info">{aviso}</Aviso>

        <div className="campo">
          <label htmlFor="login">CPF ou identidade militar</label>
          <input
            id="login"
            value={login}
            onChange={(e) => definirLogin(e.target.value)}
            autoComplete="username"
            placeholder="somente números"
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => definirSenha(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="primario" disabled={enviando || !login || !senha}>
          {enviando ? 'Verificando…' : 'Entrar'}
        </button>

        <button type="button" className="pequeno" style={{ marginTop: 8 }} onClick={recuperarSenha} disabled={!login}>
          Esqueci minha senha
        </button>

        <div className="acessos-demo">
          Acessos de demonstração (senha <strong>milscale</strong>):
          {acessosDeDemonstracao.map((acesso) => (
            <button
              key={acesso.login}
              type="button"
              onClick={() => {
                definirLogin(acesso.login);
                definirSenha('milscale');
              }}
            >
              {acesso.descricao}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
