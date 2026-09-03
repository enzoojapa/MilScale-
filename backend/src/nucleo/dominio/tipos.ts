export type SituacaoMilitar = 'ATIVO' | 'AFASTADO' | 'DESLIGADO';
export type SituacaoEscala = 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';
export type SituacaoServicoEscalado = 'PREVISTO' | 'CUMPRIDO' | 'SUBSTITUIDO';
export type TipoMissao = 'MISSAO' | 'DISPENSA' | 'FERIAS' | 'OUTRO';
export type SituacaoSolicitacao =
  | 'EM_ANALISE_CABO'
  | 'AGUARDANDO_SARGENTEANTE'
  | 'AUTORIZADA'
  | 'NEGADA'
  | 'CANCELADA';
export type EtapaParecer = 'TRIAGEM' | 'AUTORIZACAO';
export type ResultadoParecer = 'FAVORAVEL' | 'DESFAVORAVEL' | 'AUTORIZADA' | 'NEGADA';
export type TipoNotificacao = 'SERVICO_D1' | 'STATUS_SOLICITACAO' | 'ESCALA_PUBLICADA';
export type CanalNotificacao = 'EMAIL' | 'PUSH' | 'SISTEMA';
export type AcaoAuditoria = 'INCLUSAO' | 'ALTERACAO' | 'EXCLUSAO' | 'ACESSO';

export type NomePerfil =
  | 'MILITAR_ESCALADO'
  | 'SD_EP_SARGENTEACAO'
  | 'CABO_SARGENTEACAO'
  | 'SARGENTEANTE';

export interface PostoGraduacao {
  id_posto: number;
  sigla: string;
  descricao: string;
  nivel_hierarquico: number;
}

export interface Curso {
  id_curso: number;
  nome: string;
  descricao: string | null;
}

export interface Militar {
  id_militar: number;
  nome_completo: string;
  nome_guerra: string;
  cpf: string;
  id_posto: number;
  email: string | null;
  telefone: string | null;
  dias_sem_servico: number;
  data_fim_ultima_missao: string | null;
  situacao: SituacaoMilitar;
}

export interface MilitarDetalhado extends Militar {
  sigla_posto: string;
  descricao_posto: string;
  nivel_hierarquico: number;
  cursos: Curso[];
}

export interface TipoServico {
  id_tipo_servico: number;
  nome: string;
  descricao: string | null;
  efetivo_necessario: number;
  hora_inicio: string;
  duracao_horas: number;
  exige_pernoite: number;
  ativo: number;
}

export interface RequisitoServico {
  id_requisito: number;
  id_tipo_servico: number;
  id_posto: number;
  id_curso: number | null;
  obrigatorio: number;
}

export interface RegraEscala {
  id_regra: number;
  id_tipo_servico: number;
  ciclo_minimo: number;
  ciclo_maximo: number | null;
  dias_servico: number;
  intervalo_minimo: number;
  max_servicos_mes: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  id_usuario_criacao: number | null;
}

export interface Escala {
  id_escala: number;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  situacao: SituacaoEscala;
  data_geracao: string;
  id_usuario_geracao: number | null;
}

export interface DiaEscala {
  id_dia_escala: number;
  id_escala: number;
  data: string;
  trancado: number;
  motivo_trancamento: string | null;
  id_usuario_trancamento: number | null;
  data_trancamento: string | null;
}

export interface ServicoEscalado {
  id_servico_escalado: number;
  id_dia_escala: number;
  id_tipo_servico: number;
  id_militar: number | null;
  posicao: string | null;
  situacao: SituacaoServicoEscalado;
  observacao: string | null;
}

export interface Missao {
  id_missao: number;
  id_militar: number;
  tipo: TipoMissao;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  id_usuario_registro: number | null;
  data_registro: string;
}

export interface SolicitacaoTroca {
  id_solicitacao: number;
  id_servico_escalado: number;
  id_militar_solicitante: number;
  id_militar_substituto: number | null;
  motivo: string;
  data_solicitacao: string;
  situacao: SituacaoSolicitacao;
}

export interface ParecerSolicitacao {
  id_parecer: number;
  id_solicitacao: number;
  id_usuario_avaliador: number;
  etapa: EtapaParecer;
  resultado: ResultadoParecer;
  justificativa: string;
  data_parecer: string;
}

export interface UsuarioAutenticado {
  id_usuario: number;
  id_militar: number;
  id_perfil: number;
  login: string;
  perfil: NomePerfil;
  nome_guerra: string;
  nome_completo: string;
  sigla_posto: string;
  permissoes: string[];
}
