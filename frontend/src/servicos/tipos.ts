export type NomePerfil =
  | 'MILITAR_ESCALADO'
  | 'SD_EP_SARGENTEACAO'
  | 'CABO_SARGENTEACAO'
  | 'SARGENTEANTE';

export interface UsuarioSessao {
  id_usuario: number;
  id_militar: number;
  login: string;
  perfil: NomePerfil;
  nome_guerra: string;
  nome_completo: string;
  sigla_posto: string;
  permissoes: string[];
}

export interface EtapaAprovacao {
  ordem: number;
  etapa: 'TRIAGEM' | 'AUTORIZACAO';
  situacaoAguardando: string;
  perfilResponsavel: NomePerfil;
  rotulo: string;
  decisoesPossiveis: ('APROVAR' | 'RECUSAR' | 'DEVOLVER')[];
}

export interface ProdutoConfigurado {
  codigo: 'MILSCALE' | 'SMARTSCALE';
  nome: string;
  rotulos: Record<string, string>;
  regraElegibilidade: { identificador: string; descricao: string };
  fluxoAprovacao: { identificador: string; descricao: string; etapas: EtapaAprovacao[] };
}

export interface Sessao {
  usuario: UsuarioSessao;
  produto: ProdutoConfigurado;
  notificacoesNaoLidas: number;
}

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
  sigla_posto: string;
  descricao_posto: string;
  nivel_hierarquico: number;
  email: string | null;
  telefone: string | null;
  dias_sem_servico: number;
  data_fim_ultima_missao: string | null;
  situacao: 'ATIVO' | 'AFASTADO' | 'DESLIGADO';
  cursos: Curso[];
}

export interface RequisitoServico {
  id_requisito: number;
  id_posto: number;
  id_curso: number | null;
  obrigatorio: number;
  sigla_posto: string;
  nome_curso: string | null;
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
  requisitos: RequisitoServico[];
}

export interface RegraEscala {
  id_regra: number;
  id_tipo_servico: number;
  nome_tipo_servico: string;
  ciclo_minimo: number;
  ciclo_maximo: number | null;
  dias_servico: number;
  intervalo_minimo: number;
  max_servicos_mes: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

export interface Escala {
  id_escala: number;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  situacao: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';
  data_geracao: string;
}

export interface ServicoEscalado {
  id_servico_escalado: number;
  id_dia_escala: number;
  id_tipo_servico: number;
  id_militar: number | null;
  posicao: string | null;
  situacao: 'PREVISTO' | 'CUMPRIDO' | 'SUBSTITUIDO';
  observacao: string | null;
  data: string;
  trancado: number;
  motivo_trancamento: string | null;
  id_escala: number;
  situacao_escala: string;
  nome_tipo_servico: string;
  hora_inicio: string;
  duracao_horas: number;
  nome_guerra: string | null;
  nome_completo: string | null;
  sigla_posto: string | null;
  podeSolicitarTroca?: boolean;
  motivoBloqueioTroca?: string;
}

export interface DiaDaEscala {
  data: string;
  trancado: boolean;
  motivoTrancamento: string | null;
  idDiaEscala: number;
  situacaoEscala: string;
  servicos: ServicoEscalado[];
  pendencias: number;
}

export interface CicloCalculado {
  nomeTipoServico: string;
  efetivoElegivel: number;
  efetivoDiarioExigido: number;
  cicloCalculado: number;
  cicloAplicado: number;
  proporcao: string;
  abaixoDoMinimo: boolean;
  alerta?: string;
}

export interface RelatorioGeracao {
  idEscala: number;
  descricao: string;
  periodo: { inicio: string; fim: string };
  ciclos: CicloCalculado[];
  totalServicosGerados: number;
  totalPendencias: number;
  pendencias: { data: string; tipoServico: string; posicao: string; motivo: string }[];
  alertas: string[];
  duracaoMs: number;
}

export interface Missao {
  id_missao: number;
  id_militar: number;
  tipo: 'MISSAO' | 'DISPENSA' | 'FERIAS' | 'OUTRO';
  descricao: string;
  data_inicio: string;
  data_fim: string;
  nome_guerra: string;
  sigla_posto: string;
}

export interface Solicitacao {
  id_solicitacao: number;
  id_servico_escalado: number;
  id_militar_solicitante: number;
  id_militar_substituto: number | null;
  motivo: string;
  data_solicitacao: string;
  situacao: string;
  rotulo_situacao?: string;
  em_andamento?: boolean;
  etapa_atual?: string | null;
  data_servico: string;
  trancado: number;
  nome_tipo_servico: string;
  hora_inicio: string;
  posicao: string | null;
  solicitante_nome_guerra: string;
  solicitante_posto: string;
  substituto_nome_guerra: string | null;
  substituto_posto: string | null;
}

export interface Parecer {
  id_parecer: number;
  etapa: 'TRIAGEM' | 'AUTORIZACAO';
  resultado: string;
  justificativa: string;
  data_parecer: string;
  avaliador_nome_guerra: string;
  avaliador_posto: string;
  avaliador_perfil: string;
}

export interface SubstitutoSugerido {
  id_militar: number;
  nome_guerra: string;
  nome_completo?: string;
  sigla_posto: string;
  dias_sem_servico: number;
  sem_prioridade: boolean;
}

export interface DetalheSolicitacao {
  solicitacao: Solicitacao;
  pareceres: Parecer[];
  etapas: EtapaAprovacao[];
  etapaCorrente: EtapaAprovacao | null;
  podeAvaliar: boolean;
  validacaoAutomatica: { apto: boolean; motivo?: string } | null;
  substitutosSugeridos: SubstitutoSugerido[];
}

export interface Notificacao {
  id_notificacao: number;
  id_militar: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  canal: string;
  data_envio: string;
  situacao_envio: string;
  nome_guerra: string;
  sigla_posto: string;
}

export interface RegistroAuditoria {
  id_log: number;
  entidade: string;
  id_registro: number;
  acao: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  data_hora: string;
  nome_guerra: string | null;
  sigla_posto: string | null;
}
