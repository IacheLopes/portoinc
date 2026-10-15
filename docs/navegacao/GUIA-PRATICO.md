<!-- versao: 0.60.0 -->

# Guia prático — a ordem das coisas

Uma compra atravessa o sistema sempre na mesma ordem. Cada passo abaixo diz **onde clicar**,
**o que é** e **o que preencher**.

O menu da esquerda tem seis entradas: **Início**, **Compras**, **Almoxarifado**,
**Financeiro**, **Relatórios** e **Administração**.

---

## Antes de começar

| | |
|---|---|
| **Endereço** | `http://192.168.1.109` — abre em qualquer máquina da mesma rede |
| **Conta para apresentar** | `porto@dev.com` · senha `admin123` |
| **Contas da empresa** | `washington@portoinc.com.br`, `andre@...`, `neilma@...` · senha `admin123` |

> **Por que a conta `porto@dev.com`:** ela acumula **os sete papéis**, então faz a compra
> inteira sem trocar de login no meio da demonstração. A tela inicial dela se identifica
> como *"Conta de Desenvolvedor"* — e isso é bom de explicar, porque mostra que o sistema
> separa papéis de verdade.
>
> **A conta `admin@portoinc.com.br` não assina aprovação.** Administrador abre as telas;
> **assinar depende de estar numa faixa de alçada**, e as faixas citam Gestor de obra,
> Engenheiro e Fundador. Se quiser mostrar a separação, entre como **Washington** (fundador).

**O que já está cadastrado:** 10 famílias, 20 materiais, 10 fornecedores, 3 obras, o
orçamento da primeira obra e as três faixas de alçada. Mais **uma compra já encaminhada** —
`SOL-00001`, aprovada, virou o pacote `BID-00001` com 3 fornecedores convidados e o prazo
correndo. O resto do caminho está livre para você percorrer ao vivo.

**As faixas de alçada**, que decidem quem assina:

| Valor da solicitação | Quem precisa assinar |
|---|---|
| até R$ 2.000 | Gestor de obra |
| R$ 2.000 a R$ 15.000 | Gestor de obra **e** Engenheiro — os dois |
| acima de R$ 15.000 | Fundador |

> Para a alçada aparecer na demonstração, faça **uma solicitação acima de R$ 15.000**: ela
> sobe direto para o fundador, e a tela diz quem falta assinar.

---

## Passo 1 · Alimentar o sistema

**Administração** — nesta ordem, porque cada uma depende da anterior.

| Onde | O que cadastrar |
|---|---|
| **Famílias** | os grupos de material: Elétrica, Hidráulica, Cimento |
| **Materiais** | o catálogo. Cada item pertence a uma família |
| **Fornecedores** | CNPJ, **WhatsApp**, **e-mail** e as famílias que ele atende |
| **Obras** | as obras em andamento |
| **Limites de alçada** | quem assina cada faixa de valor |
| **Usuários** | as pessoas e o que cada uma pode fazer |

> **O que mais importa aqui:** a **família** do fornecedor. É por ela que o sistema sabe a
> quem pedir cotação. Fornecedor sem família nunca aparece na lista.
>
> E o **WhatsApp ou e-mail**: sem um dos dois, ele não recebe convite nenhum.

---

## Passo 2 · A obra pede

**Compras → Solicitações → `Nova solicitação de compra`**

É a obra dizendo o que precisa. Quem abre é qualquer funcionário.

**Preencha:** a **obra**, a **data em que precisa**, e os **itens** — material, quantidade e
o valor que você estima.

> Item que a empresa nunca comprou exige **especificação técnica** (marca, dimensão, norma).
> Sem isso o comprador não sabe o que cotar, e o sistema não deixa enviar.

Termine em **`Enviar para aprovação`**.

---

## Passo 3 · Alguém assina

**Compras → Aprovações**

A fila de quem decide. **Quantas assinaturas depende do valor** — a tela mostra quem falta.

Botões: **`Aprovar`**, **`Reprovar`** ou **`Devolver para revisão`**.

> Ninguém aprova a própria solicitação. E acima do limite, sobe para o fundador.

---

## Passo 4 · Pedir preço aos fornecedores

**Compras → Cotações → `Novo pacote de cotação`**

Os itens aprovados aparecem agrupados por família. Marque os que vão juntos e use
**`Criar pacote e escolher fornecedores`**.

**Preencha:** o **título** do pacote e o **prazo de resposta**.

Depois: **`Convidar fornecedores`** → escolha quem recebe → **`Abrir cotação`**.

O sistema manda **por WhatsApp** quem tem número, **por e-mail** quem não tem. O fornecedor
recebe um **link**, responde **sem senha e sem cadastro**, pelo celular.

> **É o momento que mais impressiona numa demonstração.** Abra o link numa aba anônima e
> responda como se fosse o fornecedor.

---

## Passo 5 · Comparar e fechar

**Compras → Cotações → o pacote → `Equalizar e escolher`**

A tabela mostra todos lado a lado, com o **melhor preço de cada item destacado em verde**.
Dois fornecedores podem empatar — aí os dois ficam verdes e a escolha é sua.

1. Clique numa célula para escolher quem leva aquele item
2. **`Salvar escolhas`** — o botão vira *"Escolhas salvas"*
3. **`Encerrar cotação`** no pacote
4. **`Gerar pedidos de compra`**

> **`Última chamada`** reabre o prazo e avisa quem não está na frente, **sem revelar o preço
> do concorrente** — só em quais itens ele perdeu.
>
> Sai **um pedido para cada fornecedor escolhido**.

---

## Passo 6 · Mandar o pedido

**Compras → Pedidos → abra o pedido**

Manda por **WhatsApp** ou **e-mail**, com o **PDF do pedido em anexo**. O fornecedor recebe
o documento com itens, preços e condição de pagamento.

---

## Passo 7 · O material chega

**Almoxarifado → Recebimento → o pedido → `Registrar recebimento`**

O almoxarife confere o que chegou contra o que foi pedido.

**Preencha:** quanto chegou de cada item. **`Preencher com o saldo`** completa tudo de uma
vez quando veio completo.

> **Entrega parcial é normal:** registre o que chegou e o resto continua esperando. O mesmo
> pedido recebe quantas entregas forem.

---

## Passo 8 · O estoque

**Almoxarifado → Estoque**

O que entrou fica aqui. Saída é registrada quando alguém retira para a obra, e o extrato
mostra toda a movimentação.

> Caindo abaixo do mínimo, o sistema **abre uma solicitação sozinho**.

---

## Passo 9 · A nota vira dívida

**Financeiro → Notas fiscais → `Lançar nota`**

**Preencha:** número, série, valor e o **pedido** de origem. O sistema compara com o pedido
e acusa se o valor não bate.

Depois: **`Gerar parcelas`** — elas nascem com a condição **combinada na cotação**. Ninguém
digita prazo de pagamento duas vezes.

---

## Passo 10 · Pagar

**Financeiro → Contas a pagar → `Dar baixa`**

**Preencha:** a data real do pagamento. O valor já vem preenchido com o que falta.

> Pagando **menos**, o sistema pergunta o que aconteceu: **paguei só uma parte** (o resto
> continua devendo) ou **foi desconto** (a parcela quita). São coisas diferentes.

---

## Passo 11 · Olhar o resultado

**Relatórios** — orçado × realizado por obra, economia das cotações, desempenho dos
fornecedores e tempo de cada etapa.

**Início** resume tudo em números, e cada número leva à tela de onde veio.

---

# Fora do caminho da compra

| Onde | Para quê |
|---|---|
| **Financeiro → Receitas e despesas** | dinheiro que entra e sai sem ser compra |
| **Almoxarifado → Locação** | equipamento alugado e a data de devolver |
| **Administração → Comunicação** | ligar o WhatsApp e o e-mail, e ver tudo que foi enviado |
| **Administração → Status do sistema** | o que está no ar e o que ainda é simulado |

---

# Roteiro de 10 minutos para apresentar

Entre com uma conta que tenha todos os papéis e siga **uma compra inteira**:

1. **Solicitações** — peça um material
2. **Aprovações** — aprove, mostrando que **o valor decide quem assina**
3. **Cotações** — monte o pacote e convide dois fornecedores
4. **Aba anônima** — abra o link e responda como fornecedor
5. **Equalização** — compare, escolha e **gere os pedidos**
6. **Recebimento** — receba **só parte**, de propósito
7. **Financeiro** — lance a nota, gere as parcelas e dê baixa
8. **Relatórios** — feche em Economia e Orçamento

**Termine no Início.**

> **Os três momentos que mais impressionam:** o fornecedor respondendo pelo celular sem
> cadastro; a equalização mostrando quanto se economiza escolhendo item a item; e a nota
> virando contas a pagar sozinha, com a condição que veio da cotação.

---

## Passo 12 · Perguntar ao assistente, pelo WhatsApp

Depois de percorrer a compra, é o fecho natural: o sistema que acabou de ser alimentado
passa a responder perguntas no WhatsApp.

| Onde | O que fazer |
|---|---|
| **Administração → Área IA** | mostre o cartão: um nome, um botão |
| **Onde ele atende** | mostre o grupo liberado no dropdown |
| **Pergunte a ele** | pergunte ali, na tela, e leia a resposta em voz alta |

**Três perguntas que mostram o valor, em ordem:**

1. *"Quantos fornecedores estão cadastrados e de que famílias?"* — ele consulta o
   cadastro e resume.
2. *"Quais cotações estão esperando resposta?"* — ele cruza pacote e convidados.
3. *"O que está esperando aprovação, e de quem?"* — ele diz o que falta assinar.

> **O que explicar junto:** ele **só lê**. Não aprova, não cria, não muda preço — e isso
> não é promessa, é o desenho: as ferramentas que ele tem só sabem consultar.
>
> E **quem pergunta muda o que ele responde**: quem é da equipe vê valores; um
> fornecedor vê só o que é dele, nunca o preço do concorrente.

> **Quem responde é o número do QR Code.** Vale dizer isso na apresentação, porque é a
> primeira pergunta que aparece: não existe um número da IA, ele fala pelo WhatsApp que
> foi conectado ao sistema.
