<!-- versao: 0.28.3 -->

# Guia de Navegação

Para aprender a mexer e para apresentar. O detalhe campo a campo está no
`Tutorial-PortoInc.pdf`.

# 1 · Para começar

## A empresa e o sistema

A **Porto Inc. é uma construtora** — ela levanta obra. Comprar material não é o negócio
dela; é o que faz o negócio andar, e era a parte que vivia em WhatsApp, planilha e papel.

**Este sistema é o caminho oficial da compra**, do pedido da obra até a nota fiscal paga.
Ele responde três perguntas que ninguém conseguia responder antes: *o que foi pedido*,
*quanto custou da última vez* e *se o material chegou*.

## ⚠️ Os dados são de exemplo

| Real | Inventado para a demonstração |
|---|---|
| As pessoas (nomes da reunião) e seus papéis | Obras, materiais, fornecedores, notas, valores |
| O fluxo de compra e as regras | **Os limites de alçada (R$ 2.000 / R$ 15.000)** |

**Diga isso na primeira frase da apresentação.** E aproveite: alçadas, famílias e
fornecedores são justamente o que **eles** precisam informar.

## O caminho de uma compra

```
SOLICITAÇÃO → APROVAÇÃO → COTAÇÃO → PEDIDO → RECEBIMENTO → FINANCEIRO
  a obra pede   pelo valor   3 preços  emitido   confere      paga
```

**Cada grupo do menu é um trecho desse caminho.** Compras, Almoxarifado, Gestão.

## Contas · senha `Porto@2026`

| Conta `@portoinc.com.br` | Papel | Use para mostrar |
|---|---|---|
| `admin` | tudo | o sistema inteiro |
| `bras` | Gestor de obra + Solicitante | pedir e aprovar |
| `andre` | Comprador | cotar e comprar |
| `gilson` | Almoxarife | receber e estoque |
| `neilma` | Comprador + Solicitante | pagar |
| `washington` | Fundador | aprovar valor alto |

> **O menu muda conforme a pessoa.** Botão que não aparece não é falha: é permissão.

---

# 2 · As telas, na ordem do menu

## 1 · Início

**Serve para** responder "o que preciso fazer agora", antes de qualquer menu.

| Bloco | O que é |
|---|---|
| **O que precisa de você** | Só o que **cobra ação sua**: prazo perdido primeiro, depois o que vence. Vazio = nada travado |
| **Como estão as coisas** | Números de acompanhamento. Não cobram nada |
| **Ir para** | Atalhos — os mesmos itens do seu menu |

**Todo número é clicável** e leva à tela onde ele mora, já no assunto certo.

---

**— Compras —**

## 2 · Solicitações

**Serve para** a obra pedir material ou serviço. É onde toda compra nasce.
**A lista mostra** o que foi pedido e em que pé está.

| Controle | O que faz |
|---|---|
| **Situação** | filtra por etapa; vazio = todas |
| **Só as minhas** | só aparece para quem enxerga as dos outros |
| **Filtrar** | aplica os dois acima |
| **+ Nova solicitação** | só para quem tem permissão de criar |

**Colunas:** Número · Obra · Solicitante · Itens · Total estimado · Precisa até · Situação

### + Nova solicitação

Obra → itens do catálogo → prazo. **Salvar como rascunho** guarda sem mandar; ela só entra
na fila quando você **Enviar para aprovação**.

| Campo | Observação |
|---|---|
| Obra · Precisa até | obrigatórios |
| Item do catálogo | vem de Cadastros — não dá para digitar item livre |
| Linha do orçamento | liga o gasto ao orçamento da obra; é o que alimenta o relatório |
| Valor unitário estimado | palpite, só para calcular a alçada |
| Justificativa | aparece para quem aprova |

### Abrir uma solicitação

| Bloco | O que é |
|---|---|
| **Itens solicitados** | o que foi pedido, com total |
| **Assinaturas** | **quem precisa assinar e quem já assinou** — a alçada na prática |
| **Histórico** | cada passo, com quem e quando. É a auditoria |
| **Baixar PDF** | para imprimir ou mandar |
| **Cancelar solicitação** | só antes de virar pedido |


## 3 · Aprovações

**Serve para** liberar ou devolver. **Mostra só o que é da sua alçada** — não é a fila de
todo mundo.

**Colunas:** Número · Obra · Solicitante · Justificativa · Valor · Precisa até · Assinaturas

**Analisar** abre a solicitação com **Aprovar** e **Devolver**. Devolver **exige motivo**,
que volta para quem pediu.

> **A alçada é por valor** (valores de exemplo): até R$ 2.000 o gestor assina sozinho; de
> R$ 2.000 a R$ 15.000 exige gestor **e** engenheiro; acima disso, o fundador. Muda em
> Cadastros → Limites de alçada.


## 4 · Cotações

**Serve para** pedir preço a vários fornecedores e comparar.
**A lista mostra** os pacotes, quantos foram convidados e quantos responderam.

**Colunas:** Número · Título · Itens · Convidados · Respostas · Prazo · Situação

### + Novo pacote de cotação

Mostra **os itens já aprovados esperando cotação** — você marca quais entram. Dá título e
prazo, e o sistema **sugere fornecedores pela família do material**.

### Abrir um pacote

| Bloco | O que é |
|---|---|
| **Itens do pacote** | o que está sendo cotado |
| **Convidados** | quem foi chamado, se **abriu o link**, se respondeu e o total |
| **Fornecedores sugeridos** | quem atende aquelas famílias e ainda não foi chamado |
| **Convidar pelo WhatsApp / por e-mail** | manda o link do portal |
| **Equalizar e escolher** | vai para o comparativo |
| **Encerrar cotação** | fecha sem escolher |

> O fornecedor **não entra no sistema**: ele responde por um link próprio (o Portal), sem
> senha e sem ver o preço dos concorrentes.

### Equalizar e escolher

| Bloco | O que é |
|---|---|
| **Mapa comparativo** | preços lado a lado; o melhor de cada item marcado |
| **Aceitar todos os melhores preços** | escolhe tudo de uma vez — dá para trocar item a item depois |
| **Condições comerciais** | prazo e forma de pagamento de cada um |
| **Última chamada** | reabre e avisa quem não respondeu |
| **Gerar pedidos de compra** | fecha: **um pedido por fornecedor escolhido** |


## 5 · Pedidos

**Serve para** acompanhar o que foi emitido e garantir que o fornecedor recebeu.

**Colunas:** Número · Fornecedor · Origem · Itens · Total · Pagamento · Situação

No **⋮** de cada linha: **Baixar PDF** · **Mandar pelo WhatsApp** · **Mandar por e-mail** ·
**Marcar como enviado** (para quando você avisou por fora).

---

**— Almoxarifado —**

## 6 · Recebimento

**Serve para** conferir a entrega **contra o pedido**. É o que impede pagar por material
que não chegou.

| Bloco | O que é |
|---|---|
| **Esperando entrega** | pedidos a caminho, com quantos itens faltam |
| **Últimas entregas conferidas** | o que já passou, com nota e quem conferiu |

### Conferir

| Parte | O que faz |
|---|---|
| **O que chegou** | por item: já recebido, saldo, **recebido agora**, devolvido |
| Como chegou | **Chegou certo** · **Aceito com ressalva** · **Devolvido** |
| **Localizar** | **lê o código de barras** (ou o COD PORTO) e destaca o item na lista — o almoxarife confere com o leitor na mão, sem procurar |
| **Recebi tudo que falta** | preenche o saldo de todos de uma vez |
| **Documento da entrega** | nota, série, transportadora, almoxarifado de destino |
| **Registrar recebimento** | dá entrada no estoque |

> **Aceita entrega parcial.** O pedido continua aberto pelo saldo, e o resto chega depois.


## 7 · Estoque

**Serve para** saber o que tem, tirar para a obra e avisar quando está acabando.

**Colunas:** Material · Saldo · Mínimo · Custo médio · Valor parado

| Controle | O que faz |
|---|---|
| **Almoxarifado** | cada obra tem o seu |
| **Procurar material** | por nome ou código |
| **Retirar** | tira para uma obra/frente — pede para quem vai |
| **Contar** | inventário: informa o que existe de verdade e o sistema ajusta |
| **Ver extrato** | toda entrada e saída daquele material |
| **Montar reposição** | lista o que está **abaixo do mínimo**, pronto para virar solicitação |


## 8 · Locação

**Serve para** equipamento alugado — e para **ver o dinheiro correndo**: parado, ele
continua contando diária.

**Colunas:** Contrato · Equipamento · Obra · Cobrança · Devolução · Já custou · Atraso · Situação

Os quatro números no topo: **Atrasadas** · **Custo do atraso** · **Vencendo** · **Em andamento**.

| Ação | O que faz |
|---|---|
| **Nova locação** | equipamento, obra, valor do período, devolução prevista |
| **Devolver** | encerra e congela o custo |
| **Cancelar locação** | exige motivo |

**O que fazer agora**, no fim da tela, lista em texto o que está atrasado e o que fazer.

---

**— Gestão —**

## 9 · Financeiro

**Serve para** transformar nota fiscal em parcela e controlar o pagamento.

**Números do topo:** Vencidas · Vencem em 7 dias · Total em aberto · Pago no mês · Prazo
médio · Maior parcela · Parcela média · Notas lançadas.

| Gráfico | Responde |
|---|---|
| **Fluxo de caixa** | quanto sai por mês, passado e futuro |
| **Composição da carteira** | que parte do que devo está atrasada |
| **Pontualidade** | das já pagas, quantas saíram no prazo |
| **Para quem mais deve** / **Custo por obra** | concentração |

**No fluxo de caixa:** **‹ ›** andam um mês · o campo do meio salta para qualquer mês ·
**Hoje** volta. Não avança além do mês atual. Toque numa barra para ver os valores.

### Parcelas (no fim da tela)

**Mostrar** (Todas · Em aberto · Vencidas · Vencem em 7 dias · Pagas · Canceladas) e
**Situação** filtram. **Dar baixa** registra o pagamento: data, forma e valor pago.
**Baixar contas** sai em PDF ou Word.

### Notas fiscais

**Lançar nota** manual ou **Importar XML** (lê tudo da nota). **Gerar parcelas** cria as
contas a pagar pela condição negociada. **Arquivos** guarda XML e PDF da nota.

> A nota é sempre **ligada a um pedido** — é assim que o sistema confere o que foi
> comprado contra o que está sendo cobrado.


## 10 · Relatórios

**Cinco abas, cada uma responde uma pergunta.** Filtram por obra e período, e baixam em
PDF ou Word.

| Aba | Pergunta |
|---|---|
| **Orçamento** | A obra está estourando o orçamento? |
| **Economia** | A cotação valeu a pena? |
| **Fornecedores** | Em quem dá para confiar? |
| **Tempos** | Onde o processo trava? |
| **Consumo** | O que a empresa mais compra? |

> **Economia** é o relatório que justifica o sistema: mostra quanto a disputa entre
> fornecedores economizou em dinheiro.

---

**— Administração —**

## 11 · Cadastros

**A base que o resto usa.** Numa instalação nova, comece por aqui — sem material, não há
o que solicitar.

| Cadastro | Para quê |
|---|---|
| **Famílias** | agrupa material (cimento, elétrica, EPI). É por ela que o sistema sugere fornecedor |
| **Materiais e serviços** | o catálogo que a solicitação usa |
| **Fornecedores** | quem recebe cotação, com as famílias que atende |
| **Obras** | onde o material é usado; **cria o almoxarifado** e recebe o orçamento por linha |
| **Limites de alçada** | quem assina até quanto |


## 12 · Usuários

**Serve para** cadastrar pessoas e definir o que cada uma pode.

**Colunas:** Nome · E-mail · Funções · Último acesso · Situação

**+ Novo usuário** · **Desativar / Reativar** (desativar derruba a sessão na hora).

No fim da tela, **Funções e o que cada uma libera** — a tabela que responde "por que o
Gilson não vê isso?".

> Uma pessoa pode ter **mais de uma função**; as permissões somam.


## 13 · Avisos ao fornecedor

**Serve para** ligar WhatsApp e e-mail, e ver tudo que o sistema mandou.

Duas abas. Cada uma tem: situação da conexão, **números/e-mails autorizados**, envio de
teste e **histórico**.

> ⚠️ **Tudo em modo de teste.** Nada sai para fornecedor de verdade, e a tela avisa isso
> no topo. Só recebe quem está na lista de autorizados.


## 14 · Status do sistema

Banco, API e integrações. **Tudo verde = o problema não é o sistema.** **Atualizar agora**
refaz a checagem.


## Fora do menu · o Portal do fornecedor

O fornecedor **não tem conta**. Ele recebe um link, abre sem senha, vê **só os itens
daquela cotação** e preenche preço e prazo. Não vê concorrente nem preço alheio.

**Para mostrar:** em Cotações → Abrir → **Copiar link**, e cole em aba anônima.

---

# 3 · Roteiro de apresentação · 20 minutos

Siga **uma compra inteira**. Conta uma história em vez de listar telas.

| # | Conta | Faça |
|---|---|---|
| 1 | `bras` | **Solicitações → + Nova** → peça um material → **Enviar para aprovação** |
| 2 | `bras` | **Aprovações → Analisar → Aprovar** (mostre o bloco **Assinaturas**) |
| 3 | `andre` | **Cotações → + Novo pacote** → marque o item → convide fornecedores |
| 4 | — | **Copiar link** e abra em aba anônima: é a visão do fornecedor |
| 5 | `andre` | **Equalizar** → **Aceitar todos os melhores** → **Gerar pedidos** |
| 6 | `gilson` | **Recebimento → Conferir** → registre a entrega |
| 7 | `neilma` | **Financeiro → Notas fiscais** → lance a nota → **Gerar parcelas** |
| 8 | `neilma` | **Dar baixa** numa parcela |
| 9 | `admin` | **Relatórios → Economia** → quanto a cotação economizou |

**Feche no Início:** ele resume tudo em números, e cada número volta para a tela de origem.

> Pode criar à vontade: nada sai para fornecedor nenhum, e o banco recarrega do zero.


## Se travar

| Aconteceu | O que fazer |
|---|---|
| A tela não abre | **Status do sistema** |
| Não achei um item no menu | a conta não tem a função — entre como `admin` |
| "Muitas requisições" | espere 1 minuto |
| Quero recomeçar | peça para recarregar os dados de teste |
