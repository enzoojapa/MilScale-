# MilScale — Sistema de Gestão de Escalas de Serviço Militar

Sistema web que automatiza a elaboração, a divulgação e a manutenção da escala de serviço de um
batalhão sediado em Curitiba. A escala é gerada por rotatividade a partir do contador de dias sem
serviço de cada militar, do efetivo elegível disponível no período e das regras vigentes; missões e
impedimentos bloqueiam a escalação, as trocas passam por dupla aprovação e cada militar é notificado
no dia anterior ao seu serviço.

O sistema é o produto militar da linha de produto de software "Escalas", cujo outro produto previsto
é o SmartScale (escalas hospitalares). O núcleo é comum aos dois; o que varia entre eles está
isolado em módulos de variação plugáveis — ver [Arquitetura da linha de produto](#arquitetura-da-linha-de-produto).

---

## Requisitos

- Node.js 20 ou superior (testado no 22)
- npm 10 ou superior

Nenhum servidor de banco é necessário: a persistência usa SQLite em arquivo.

## Instalação e execução

```bash
# 1. Backend: dependências, schema e dados de exemplo
cd backend
npm install
cp .env.exemplo .env
npm run banco:preparar        # cria as 19 tabelas e popula o banco

# 2. Frontend
cd ../frontend
npm install
npm run build                 # opcional: gera a interface servida pelo backend

# 3. Subir o sistema
cd ../backend
npm run dev                   # http://localhost:3333
```

Com o frontend compilado (`npm run build`), o backend serve a interface na própria porta 3333.
Para desenvolver a interface com recarga automática, rode `npm run dev` também no `frontend/`
(porta 5173, com proxy para a API).

### Acessos de demonstração

Todos os usuários do seed usam a senha `milscale`. O login é o CPF.

| Login         | Militar          | Perfil                     |
|---------------|------------------|----------------------------|
| `10000000090` | 2º Sgt Rossato   | Sargenteante               |
| `10000000061` | Cb Petry         | Cabo da Sargenteação       |
| `10000000037` | Sd EP Bueno      | Soldado EP da Sargenteação |
| `10000000005` | Rct Kaminski     | Militar Escalado           |

A tela de login traz esses acessos como atalho.

### Scripts

| Comando                  | Onde       | O que faz                                              |
|--------------------------|------------|--------------------------------------------------------|
| `npm run dev`            | `backend`  | Sobe a API com recarga automática                       |
| `npm run banco:reset`    | `backend`  | Recria as 19 tabelas (apaga os dados)                   |
| `npm run banco:seed`     | `backend`  | Popula o banco e gera a escala do mês corrente          |
| `npm run banco:preparar` | `backend`  | Executa o reset e o seed em sequência                   |
| `npm run build`          | `backend`  | Compila o TypeScript para `dist/`                       |
| `npm run dev`            | `frontend` | Sobe a interface em modo de desenvolvimento             |
| `npm run build`          | `frontend` | Gera a interface de produção em `frontend/dist/`        |

## Dados de exemplo

O seed reproduz um batalhão com **97 militares** distribuídos pelos seis postos/graduações
(Recruta, Sd EP, Cabo, 3º Sgt, 2º Sgt e Tenente), com os cursos CFC, Motorista e Rancho vinculados,
os **12 tipos de serviço** da Tabela 1 do documento de domínio com seus requisitos de elegibilidade,
as regras vigentes de cada serviço, seis missões e impedimentos e a escala do mês corrente **gerada
pelo próprio motor de rotatividade** e publicada — cerca de 450 serviços escalados, sem pendências.

O seed também deixa três solicitações de troca no fluxo, uma delas já com o parecer de triagem do
cabo, para que a etapa de autorização do sargenteante possa ser demonstrada de imediato.

Ciclos apurados numa execução típica:

```
Guarda                     11x1  (36 elegíveis / 3 por dia)
Plantão ao Alojamento      12x1  (36 elegíveis / 2 por dia)
Oficial de Dia              4x1  ( 5 elegíveis / 1 por dia)
Cabo da Guarda             15x1  (16 elegíveis / 1 por dia)
...
```

---

## Arquitetura da linha de produto

O padrão adotado é **microkernel/plugin**: um núcleo comum aos produtos da LPS e módulos de variação
carregados por configuração.

```
backend/src/
├── config/
│   ├── ambiente.ts               variáveis de ambiente
│   └── produto.ts                catálogo de produtos da LPS (MILSCALE | SMARTSCALE)
├── nucleo/                       NÚCLEO — comum aos dois produtos
│   ├── dominio/                  entidades, objeto de valor Periodo, exceções
│   ├── seguranca/                autenticação e RBAC hierárquico
│   ├── cadastros/                militares, cursos, tipos de serviço, regras, missões
│   ├── elegibilidade/            UC15 + contrato RegraElegibilidade
│   ├── escala/                   UC05 (gerador), CalculadoraCiclo (RN20), UC06/07/08/09/17
│   ├── trocas/                   máquina de estados + contrato EstrategiaAprovacaoTroca
│   ├── notificacao/              UC14/UC20 com canal de entrega injetável
│   ├── auditoria/                RF22
│   └── relatorios/               UC18 (PDF)
├── variacoes/                    PLUGINS — o que difere entre os produtos
│   ├── registro.ts               composition root: resolve as variações do produto configurado
│   ├── milscale/
│   │   ├── regraElegibilidadeHierarquica.ts        RF06
│   │   └── aprovacaoEmCadeia/                      RF12b — FEATURE EXCLUSIVA
│   └── smartscale/
│       ├── regraElegibilidadePorEspecialidade.ts   RF06b
│       └── aprovacaoUnica/                         RF12
├── infra/                        schema.sql, repositórios (Repository Pattern), seed
└── api/                          rotas Express e middlewares
```

### Pontos de variação

| Ponto de variação | Contrato (núcleo) | MilScale | SmartScale |
|---|---|---|---|
| Elegibilidade (RF06/RF06b) | `RegraElegibilidade` | `RegraElegibilidadeHierarquica` — posto/graduação privativo + cursos | `RegraElegibilidadePorEspecialidade` — especialidade habilitante |
| Aprovação de troca (RF12/RF12b) | `EstrategiaAprovacaoTroca` | `EstrategiaAprovacaoEmCadeia` — triagem do cabo → autorização do sargenteante | `EstrategiaAprovacaoUnica` — coordenador decide direto |
| Canal de notificação | `CanalEntrega` | caixa do sistema + e-mail simulado | idem, canal parametrizável |
| Rótulos de tela | `ConfiguracaoProduto.rotulos` | militar / serviço / batalhão | profissional / plantão / unidade |

### A feature exclusiva do MilScale

A **aprovação de troca em duas etapas encadeadas** (RN08, UC11 + UC12) é a função exclusiva do
produto militar. Ela está isolada em três lugares, e em nenhum outro:

1. `backend/src/variacoes/milscale/aprovacaoEmCadeia/estrategiaAprovacaoEmCadeia.ts` — as duas
   etapas, os perfis responsáveis por cada uma e as transições de situação.
2. `frontend/src/paginas/variacaoMilscale/AvaliacaoDeTroca.tsx` — as telas de triagem e de
   autorização, montadas a partir das etapas que a estratégia declara.
3. `backend/src/config/produto.ts` — a linha de configuração que diz qual estratégia o produto usa.

O `SolicitacaoTrocaService`, no núcleo, **não sabe quantas etapas existem**: ele pergunta à
estratégia qual é a etapa corrente, se o perfil do usuário responde por ela e para qual situação a
solicitação caminha depois da decisão. Trocar `PRODUTO=SMARTSCALE` no `.env` faz o mesmo núcleo
operar com aprovação em etapa única — a rota `/triagem` deixa de ser registrada na interface, e
nenhuma linha de código de negócio muda.

Para ver isso na prática:

```bash
cd backend
PRODUTO=SMARTSCALE npm run dev
curl -s localhost:3333/api/saude
# {"produto":"SMARTSCALE","regraElegibilidade":"ESPECIALIDADE_PREFERENCIA",
#  "estrategiaAprovacao":"ETAPA_UNICA", ...}
```

---

## Modelo de dados

As **19 tabelas** do modelo lógico estão em `backend/src/infra/schema.sql`, com os nomes de tabela,
de coluna, tipos e restrições do dicionário de dados, organizadas nos quatro blocos previstos:

- **Identificação e acesso:** `POSTO_GRADUACAO`, `MILITAR`, `CURSO`, `MILITAR_CURSO`, `USUARIO`,
  `PERFIL_ACESSO`, `PERMISSAO`, `PERFIL_PERMISSAO`
- **Configuração da escala:** `TIPO_SERVICO`, `REQUISITO_SERVICO`, `REGRA_ESCALA`
- **Execução da escala:** `ESCALA`, `DIA_ESCALA`, `SERVICO_ESCALADO`, `MISSAO`
- **Trocas e apoio:** `SOLICITACAO_TROCA`, `PARECER_SOLICITACAO`, `NOTIFICACAO`, `LOG_AUDITORIA`

A restrição de integridade da RNF08 é um índice único sobre `(id_dia_escala, id_militar)` em
`SERVICO_ESCALADO`, parcial porque `id_militar` nulo representa vaga pendente de preenchimento.
A violação é traduzida em mensagem de negócio pelo middleware de erros.

## Casos de uso implementados

| UC | Caso de uso | Onde |
|---|---|---|
| UC01 | Autenticar no sistema | tela de login, `autenticacaoService` |
| UC02 | Manter perfil de militar | Cadastros → Militares |
| UC03 | Manter tipos de serviço | Cadastros → Tipos de serviço |
| UC04 | Manter regras da escala | Cadastros → Regras da escala |
| UC05 | Gerar escala do período | Escala → Gerar escala |
| UC06 | Alterar escala manualmente | Escala do dia → botão "Alterar" |
| UC07 | Trancar / destrancar dia | Escala → Trancar dias |
| UC08 | Consultar escala própria | Minha rotina → Minha escala |
| UC09 | Consultar escala completa | Escala → Escala do dia |
| UC10 | Solicitar troca de serviço | Minha escala → "Solicitar troca" |
| UC11 | Analisar viabilidade da solicitação | Trocas → Triagem do cabo *(variação)* |
| UC12 | Autorizar solicitação de troca | Trocas → Autorização final *(variação)* |
| UC13 | Acompanhar solicitações | Trocas → Todas as solicitações |
| UC14 | Notificar serviço no dia anterior | `NotificacaoService`, tela Notificações |
| UC15 | Validar elegibilidade do militar | `ValidadorElegibilidade`, tela Validar elegibilidade |
| UC16 | Manter missões e impedimentos | Cadastros → Missões e impedimentos |
| UC17 | Consultar histórico de serviços | Escala → Histórico de serviços |
| UC18 | Exportar escala em PDF | Escala do dia → "Exportar PDF" |
| UC19 | Acompanhar solicitação própria | Minha rotina → Minhas solicitações |
| UC20 | Verificar militares que estarão de serviço | agendador + disparo manual em Notificações |

## Regras de negócio no código

| Regra | Onde é aplicada |
|---|---|
| RN01 — ordenação da rotatividade | `compararPelaRegraDeRotatividade` (`validadorElegibilidade.ts`) |
| RN02, RN03 — posto privativo e curso exigido | `RegraElegibilidadeHierarquica` |
| RN04 — dia trancado não aceita troca | `escalaService`, `solicitacaoTrocaService` |
| RN05 — um serviço por militar por data | índice único + `ValidadorElegibilidade` |
| RN06 — intervalo mínimo entre serviços | `ValidadorElegibilidade.avaliar` |
| RN07, RN13 — elegibilidade do substituto | `solicitacaoTrocaService.exigirSubstitutoElegivel` |
| RN08 — dupla avaliação | `EstrategiaAprovacaoEmCadeia` |
| RN09 — autorização altera a escala e recalcula contadores | `solicitacaoTrocaService.avaliar` |
| RN10 — notificação D-1 em horário parametrizado | `agendador.ts`, `NotificacaoService` |
| RN11, RN18 — funções privativas do sargenteante | `permissoes.ts` + `exigirPermissao` |
| RN12 — antecedência mínima de 24 h | `escalaService.podeSolicitarTroca` |
| RN14 — só escala publicada é visível ao militar | `escalaRepositorio.servicosPorPeriodo` |
| RN15 — impedimento bloqueia a escalação | `ValidadorElegibilidade.avaliar` |
| RN16 — retorno de missão sem prioridade | `ValidadorElegibilidade` + ordenação |
| RN17 — turno de 24 h a partir das 08h00 | `TIPO_SERVICO.hora_inicio` / `duracao_horas` |
| RN19 — visibilidade das solicitações por perfil | `solicitacaoRotas`, `solicitacaoTrocaService.detalhar` |
| RN20 — ciclo calculado pelo efetivo disponível | `calculadoraCiclo.ts` |

## Perfis e permissões

Os quatro perfis seguem a generalização hierárquica do documento: cada um acumula as permissões do
anterior (`permissoes.ts`). O RBAC é verificado no servidor em toda rota (RNF02); a interface apenas
oculta o que o perfil não pode acessar.

| Perfil | Acrescenta |
|---|---|
| Militar Escalado | consultar a própria escala, solicitar troca, acompanhar as próprias solicitações |
| Soldado EP da Sargenteação | consultar a escala completa, todas as solicitações, histórico, exportar |
| Cabo da Sargenteação | gerar e publicar a escala, triagem de viabilidade |
| Sargenteante | cadastros, alteração manual, trancamento, autorização de trocas, auditoria |

## Limitações desta entrega

- **Notificações não saem por SMTP nem push reais.** O ator externo "Serviço de Notificação" é
  simulado: cada envio é gravado em `NOTIFICACAO` com a situação de entrega e fica visível na tela
  de Notificações. A falha por contato ausente (UC14-E2) é reproduzida.
- **Sem anexo em solicitação de troca** (UC10-A2): o campo de documento comprobatório não foi
  implementado por não haver armazenamento de arquivos nesta entrega.
- **Exportação apenas em PDF.** A alternativa em XLSX (UC18-A1) ficou de fora.
- **Recuperação de senha devolve a senha provisória na própria resposta**, já que não há envio de
  e-mail; em produção ela iria ao contato cadastrado.
- **Sem suíte de testes automatizados.** A verificação foi feita por conferência dos dados gerados
  (rotatividade, RN15/RN16, RNF08) e por navegação nas telas.
- **Banco SQLite.** O schema usa apenas SQL padrão e tipos do dicionário de dados; a migração para
  PostgreSQL exige revisar o índice parcial da RNF08 e os `AUTOINCREMENT`.
