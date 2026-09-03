# Protótipo navegável

`milscale-prototipo.html` é o MilScale empacotado em um único arquivo HTML, para abrir direto no
navegador (duplo clique) sem instalar Node, npm ou banco. Serve para demonstrar o sistema quando não
há como subir o backend — em sala, no celular ou numa máquina sem ambiente montado.

Publicado também em: <https://claude.ai/code/artifact/c401f778-f05e-45ed-97f6-b4afd16a1ba8>

## O que ele é

Uma réplica em navegador do sistema que está em `backend/` + `frontend/`, com a **mesma separação
núcleo × variações**. As regras de negócio foram portadas para JavaScript e rodam de verdade:

- validador de elegibilidade (UC15) com RN02, RN03, RN05, RN06, RN15 e RN16;
- motor de geração por rotatividade (UC05) com o cálculo do ciclo da RN20 — dá para gerar uma escala
  nova de outro mês e ver o relatório de ciclos e pendências;
- máquina de estados da solicitação de troca e as duas estratégias de aprovação;
- RBAC hierárquico pelos quatro perfis.

`dados-seed.json` é o dump do banco povoado por `npm run banco:seed`: 97 militares, 12 tipos de
serviço, 12 regras, 6 impedimentos e a escala do mês com 450 serviços. É esse arquivo que está
embutido no HTML.

## O botão "Produto: MILSCALE"

No canto superior direito. Ele troca o produto configurado da linha de produto em tempo real:

| | MilScale | SmartScale |
|---|---|---|
| Elegibilidade | `HIERARQUIA_MILITAR` | `ESPECIALIDADE_PREFERENCIA` |
| Aprovação de troca | `CADEIA_DUAS_ETAPAS` | `ETAPA_UNICA` |
| Telas de avaliação | Triagem do cabo + Autorização | só Decisão do coordenador |

Ao trocar, a tela "Triagem do cabo" **desaparece do menu** e o fluxo passa a ter uma etapa só, sem
que nenhuma linha do núcleo mude — é a demonstração visual do ponto de variação. É o mesmo efeito de
rodar o backend com `PRODUTO=SMARTSCALE`.

## Limites

- Tudo roda em memória: o que você alterar vale só naquela aba e some ao recarregar (F5 reinicia).
- A senha não é verificada por hash, só comparada com `milscale` — o bcrypt está no backend real.
- Não há exportação em PDF (o botão "Exportar / imprimir" usa a impressão do navegador); a geração
  do PDF com cabeçalho da OM e campo de assinatura está no backend, em `nucleo/relatorios/`.
- Os cadastros de cursos, tipos de serviço e regras são somente leitura aqui; a inclusão e a
  alteração completas estão no sistema executável.
