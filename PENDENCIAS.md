# O que ficou de fora e o que fazer a partir daqui

Documento para a equipe. O sistema está funcional e rodável; a lista abaixo separa o que
**não foi implementado** do que **precisa ser feito** antes da entrega.

---

## 1. Verificado e funcionando

Foi conferido com o sistema rodando, não só por leitura de código:

- **19 tabelas** criadas com os nomes, tipos e restrições do dicionário de dados.
- **Motor de escala (UC05):** gera 450 serviços em 30 dias, **sem nenhuma pendência**, com o ciclo
  apurado por tipo de serviço (Guarda 11x1, Oficial de Dia 4x1, Cabo da Guarda 15x1 etc.).
- **RN01 (rotatividade):** os 5 tenentes ficaram com 6 serviços cada, em dias alternados de 5 em 5 —
  rotação perfeita, sem concentração.
- **RN15:** nenhum militar foi escalado durante um impedimento registrado (consulta cruzada
  `SERVICO_ESCALADO × MISSAO` retorna vazio).
- **RN16:** o 2º Sgt Poletto, com missão até 02/09, retornou no dia 03 mas só assumiu serviço no dia
  04 — exatamente o exemplo do documento ("deslocado para o dia 10 mas pode tirar o serviço só no 11").
- **RNF08:** o banco recusa `INSERT` duplicado de militar/dia; duas vagas pendentes (militar nulo) no
  mesmo dia continuam sendo aceitas, porque o índice é parcial.
- **Cadeia de aprovação (UC10→UC11→UC12):** testada ponta a ponta. Os dois pareceres são gravados com
  `etapa = TRIAGEM` e `etapa = AUTORIZACAO`, a escala muda sozinha na autorização (Cb Lazzarotto →
  Cb Trindade) e uma segunda tentativa de parecer é recusada pela máquina de estados.
- **RBAC:** o cabo recebe *"Esta etapa é privativa do perfil SARGENTEANTE"* ao tentar autorizar, e
  *"Função privativa: ESCALA_GERAR"* quando um militar comum tenta gerar escala.
- **UC07 / RN04:** dia trancado recusa alteração manual; trancamento retroativo é recusado.
- **RN02 / RN03:** tentar escalar um tenente na Guarda devolve *"Serviço privativo de Rct; o militar é Ten"*.
- **UC18:** o PDF é gerado (HTTP 200, 4,4 KB para uma semana).
- **Ponto de variação:** o mesmo núcleo montado com os dois catálogos produz 2 etapas (MilScale) e
  1 etapa (SmartScale), com a situação inicial mudando de `EM_ANALISE_CABO` para
  `AGUARDANDO_SARGENTEANTE`. Roda com `PRODUTO=SMARTSCALE npm run dev`.

---

## 2. Não implementado — precisa ser justificado na entrega

| # | O que | Por quê | Onde encostaria |
|---|---|---|---|
| 1 | **Envio real de notificação** (SMTP/push) | O ator externo "Serviço de Notificação" foi simulado: o envio é gravado em `NOTIFICACAO` com a situação de entrega e aparece na tela de Notificações. A falha por contato ausente (UC14-E2) é reproduzida. | `nucleo/notificacao/canal.ts` — basta uma classe `CanalEmail` implementando `CanalEntrega` |
| 2 | **Anexo na solicitação de troca** (UC10-A2) | Não há armazenamento de arquivos nesta entrega | `SOLICITACAO_TROCA` + upload no `solicitacaoRotas` |
| 3 | **Exportação em XLSX** (UC18-A1) | Só o PDF foi feito | `nucleo/relatorios/` |
| 4 | **Recuperação de senha por e-mail** (UC01-A2) | A senha provisória é devolvida na própria resposta HTTP, para permitir a demonstração | `autenticacaoService.gerarSenhaProvisoria` |
| 5 | **Testes automatizados** | Nenhuma suíte foi escrita — a verificação da seção 1 foi manual | ver seção 3 |
| 6 | **Permuta pela interface** (UC06-A1) | A regra e a rota `POST /api/escalas/servicos/permutar` existem e funcionam, mas não há botão na tela | `frontend/src/paginas/EscalaCompleta.tsx` |
| 7 | **CRUD de cursos/tipos/regras no protótipo HTML** | São somente leitura lá; no sistema executável estão completos | `prototipo/milscale-prototipo.html` |
| 8 | **Encerramento de escala pela interface** | A rota existe (`POST /api/escalas/:id/encerrar`), falta o botão | `frontend/src/paginas/GerarEscala.tsx` |

---

## 3. O que fazer a partir daqui, em ordem de prioridade

### 3.1 Testes automatizados — é o buraco mais visível
Sem suíte, a nota de qualidade sofre e não há rede de segurança para mexer no motor. Sugestão de
mínimo viável, com `vitest` (uma dependência, roda em segundos):

1. `calculadoraCiclo` — casos de borda da RN20: efetivo exato, efetivo insuficiente (dispara
   `abaixoDoMinimo`), ciclo acima do máximo.
2. `ValidadorElegibilidade` — um teste por regra: RN02, RN03, RN05, RN06, RN15, RN16 e limite mensal.
3. `EstrategiaAprovacaoEmCadeia` × `EstrategiaAprovacaoUnica` — o mesmo roteiro de decisões nas duas,
   provando que o número de pareceres muda de 2 para 1 (o script que usei está descrito na seção 1).
4. `GeradorEscalaService` — geração de 30 dias com o seed, asseverando zero pendências e nenhuma
   duplicidade militar/dia.

### 3.2 Conferir a generalização do Ativo 1
O `LPS_Escalas_Itens_Pendentes.md` pede renomear o modelo de domínio para termos neutros
(`Profissional`, `TipoTurno`, `AlocacaoTurno`…). **Isso não foi feito**, de propósito: o enunciado do
prompt mandava usar os nomes do documento do MilScale (`militar`, `tipoServico`, `diaEscala`). Decidam
em equipe qual das duas disciplinas manda no nome das tabelas — se for a de Reúso, é um rename amplo
em `schema.sql` e nos repositórios, e vale medir o esforço antes.

### 3.3 Migrar para PostgreSQL, se a disciplina exigir relacional de servidor
O `schema.sql` usa SQL padrão e os tipos do dicionário. Dois pontos precisam de ajuste:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL` / `GENERATED ALWAYS AS IDENTITY`;
- o índice parcial da RNF08 (`WHERE id_militar IS NOT NULL`) funciona igual no PostgreSQL, mas
  confira a sintaxe ao portar.
O restante do código passa por `infra/repositorios/`, então a troca fica contida nessa pasta.

### 3.4 Itens 1, 2, 3 e 6 da tabela acima
São os de menor esforço e maior ganho de cobertura de casos de uso, nessa ordem: permuta na tela (6),
canal de e-mail (1), XLSX (3), anexo (2).

---

## 4. Como demonstrar na apresentação

Roteiro sugerido, ~6 minutos, com o seed recém-aplicado:

1. **Login como Cb Petry** (`10000000061` / `milscale`) → mostrar que o menu **não tem** Cadastros:
   é a generalização hierárquica dos atores funcionando (RNF02).
2. **Gerar escala** de outubro → mostrar o relatório com o **ciclo apurado por tipo de serviço** e
   dizer que nenhum desses números está cadastrado: saem da RN20.
3. **Validar elegibilidade** → escolher "Rancheiro de Dia" e mostrar a coluna de inaptos com o motivo
   escrito por extenso ("Serviço privativo de Rct", "Curso exigido não concluído: Rancho",
   "MISSAO de 05/09 a 25/09"). É o UC15 isolado, incluído por três casos de uso.
4. **Trocar para o Sargenteante** (`10000000090`) → **Autorização final**, autorizar a troca pendente
   e voltar à Escala do dia para mostrar que o militar mudou sozinho (RN09).
5. **Trilha de auditoria** → mostrar o registro dessa autorização com valor anterior e novo (RF22).
6. **Fechar com o ponto de variação:** no protótipo, clicar em "Produto: MILSCALE" e mostrar a tela
   de triagem sumindo do menu; no código, abrir `variacoes/registro.ts` e dizer que é o único arquivo
   que conhece os dois catálogos.

O passo 6 é o que a disciplina de Reúso quer ver. Vale ensaiar.

---

## 5. Mapa rápido do repositório

```
backend/src/nucleo/       o que é comum aos dois produtos da LPS
backend/src/variacoes/    o que difere — milscale/ e smartscale/
backend/src/variacoes/registro.ts      único arquivo que conhece os dois catálogos
backend/src/infra/schema.sql           as 19 tabelas do modelo lógico
backend/src/infra/seed.ts              povoa o banco e gera a escala pelo próprio motor
frontend/src/paginas/variacaoMilscale/ as telas da feature exclusiva
prototipo/                             o HTML de arquivo único para demonstração
```

Setup completo e tabela de rastreabilidade UC → tela estão no `README.md`.
