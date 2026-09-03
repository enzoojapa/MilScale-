-- Modelo lógico do MilScale (seção 9 do detalhamento): 19 tabelas em quatro blocos.
-- Os nomes de tabela, de coluna e as restrições reproduzem o dicionário de dados.
-- Bloco 1 - identificação e acesso.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS LOG_AUDITORIA;
DROP TABLE IF EXISTS NOTIFICACAO;
DROP TABLE IF EXISTS PARECER_SOLICITACAO;
DROP TABLE IF EXISTS SOLICITACAO_TROCA;
DROP TABLE IF EXISTS MISSAO;
DROP TABLE IF EXISTS SERVICO_ESCALADO;
DROP TABLE IF EXISTS DIA_ESCALA;
DROP TABLE IF EXISTS ESCALA;
DROP TABLE IF EXISTS REGRA_ESCALA;
DROP TABLE IF EXISTS REQUISITO_SERVICO;
DROP TABLE IF EXISTS TIPO_SERVICO;
DROP TABLE IF EXISTS USUARIO;
DROP TABLE IF EXISTS PERFIL_PERMISSAO;
DROP TABLE IF EXISTS PERMISSAO;
DROP TABLE IF EXISTS PERFIL_ACESSO;
DROP TABLE IF EXISTS MILITAR_CURSO;
DROP TABLE IF EXISTS MILITAR;
DROP TABLE IF EXISTS CURSO;
DROP TABLE IF EXISTS POSTO_GRADUACAO;

CREATE TABLE POSTO_GRADUACAO (
  id_posto           INTEGER     PRIMARY KEY AUTOINCREMENT,
  sigla              VARCHAR(10) NOT NULL UNIQUE,
  descricao          VARCHAR(60) NOT NULL,
  nivel_hierarquico  INT         NOT NULL
);

CREATE TABLE CURSO (
  id_curso   INTEGER      PRIMARY KEY AUTOINCREMENT,
  nome       VARCHAR(60)  NOT NULL UNIQUE,
  descricao  VARCHAR(120)
);

CREATE TABLE MILITAR (
  id_militar              INTEGER      PRIMARY KEY AUTOINCREMENT,
  nome_completo           VARCHAR(120) NOT NULL,
  nome_guerra             VARCHAR(40)  NOT NULL,
  cpf                     CHAR(11)     NOT NULL UNIQUE,
  id_posto                INT          NOT NULL REFERENCES POSTO_GRADUACAO(id_posto),
  email                   VARCHAR(120),
  telefone                VARCHAR(20),
  dias_sem_servico        INT          NOT NULL DEFAULT 0,
  data_fim_ultima_missao  DATE,
  situacao                VARCHAR(15)  NOT NULL DEFAULT 'ATIVO'
                          CHECK (situacao IN ('ATIVO','AFASTADO','DESLIGADO'))
);

CREATE TABLE MILITAR_CURSO (
  id_militar      INT  NOT NULL REFERENCES MILITAR(id_militar) ON DELETE CASCADE,
  id_curso        INT  NOT NULL REFERENCES CURSO(id_curso) ON DELETE CASCADE,
  data_conclusao  DATE NOT NULL,
  PRIMARY KEY (id_militar, id_curso)
);

CREATE TABLE PERFIL_ACESSO (
  id_perfil  INTEGER      PRIMARY KEY AUTOINCREMENT,
  nome       VARCHAR(40)  NOT NULL UNIQUE,
  descricao  VARCHAR(120)
);

CREATE TABLE PERMISSAO (
  id_permissao INTEGER      PRIMARY KEY AUTOINCREMENT,
  codigo       VARCHAR(50)  NOT NULL UNIQUE,
  descricao    VARCHAR(120) NOT NULL
);

CREATE TABLE PERFIL_PERMISSAO (
  id_perfil    INT NOT NULL REFERENCES PERFIL_ACESSO(id_perfil) ON DELETE CASCADE,
  id_permissao INT NOT NULL REFERENCES PERMISSAO(id_permissao) ON DELETE CASCADE,
  PRIMARY KEY (id_perfil, id_permissao)
);

CREATE TABLE USUARIO (
  id_usuario     INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_militar     INT          NOT NULL UNIQUE REFERENCES MILITAR(id_militar),
  id_perfil      INT          NOT NULL REFERENCES PERFIL_ACESSO(id_perfil),
  login          VARCHAR(20)  NOT NULL UNIQUE,
  senha_hash     VARCHAR(255) NOT NULL,
  ativo          BOOLEAN      NOT NULL DEFAULT 1,
  senha_provisoria BOOLEAN    NOT NULL DEFAULT 0,
  tentativas_invalidas INT    NOT NULL DEFAULT 0,
  bloqueado_ate  TIMESTAMP,
  ultimo_acesso  TIMESTAMP
);

-- Bloco 2 - configuração da escala.

CREATE TABLE TIPO_SERVICO (
  id_tipo_servico     INTEGER      PRIMARY KEY AUTOINCREMENT,
  nome                VARCHAR(60)  NOT NULL UNIQUE,
  descricao           VARCHAR(150),
  efetivo_necessario  INT          NOT NULL CHECK (efetivo_necessario > 0),
  hora_inicio         TIME         NOT NULL DEFAULT '08:00',
  duracao_horas       INT          NOT NULL DEFAULT 24,
  exige_pernoite      BOOLEAN      NOT NULL DEFAULT 1,
  ativo               BOOLEAN      NOT NULL DEFAULT 1
);

CREATE TABLE REQUISITO_SERVICO (
  id_requisito     INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tipo_servico  INT     NOT NULL REFERENCES TIPO_SERVICO(id_tipo_servico) ON DELETE CASCADE,
  id_posto         INT     NOT NULL REFERENCES POSTO_GRADUACAO(id_posto),
  id_curso         INT     REFERENCES CURSO(id_curso),
  obrigatorio      BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE REGRA_ESCALA (
  id_regra           INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tipo_servico    INT     NOT NULL REFERENCES TIPO_SERVICO(id_tipo_servico),
  ciclo_minimo       INT     NOT NULL,
  ciclo_maximo       INT,
  dias_servico       INT     NOT NULL DEFAULT 1,
  intervalo_minimo   INT     NOT NULL,
  max_servicos_mes   INT,
  vigencia_inicio    DATE    NOT NULL,
  vigencia_fim       DATE,
  id_usuario_criacao INT     REFERENCES USUARIO(id_usuario),
  CHECK (ciclo_maximo IS NULL OR ciclo_maximo >= ciclo_minimo)
);

-- Bloco 3 - execução da escala.

CREATE TABLE ESCALA (
  id_escala          INTEGER     PRIMARY KEY AUTOINCREMENT,
  descricao          VARCHAR(80) NOT NULL,
  data_inicio        DATE        NOT NULL,
  data_fim           DATE        NOT NULL,
  situacao           VARCHAR(15) NOT NULL DEFAULT 'RASCUNHO'
                     CHECK (situacao IN ('RASCUNHO','PUBLICADA','ENCERRADA')),
  data_geracao       TIMESTAMP   NOT NULL,
  id_usuario_geracao INT         REFERENCES USUARIO(id_usuario)
);

CREATE TABLE DIA_ESCALA (
  id_dia_escala          INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_escala              INT          NOT NULL REFERENCES ESCALA(id_escala) ON DELETE CASCADE,
  data                   DATE         NOT NULL,
  trancado               BOOLEAN      NOT NULL DEFAULT 0,
  motivo_trancamento     VARCHAR(150),
  id_usuario_trancamento INT          REFERENCES USUARIO(id_usuario),
  data_trancamento       TIMESTAMP,
  UNIQUE (id_escala, data)
);

CREATE TABLE SERVICO_ESCALADO (
  id_servico_escalado INTEGER     PRIMARY KEY AUTOINCREMENT,
  id_dia_escala       INT         NOT NULL REFERENCES DIA_ESCALA(id_dia_escala) ON DELETE CASCADE,
  id_tipo_servico     INT         NOT NULL REFERENCES TIPO_SERVICO(id_tipo_servico),
  id_militar          INT         REFERENCES MILITAR(id_militar),
  posicao             VARCHAR(40),
  situacao            VARCHAR(15) NOT NULL DEFAULT 'PREVISTO'
                      CHECK (situacao IN ('PREVISTO','CUMPRIDO','SUBSTITUIDO')),
  observacao          VARCHAR(150)
);

-- RNF08: a integridade "um militar, um serviço por data" é garantida pelo próprio banco.
-- O índice é parcial porque id_militar nulo representa vaga pendente de preenchimento.
CREATE UNIQUE INDEX ux_servico_escalado_dia_militar
  ON SERVICO_ESCALADO (id_dia_escala, id_militar)
  WHERE id_militar IS NOT NULL;

CREATE TABLE MISSAO (
  id_missao           INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_militar          INT          NOT NULL REFERENCES MILITAR(id_militar) ON DELETE CASCADE,
  tipo                VARCHAR(15)  NOT NULL CHECK (tipo IN ('MISSAO','DISPENSA','FERIAS','OUTRO')),
  descricao           VARCHAR(150) NOT NULL,
  data_inicio         DATE         NOT NULL,
  data_fim            DATE         NOT NULL,
  id_usuario_registro INT          REFERENCES USUARIO(id_usuario),
  data_registro       TIMESTAMP    NOT NULL,
  CHECK (data_fim >= data_inicio)
);

-- Bloco 4 - fluxo de trocas e apoio.

CREATE TABLE SOLICITACAO_TROCA (
  id_solicitacao        INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_servico_escalado   INT          NOT NULL REFERENCES SERVICO_ESCALADO(id_servico_escalado) ON DELETE CASCADE,
  id_militar_solicitante INT         NOT NULL REFERENCES MILITAR(id_militar),
  id_militar_substituto INT          REFERENCES MILITAR(id_militar),
  motivo                VARCHAR(200) NOT NULL,
  data_solicitacao      TIMESTAMP    NOT NULL,
  situacao              VARCHAR(30)  NOT NULL
                        CHECK (situacao IN ('EM_ANALISE_CABO','AGUARDANDO_SARGENTEANTE',
                                            'AUTORIZADA','NEGADA','CANCELADA'))
);

CREATE TABLE PARECER_SOLICITACAO (
  id_parecer           INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_solicitacao       INT          NOT NULL REFERENCES SOLICITACAO_TROCA(id_solicitacao) ON DELETE CASCADE,
  id_usuario_avaliador INT          NOT NULL REFERENCES USUARIO(id_usuario),
  etapa                VARCHAR(15)  NOT NULL CHECK (etapa IN ('TRIAGEM','AUTORIZACAO')),
  resultado            VARCHAR(15)  NOT NULL
                       CHECK (resultado IN ('FAVORAVEL','DESFAVORAVEL','AUTORIZADA','NEGADA')),
  justificativa        VARCHAR(200) NOT NULL,
  data_parecer         TIMESTAMP    NOT NULL
);

CREATE TABLE NOTIFICACAO (
  id_notificacao INTEGER      PRIMARY KEY AUTOINCREMENT,
  id_militar     INT          NOT NULL REFERENCES MILITAR(id_militar) ON DELETE CASCADE,
  tipo           VARCHAR(25)  NOT NULL
                 CHECK (tipo IN ('SERVICO_D1','STATUS_SOLICITACAO','ESCALA_PUBLICADA')),
  titulo         VARCHAR(80)  NOT NULL,
  mensagem       VARCHAR(300) NOT NULL,
  canal          VARCHAR(15)  NOT NULL CHECK (canal IN ('EMAIL','PUSH','SISTEMA')),
  data_envio     TIMESTAMP    NOT NULL,
  situacao_envio VARCHAR(15)  NOT NULL CHECK (situacao_envio IN ('ENVIADA','FALHA','LIDA'))
);

CREATE TABLE LOG_AUDITORIA (
  id_log         INTEGER     PRIMARY KEY AUTOINCREMENT,
  id_usuario     INT         REFERENCES USUARIO(id_usuario),
  entidade       VARCHAR(40) NOT NULL,
  id_registro    INT         NOT NULL,
  acao           VARCHAR(15) NOT NULL CHECK (acao IN ('INCLUSAO','ALTERACAO','EXCLUSAO','ACESSO')),
  valor_anterior TEXT,
  valor_novo     TEXT,
  data_hora      TIMESTAMP   NOT NULL
);

CREATE INDEX ix_servico_escalado_militar ON SERVICO_ESCALADO (id_militar);
CREATE INDEX ix_dia_escala_data          ON DIA_ESCALA (data);
CREATE INDEX ix_missao_militar_periodo   ON MISSAO (id_militar, data_inicio, data_fim);
CREATE INDEX ix_log_entidade             ON LOG_AUDITORIA (entidade, id_registro);
CREATE INDEX ix_notificacao_militar      ON NOTIFICACAO (id_militar, data_envio);
