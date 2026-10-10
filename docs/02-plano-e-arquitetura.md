# Plano de Desenvolvimento e Arquitetura — Porto Inc.

> Documento de trabalho do Tech Lead. Define as decisões tomadas, a arquitetura
> e a divisão do projeto em etapas.
> Data: 2026-09-21 · Versão 1.0

---

## 1. Decisões tomadas (as 8 perguntas em aberto)

A empresa ainda não respondeu. Seguindo orientação do cliente interno, as decisões
abaixo foram tomadas pelo Tech Lead com o critério de **"o que é reversível sem
retrabalho"**. Todas podem ser alteradas depois, e o custo de cada mudança está
declarado.

### D1 — Limite de alçada

**Decisão:** faixas de valor configuráveis em tela, não fixas no código.

| Faixa | Quem aprova | Assinaturas |
|---|---|---|
| Até R$ 2.000,00 | Gestor de obra | 1 |
| R$ 2.000,01 a R$ 15.000,00 | Gestor de obra + Engenheiro | 2 |
| Acima de R$ 15.000,00 | Fundador (obrigatório) | 1 |

**Por quê:** valor de alçada é decisão de negócio, não de software. Virando dado em
tabela, a Porto Inc. ajusta sozinha pela tela do Administrador.
**Custo de mudar depois:** zero. É preencher um formulário.

### D2 — Quantidade de aprovadores

**Decisão:** o sistema suporta 1 ou várias assinaturas. Cada faixa define quais
funções precisam aprovar e se exige **todas** ou **qualquer uma**.

Toda decisão registra quem aprovou, quando e a justificativa (trilha de auditoria).

**Por quê:** o BPMN diz que a aprovação acontece "em reunião", o que é coletivo.
Software não registra reunião — registra pessoas. Suportar os dois modelos desde o
início evita refazer a tabela de aprovações.
**Custo de mudar depois:** zero. É configuração.

### D3 — Estoque centralizado ou por obra

**Decisão:** **por obra**, com um "Almoxarifado Central" como mais um local.

**Por quê:** este é o único item da lista que é **caro de mudar depois**. Começar
centralizado e virar multi-almoxarifado obriga a reescrever toda consulta de saldo,
entrada e saída. Começar multi custa uma coluna a mais. Além disso, habilita
transferência entre obras — material parado numa obra vai para a outra em vez de
ser comprado de novo.
**Custo de mudar depois:** alto se começarmos errado. Por isso já começamos certo.

### D4 — Origem do orçamento da obra

**Decisão:** cadastro manual **e** importação de planilha (CSV/XLSX), com linhas
hierárquicas: código, descrição, unidade, quantidade prevista e valor previsto.

A leitura da planilha é feita **linha a linha (streaming)**, nunca carregando o
arquivo inteiro na memória — restrição do container de 1 GB.

**Por quê:** a empresa já mantém orçamento em planilha. Obrigar a redigitar tudo
seria o jeito mais rápido de o sistema não ser adotado.

> **CSV entra, CSV não sai — e não é contradição.** A regra "nada sai em CSV" (ver D5) é
> sobre o que o sistema **entrega** para alguém ler: isso é PDF ou Word. Planilha é o
> formato de quem está **mudando de casa**, e recusá-la na entrada seria recusar a
> mudança.
>
> Em 09/10/2026 a mesma porta foi aberta para **materiais** e **fornecedores**: eram 10 e
> 9 campos por cadastro, e uma construtora com 400 itens e 80 fornecedores digitava quase
> 5.000 campos para sair da planilha.
**Custo de mudar depois:** baixo.

### D5 — Contas a pagar

**Decisão:** lista de **títulos a pagar** dentro do sistema (gerados a partir da NF
vinculada ao pedido), com situação *a vencer / pago / vencido*, **mais exportação
em CSV/Excel** para o controle do Andre.

Não será um módulo financeiro completo (sem conciliação bancária, sem fluxo de caixa,
sem centro de custo contábil).

**Por quê:** o BPMN termina exatamente aí. Construir um ERP financeiro completo
multiplicaria o prazo sem que ninguém tenha pedido. A exportação resolve a ponte com
o que o financeiro já usa.
**Custo de mudar depois:** médio, mas é um módulo novo, não uma mudança do existente.

> **Esta decisão mudou duas vezes, e nos dois casos por pedido da empresa.**
>
> **O formato.** "CSV/Excel" não vale mais: o dono decidiu que **nada sai em CSV**. Todo
> arquivo que o sistema entrega é PDF ou Word, e quem baixa escolhe na hora.
>
> **O escopo.** "Sem fluxo de caixa" também não vale. Na reunião de 08/10/2026 o Iache
> perguntou onde se cadastra a receita da empresa e as despesas que não vêm de compra, e
> o Emerson resumiu: *"ele vai descontar de uma conta que não tem cadastro de dinheiro de
> entrada"*. O Financeiro ganhou entradas e saídas avulsas, caixa, fluxo semanal e
> categorias — e, em 09/10, o **saldo de abertura**, para a empresa que chega com dinheiro
> no dia em que sai da planilha.
>
> Continua **não** sendo um ERP financeiro: sem conciliação bancária e sem centro de custo
> contábil.

### D6 — O que é "NBR"

**Decisão:** a anotação da reunião mistura dois conceitos. O material terá **três
campos separados**, e nenhum deles depende do outro:

| Campo | O que é | Exemplo |
|---|---|---|
| `codigoInterno` | O "COD PORTO" que já aparece nas planilhas | `00119` |
| `gtin` | Código de barras do produto | `7899888400575` |
| `normaTecnica` | Norma ABNT que o material deve cumprir | `NBR 7211` |

Mais `unidadeMedida` obrigatória, como a reunião pediu.

**Por quê:** ter os três custa três colunas. Adivinhar errado custa refazer o cadastro
inteiro de materiais.
**Custo de mudar depois:** zero, os três já existem.

### D7 — Dimensionamento

**Decisão:** projetar para **30 usuários simultâneos, 10 obras ativas, 5.000 itens de
catálogo e 50.000 movimentações por ano**.

**Por quê:** é o porte compatível com a equipe descrita na reunião, e cabe com folga
em 1 GB / 1 núcleo. Se a empresa crescer além disso, o sinal aparece no painel de
memória antes de virar problema.
**Custo de mudar depois:** aumentar a RAM do container. Uma linha.

### D8 — Certificado digital A1

**Decisão:** não bloqueia nada. O adaptador do SEFAZ já existe. Será criada uma tela
onde o Administrador envia o arquivo `.pfx` e informa a senha, guardados
criptografados fora do banco.

**Por quê:** o chefe vai providenciar. Quando vier, é upload e trocar uma linha no
`.env`.
**Custo de mudar depois:** zero.

---

## 2. Arquitetura

### 2.1 Visão geral

```
     NAVEGADOR / CELULAR
              |
              v
  +------------------------+
  |  web  (Nginx + React)  |   1 GB / 1 núcleo
  |  Interface do usuário  |
  +-----------+------------+
              | HTTP /api
              v
  +------------------------+
  |  api  (Node + Fastify) |   1 GB / 1 núcleo
  |                        |
  |  rotas                 |  recebe e valida
  |    v                   |
  |  serviços              |  REGRAS DE NEGÓCIO
  |    v                   |
  |  repositórios (Prisma) |  fala com o banco
  |                        |
  |  integrações (portas)  |  WhatsApp, NF-e, GTIN, pagamento
  |  tarefas (pg-boss)     |  avisos e alertas em segundo plano
  +-----------+------------+
              |
              v
  +------------------------+      +---------------------+
  |  db  (PostgreSQL 17)   |      |  volume /arquivos   |
  |  Dados do sistema      |      |  PDFs, XMLs, fotos  |
  +------------------------+      +---------------------+
```

### 2.2 Por que em camadas

Cada camada só conhece a de baixo:

| Camada | Responsabilidade | Exemplo |
|---|---|---|
| **Rotas** | Receber o pedido HTTP e validar o formato | "o campo quantidade veio e é número?" |
| **Serviços** | Aplicar a regra de negócio | "esta solicitação precisa da aprovação do fundador?" |
| **Repositórios** | Ler e gravar no banco | "salvar esta solicitação" |
| **Integrações** | Falar com o mundo de fora | "avisar o fornecedor" |

**Benefício prático:** a regra de negócio fica num lugar só. Se a alçada mudar, muda
em um arquivo — não espalhado por dez telas.

### 2.3 Tarefas em segundo plano

Avisos, alertas de prazo e checagens periódicas não podem travar a tela do usuário.
Usaremos **pg-boss**, que transforma o próprio PostgreSQL em fila de tarefas.

**Por quê pg-boss e não Redis:** Redis exigiria um quarto container, consumindo mais
memória. O pg-boss usa o banco que já existe.

### 2.4 Segurança

| Item | Decisão |
|---|---|
| Senha | Argon2id (padrão atual recomendado) |
| Sessão | JWT de acesso curto + token de renovação |
| Permissão | Por função, verificada no servidor (nunca só escondendo botão na tela) |
| Visibilidade | Solicitante vê apenas o que ele abriu; demais funções veem conforme regra |
| Portal do fornecedor | Link com token assinado e prazo de validade, sem login |
| Arquivos sensíveis | Certificado e sessão do WhatsApp criptografados, fora do Git |
| Auditoria | Toda aprovação, alteração de preço e movimento de estoque é registrado |

---

## 3. Modelo de dados (entidades principais)

```
ACESSO
  Usuario ---< UsuarioFuncao >--- Funcao ---< FuncaoPermissao

ESTRUTURA
  Obra ---< LinhaOrcamento
  Obra ---< Almoxarifado
  FamiliaMaterial ---< Material
  Fornecedor ---< FornecedorFamilia
  Fornecedor ---< ContatoFornecedor

COMPRA
  Solicitacao ---< SolicitacaoItem  (vincula Material, Obra e LinhaOrcamento)
  RegraAlcada ---> Aprovacao ---> Solicitacao
  Bid ---< BidItem            (agrupa itens aprovados)
  Bid ---< BidFornecedor      (quem foi convidado, com token e prazo)
  Cotacao ---< CotacaoItem    (resposta do fornecedor)
  Pedido ---< PedidoItem      (fornecedor vencedor por item)

RECEBIMENTO
  Recebimento ---< RecebimentoItem   (permite ENTREGA PARCIAL)
  Ocorrencia                         (ressalva, devolução, estorno)
  NotaFiscal ---> Pedido
  TituloPagar ---> NotaFiscal

ESTOQUE
  MovimentoEstoque   (entrada e saída, sempre com origem rastreável)
  SaldoEstoque       (saldo por material e por almoxarifado)

APOIO
  Notificacao
  LogAuditoria
  HistoricoPreco
```

**Dois pontos que corrigem falhas do BPMN original:**

1. `RecebimentoItem` separado de `PedidoItem` permite **entrega parcial**. O BPMN
   tratava como "chegou ou não chegou"; a realidade é que chega 80 de 100.
2. `Ocorrencia` é um **estado**, não um fim de processo. O BPMN mandava a devolução
   para "Fim", mas o texto do próprio documento diz que o material volta ao
   recebimento depois de resolvido.

---

## 4. As 12 etapas do projeto

> **Este quadro ficou parado de 23/09 a 09/10/2026.** Ele foi escrito no começo, para
> marcar o que ia ser feito, e ninguém voltou para marcar o que foi sendo entregue —
> então quem o abrisse lia "só a fundação está pronta", com as doze etapas no ar.
>
> Conferido linha a linha contra o código em 09/10/2026. Duas descrições foram
> corrigidas, porque descreviam algo diferente do que foi entregue; estão marcadas.

| # | Etapa | Entrega | Situação |
|---|---|---|---|
| 0 | **Fundação** | Docker, 3 peças no ar, tomadas de integração, manual | ✅ |
| 1 | **Acesso** | Login, funções múltiplas, permissões, menu do sistema | ✅ |
| 2 | **Cadastros** | Obras, orçamento, famílias, materiais, fornecedores, almoxarifados, alçadas | ✅ |
| 3 | **Solicitação** | Abertura de pedido pelo computador e pelo celular, PDF | ✅ |
| 4 | **Aprovação** | Fila por alçada, aprovar/reprovar/devolver, auditoria | ✅ |
| 5 | **Cotação (BID)** | Montagem do pacote, convite a fornecedores, portal externo | ✅ |
| 6 | **Equalização** | Mapa comparativo, última chamada, escolha por item, pedido + PDF | ✅ |
| 7 | **Recebimento** | Código de barras, conferência, entrega parcial, devolução | ✅ |
| 8 | **Estoque** | Entradas, saídas, saldo por obra, **reposição sugerida** no ponto de pedido | ✅ ¹ |
| 9 | **Fiscal e pagar** | NF vinculada ao pedido, contas a pagar, **saída em PDF e Word** | ✅ ² |
| 10 | **WhatsApp** | Tela de conexão com QR code, avisos automáticos do fluxo | ✅ ³ |
| 11 | **Relatórios** | Histórico de preços, custo por obra e linha, desempenho de fornecedor | ✅ |
| 12 | **Locação** | Contrato de locação, controle de diárias, alerta de equipamento ocioso | ✅ |

**¹ A linha dizia "ponto de pedido automático".** O BPMN pede que o sistema *"abra
automaticamente uma nova solicitação"* quando o saldo cai abaixo do mínimo. O que foi
construído **sugere**: monta a lista de reposição já no formato da solicitação, com a
quantidade calculada, e uma pessoa confirma.

A escolha é deliberada — quantidade sugerida é estimativa, e uma compra nascendo sozinha
de madrugada é uma compra que ninguém revisou —, mas nunca tinha sido escrita como
decisão. Fica escrita agora.

**² A linha dizia "exportação".** A decisão D5, acima, previa CSV/Excel para o controle do
Andre. O dono do sistema decidiu depois que **nada sai em CSV**: todo arquivo que o
sistema entrega é PDF ou Word, e quem baixa escolhe o formato na hora. A decisão dele
vale; esta linha é que estava velha.

**³ A tela existe e o adaptador roda em `mock`.** Ligar de verdade depende de ler o QR
code com o telefone da empresa, e isso é tarefa do dono — não de código que falte aqui.

> São **12 etapas além da fundação** — 13 no total, **todas entregues**.
> As etapas **1 a 9** formam o sistema mínimo utilizável: já substituem as planilhas.
> As etapas **10 a 12** agregam automação, inteligência e o controle de locação.
>
> **O que ainda não foi feito não é etapa:** a imagem de produção nunca foi construída, e
> as quatro integrações continuam em `mock` por decisão da direção. Ver *Finalização*,
> abaixo.

### Conferência contra os documentos de origem (2026-09-23)

Revisão do sistema contra o BPMN e a ata de reunião. Três coisas estavam nos documentos e
não existiam no sistema; duas foram construídas, uma foi decidida.

| O que | Onde estava | Situação |
|---|---|---|
| Pedido enviado por **e-mail** | Trilha A, passo 7: "envia o pedido por e-mail/WhatsApp" | **Feito** na versão 0.17.0. Adaptador em `mock`, mesma trava do WhatsApp |
| **NF arquivada em PDF** | Trilha B, passo 10 | **Feito** na versão 0.17.0: espelho gerado + arquivo do fornecedor guardado |
| **Requisição entrando pelo WhatsApp** | Divergência D4 | **Não entra.** O BPMN dizia formulário; a ata dizia WhatsApp. O canal oficial é a tela, que funciona no celular. Confirmado pelo dono do sistema: no fluxo antigo eles usavam Google Forms, e a tela ocupa esse lugar |

Sobre o **espelho da nota**: NÃO é um DANFE, e diz isso no próprio rodapé. O DANFE tem
layout definido em lei e só vale com o protocolo de autorização da SEFAZ, que depende do
certificado digital A1 — a dúvida nº 8, ainda sem resposta da empresa.

### Finalização (sem data)

O que era a "Etapa 13 — Entrega" **deixou de ser etapa**, por decisão da direção em
2026-09-23: ligar as integrações de verdade e instalar num servidor não espera código
que falte aqui, espera uma decisão — e não há data. Contar isso como etapa fazia o
sistema anunciar um cronograma que não existe.

Fica como lista parada, na ordem em que será feita **quando a direção mandar**:

- WhatsApp, nota fiscal, código de barras e banco ligados de verdade (hoje, os quatro
  adaptadores rodam em `mock`)
- Sistema instalado no servidor definitivo — a decisão de **nuvem ou servidor na
  construtora** entra aqui
- Treinamento da equipe

### Etapa 12 — Locação de equipamentos (escopo a levantar)

Este módulo **não existe no BPMN**. Veio de uma única frase da ata de reunião:
*"colocar para alertar os itens que eles locaram no dia em que eles acham que já
deve ser usado"*.

O cliente confirmou que entra no escopo. Perguntas a levantar antes de construir:

| Pergunta | Por que importa |
|---|---|
| A locação passa pelo mesmo fluxo de cotação e aprovação? | Define se reaproveita as etapas 3 a 6 ou se é fluxo próprio |
| O valor é por diária, semana ou mês? | Define como calcular o custo acumulado |
| Existe contrato de locação com data prevista de devolução? | É a base do alerta de equipamento ocioso |
| Equipamento locado entra no estoque? | Não é consumível: provavelmente é um controle à parte |
| Quem registra a devolução: almoxarife ou gestor de obra? | Define a permissão |

**Valor de negócio:** é onde construtora mais perde dinheiro sem perceber.
Equipamento parado no canteiro continua contando diária. O alerta de ociosidade
costuma se pagar no primeiro mês.

### Dependências entre etapas

```
  0 ──> 1 ──> 2 ──┬──> 3 ──> 4 ──> 5 ──> 6 ──> 7 ──> 8 ──> 9 ──> 11
                  │                                        │
                  └────────────> 10 (WhatsApp) <───────────┘
                                                           │
                    12 (Locação)          13 (Entrega)
                                                           │
                                                 12 (Entrega)
```

A tela de conexão do WhatsApp depende apenas da Etapa 1 (precisa de Administrador
logado). Pode ser antecipada a pedido, para testar a Baileys cedo.

---

## 5. Tela de conexão do WhatsApp

Pedido do cliente interno: tela com QR code e botões de conectar e desconectar.

### Riscos identificados e como são neutralizados

| Risco | Gravidade | Como é resolvido |
|---|---|---|
| O QR code **é uma credencial** — quem o vê pareia o WhatsApp da empresa | Alta | Tela restrita ao Administrador; QR nunca aparece em log nem é salvo em arquivo |
| O QR expira em ~20 segundos | Média | Renovação automática por SSE, sem o usuário recarregar a página |
| A sessão salva em disco dá acesso ao WhatsApp | Alta | Criptografada, em volume Docker próprio, já no `.gitignore` |
| Número comercial pode ser bloqueado | Alta | Aviso permanente na tela: usar chip de testes; botão de desconexão de emergência |
| Conexão viva consome memória | Baixa | Monitorada no painel de status; a Baileys usa ~60 MB |

### Por que SSE e não WebSocket

O QR só precisa ir **do servidor para a tela**, nunca o contrário. SSE faz isso com
metade do custo de um WebSocket e reconecta sozinho se a rede cair — vantagem real
num container de 1 núcleo.

### A mesma tela serve para os dois adaptadores

Quando a API oficial da Meta entrar, a tela deixa de mostrar QR code e passa a mostrar
o estado da conta e o número conectado. O usuário aprende uma tela só.
