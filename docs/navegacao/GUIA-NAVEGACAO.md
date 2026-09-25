<!-- versao: 0.36.0 -->

# Guia de Navegação Simples

Este guia mostra, em poucas palavras, para que serve cada tela e onde clicar.

---

# 1 · Antes de começar

## O que é a Porto Inc.

A Porto Inc. é uma **construtora**. Ela constrói prédios, casas e galpões.

## O que este sistema faz

Uma obra gasta material o tempo todo: cimento, tijolo, fio, capacete, betoneira alugada.

**Este sistema cuida de comprar esse material e controlar o que fica guardado.**

Antes, isso era feito por WhatsApp, planilha e papel. Ninguém sabia direito o que tinha
sido pedido, quanto custou da última vez, nem se o material chegou.

## Atenção: os dados são inventados

Tudo que aparece na tela foi criado para você treinar. **Nada disso existe de verdade.**

| É de verdade | Foi inventado |
|---|---|
| As pessoas: Bras, Gilson, Neilma, Andre, Washington | As obras, os materiais e os fornecedores |
| O jeito como a compra anda | As notas, os valores e os prazos |

> **Se for apresentar, fale isso na primeira frase.** Algo como: *"os dados são de
> exemplo, só para o sistema ter o que mostrar"*.

## Como uma compra anda

```
1. Alguém PEDE o material
2. Alguém APROVA o pedido
3. O comprador pede PREÇO para os fornecedores
4. O fornecedor escolhido recebe o PEDIDO
5. O material CHEGA e alguém confere
6. A nota fiscal vira CONTA A PAGAR
```

**Cada parte do menu é um pedaço desse caminho.**

## Como entrar

Abra **http://localhost:5173** e use uma destas contas:

| Conta | Senha | Quem é |
|---|---|---|
| **`porto@dev.com`** | **`admin123`** | **Vê tudo. Use esta para explorar** |
| `admin@portoinc.com.br` | `Porto@2026` | Cuida do sistema |
| `bras@portoinc.com.br` | `Porto@2026` | Pede material e aprova |
| `andre@portoinc.com.br` | `Porto@2026` | Compra |
| `gilson@portoinc.com.br` | `Porto@2026` | Recebe e guarda o material |
| `neilma@portoinc.com.br` | `Porto@2026` | Compra e paga |
| `washington@portoinc.com.br` | `Porto@2026` | O dono. Aprova compra grande |

> **O menu muda conforme quem entrou.** Se um botão não aparece, não está quebrado: é que
> aquela pessoa não faz aquilo.

> **Todo botão azul de criar abre uma janela por cima da tela.** Para fechar: o **X** no
> canto, a tecla **Esc**, um clique fora, ou **Cancelar**. Se você já tinha digitado algo,
> ele pergunta antes de jogar fora.

---

# 2 · As telas

## 1. Início

**Essa tela serve para** você saber o que precisa fazer agora.

**Aqui você consegue:**
- Ver o que está atrasado ou vencendo
- Ver como as coisas estão indo
- Ir direto para qualquer parte do sistema

**Passo:** Clique em **Início** → leia "O que precisa de você" → clique num número para ir
até ele.

---

**— Parte 1: comprar —**

## 2. Solicitações

**Essa tela serve para** a obra pedir material. Toda compra começa aqui.

**Aqui você consegue:**
- Ver tudo que já foi pedido e em que pé está
- Fazer um pedido novo
- Filtrar só o que interessa

**Passo:** Clique em **Solicitações** → **+ Nova solicitação** (azul, no canto direito, ao
lado do título) → escolha a obra → adicione os materiais → **Salvar como rascunho** →
abra o pedido → **Enviar para aprovação**.

> **O botão azul fica sempre no mesmo lugar**, em toda tela do sistema: à direita do
> título. Se você procurar ele em outro canto, não vai achar.

> **Todo filtro vale na hora**, em qualquer tela: escolha e a lista muda sozinha. Não
> existe botão de confirmar em lugar nenhum.
>
> Nos campos de **digitar**, a lista espera você parar de digitar — meio segundo — para
> não buscar a cada letra.

> **Dica:** se você clicar em **Salvar como rascunho**, o pedido fica guardado e ninguém
> vê. Ele só entra na fila quando você clica em **Enviar para aprovação**.

**Se você abrir um pedido, vai ver:**
- Os materiais e o total
- **Quem precisa assinar** e quem já assinou
- **Histórico**: tudo que aconteceu, com nome e hora
- Um botão para **baixar em PDF**

---

## 3. Aprovações

**Essa tela serve para** liberar ou recusar os pedidos.

**Aqui você consegue:**
- Ver o que está esperando a sua assinatura
- Aprovar, devolver para arrumar, ou recusar de vez

**Passo:** Clique em **Aprovações** → **Analisar** → escolha **Aprovar**, **Devolver** ou
**Reprovar** → confirme.

> **Quem aprova depende do valor:**
>
> | Valor do pedido | Quem assina |
> |---|---|
> | até R$ 2.000 | o gestor da obra, sozinho |
> | de R$ 2.000 a R$ 15.000 | o gestor **e** o engenheiro |
> | acima de R$ 15.000 | o dono |
>
> Esses valores são de exemplo. Mudam em **Cadastros → Limites de alçada**.

> **Se a lista aparecer vazia**, não está quebrado. Ou não tem nada esperando você, ou
> você não é quem assina. A tela diz qual dos dois é.

---

## 4. Cotações

**Essa tela serve para** perguntar o preço a vários fornecedores e escolher o melhor.

É a parte que mais economiza dinheiro — e a que tem mais passos. São **quatro telas em
sequência**. Saber isso já resolve metade da confusão.

```
1. A LISTA        os pacotes que existem
2. CRIAR          escolher os materiais que vão junto
3. CONVIDAR       chamar os fornecedores e esperar
4. EQUALIZAR      comparar os preços e fechar
```

> **Pacote** é um grupo de materiais cotados juntos. Você não pede preço item por item:
> junta o que faz sentido comprar do mesmo fornecedor e manda de uma vez.

---

### 4.1 · A lista

**Aqui você consegue** ver todos os pacotes e em que pé está cada um.

| Coluna | O que diz |
|---|---|
| Convidados | quantos fornecedores foram chamados |
| Respostas | quantos já mandaram preço |
| Prazo | até quando eles podem responder |

| Botão | O que faz |
|---|---|
| **Situação** + **Filtrar** | mostra só os pacotes naquele estado |
| **Abrir** | vai para a tela de convidar |
| **+ Novo pacote de cotação** | abre a tela de criar |

---

### 4.2 · Criar o pacote

**Aqui você consegue** escolher o que vai ser cotado.

A tela mostra **os itens aprovados esperando cotação** — tudo que já passou pela
aprovação e ainda não foi comprado. Você marca quais entram neste pacote.

| Campo ou botão | O que faz |
|---|---|
| **Título do pacote** | é o que o fornecedor vê no convite. Ex.: "Material elétrico — 2º pavimento" |
| **Prazo para responder** | depois dessa data o fornecedor não consegue mais mandar preço |
| **Observações para o fornecedor** | vai junto no convite. Ex.: "entrega na obra, não no escritório" |
| **Marcar/desmarcar visíveis** | marca de uma vez tudo que está aparecendo na lista |
| **Criar pacote e escolher fornecedores** | cria e leva para a próxima tela |

> **Ainda não saiu nada.** Criar o pacote não avisa fornecedor nenhum — isso é na tela
> seguinte.

---

### 4.3 · Convidar os fornecedores

**Aqui você consegue** chamar quem vai dar preço, e acompanhar quem respondeu.

A tela tem três partes:

| Parte | O que mostra |
|---|---|
| **Itens do pacote** | o que está sendo cotado, e quantas respostas cada item já tem |
| **Convidados** | quem foi chamado, se **abriu o link**, se respondeu, e o total que ofereceu |
| **Fornecedores sugeridos** | quem vende aquela família de material e ainda não foi chamado |

> O sistema sugere fornecedor **pela família do material**. Se o pacote é de elétrica, ele
> sugere quem vende elétrica. Isso vem de **Cadastros → Fornecedores**.

| Botão | O que faz |
|---|---|
| **Convidar pelo WhatsApp** | manda o link para o número do fornecedor |
| **Convidar por e-mail** | manda o mesmo link por e-mail |
| **Copiar link** | copia o link para você mandar do seu jeito |
| **Remover** | tira um convidado que ainda não respondeu |
| **Atualizar** | recarrega, para ver se chegou resposta nova |
| **Equalizar e escolher** | vai para a comparação |
| **Encerrar cotação** | fecha o pacote sem comprar nada |

> ⚠️ **Está tudo em modo de teste.** Nenhuma mensagem sai para fornecedor de verdade.

**Como o fornecedor responde:** ele recebe um link, abre **sem senha**, vê só os itens
daquele pacote e preenche preço e prazo. Ele **não vê** quem mais foi convidado nem quanto
os outros ofereceram.

---

### 4.4 · Equalizar e escolher

**Aqui você consegue** comparar os preços lado a lado e fechar a compra.

"Equalizar" quer dizer **pôr na mesma régua**: todos os preços do mesmo item, um ao lado do
outro, para dar para comparar de verdade.

| Parte | O que mostra |
|---|---|
| **Mapa comparativo** | uma linha por item, uma coluna por fornecedor. O mais barato já vem marcado |
| **Condições comerciais** | prazo e forma de pagamento de cada fornecedor |
| **Fechar a compra** | o resumo do que você escolheu, por fornecedor |

| Botão | O que faz |
|---|---|
| **Aceitar todos os melhores preços** | escolhe o mais barato de cada item de uma vez |
| **Salvar escolhas** | guarda sem fechar, para continuar depois |
| **Última chamada** | avisa quem não está na frente que ainda dá para melhorar |
| **Gerar pedidos de compra** | fecha: **um pedido para cada fornecedor escolhido** |

> **O mais barato nem sempre é o melhor.** Você pode escolher item por item — às vezes vale
> pagar um pouco mais por quem entrega no prazo. A aba **Fornecedores**, em Relatórios,
> mostra quem costuma cumprir.

**Sobre a "Última chamada":** ela avisa cada fornecedor apenas dos itens em que ele **não**
está na frente, e o convida a rever. **O preço do concorrente nunca é revelado** — revelar
ensinaria o mercado a se alinhar, e a Porto Inc. acabaria pagando mais caro.

---
## 5. Pedidos

**Essa tela serve para** acompanhar os pedidos já enviados aos fornecedores.

**Aqui você consegue:**
- Ver o que foi comprado de quem
- Baixar o pedido em PDF
- Mandar de novo por WhatsApp ou e-mail

**Passo:** Clique em **Pedidos** → clique no **⋮** da linha → escolha o que quer fazer.

---

**— Parte 2: receber e guardar —**

## 6. Recebimento

**Essa tela serve para** conferir se chegou o que foi pedido.

**Aqui você consegue:**
- Ver o que está a caminho
- Marcar o que chegou, item por item
- Dizer se veio certo, com defeito, ou se foi devolvido

**Passo:** Clique em **Recebimento** → **Conferir** → marque as quantidades → preencha a
nota fiscal → **Registrar recebimento**.

> **Dá para receber só uma parte.** Se chegou metade, marque a metade. O pedido continua
> aberto esperando o resto.

> **Tem um leitor de código de barras.** No campo **Localizar**, bipe o código e o item
> acende na lista. Assim o almoxarife não precisa procurar.

---

## 7. Estoque

**Essa tela serve para** saber o que tem guardado e tirar material para a obra.

**Aqui você consegue:**
- Ver quanto tem de cada material
- Tirar material para uma obra
- Ver o que está acabando

**Passo:** Clique em **Estoque** → ache o material → **Retirar** → diga quanto e para quem.

**Outros botões:**
- **Contar** — você conta o que existe de verdade e o sistema ajusta
- **Ver extrato** — tudo que entrou e saiu daquele material
- **Montar reposição** — o sistema lista o que está acabando, pronto para virar pedido

---

## 8. Locação

**Essa tela serve para** controlar equipamento alugado, tipo betoneira e andaime.

**Aqui você consegue:**
- Ver o que está alugado e desde quando
- Ver quanto já custou
- Ver o que passou do prazo de devolução

**Passo:** Clique em **Locação** → **Devolver** quando o equipamento voltar.

> **Equipamento parado continua contando diária.** Por isso esta tela mostra o custo do
> atraso em vermelho: é dinheiro saindo à toa.

---

**— Parte 3: pagar e acompanhar —**

## 9. Financeiro

**Essa tela serve para** controlar as contas a pagar.

**Aqui você consegue:**
- Ver quanto a empresa deve e para quando
- Lançar a nota fiscal do fornecedor
- Marcar uma conta como paga

**Passo:** Clique em **Financeiro** → role até **Parcelas** → **Dar baixa** na conta que
foi paga → informe a data e a forma.

**Para lançar uma nota:** **Financeiro** → **Notas fiscais** → **Lançar nota** (ou
**Importar XML**, que lê tudo sozinho) → **Gerar parcelas**.

**O gráfico de fluxo de caixa** mostra quanto sai por mês.
- As setas **‹** e **›** andam um mês
- O campo do meio abre um calendário e pula para qualquer mês
- **Hoje** volta para o mês atual
- Não dá para ir para o futuro: o mês que vem ainda não aconteceu

---

## 10. Relatórios

**Essa tela serve para** responder perguntas sobre o negócio.

**Aqui você consegue:**
- Escolher uma das cinco abas
- Filtrar por obra e por período
- Baixar em **PDF ou Word**

**Passo:** Clique em **Relatórios** → escolha a aba → filtre → **Baixar**.

| Aba | Pergunta que ela responde |
|---|---|
| Orçamento | A obra está gastando mais do que podia? |
| Economia | Valeu a pena pedir preço a vários? |
| Fornecedores | Em quem dá para confiar? |
| Tempos | Onde o processo está travando? |
| Consumo | O que a empresa mais compra? |

> **A aba Economia é a melhor para mostrar numa apresentação.** Ela diz, em dinheiro,
> quanto a disputa entre fornecedores economizou.

---

**— Parte 4: configurar —**

## 11. Cadastros

**Essa tela serve para** cadastrar as coisas que o resto do sistema usa.

**Aqui você consegue:** entrar em cinco cadastros.

**Passo:** Clique em **Cadastros** → escolha um dos cinco.

| Cadastro | Para que serve |
|---|---|
| Famílias | Separa o material por tipo: cimento, elétrica, EPI |
| Materiais e serviços | A lista de tudo que dá para pedir |
| Fornecedores | Quem vende, e o que cada um vende |
| Obras | As obras da empresa. Cada obra ganha um estoque |
| Limites de alçada | Quem pode aprovar até quanto |

> **Num sistema novo, comece por aqui.** Sem material cadastrado, não tem o que pedir.

---

## 12. Usuários

**Essa tela serve para** cadastrar pessoas e dizer o que cada uma pode fazer.

**Aqui você consegue:**
- Criar uma pessoa nova
- Marcar o que ela faz
- Desativar quem saiu da empresa

**Passo:** Clique em **Usuários** → **+ Novo usuário** → preencha → marque as funções.

> Uma pessoa pode fazer **mais de uma coisa**. A Neilma compra e paga.

---

## 13. Avisos ao fornecedor

**Essa tela serve para** ver as mensagens que o sistema mandou.

**Aqui você consegue:**
- Ver se o WhatsApp e o e-mail estão ligados
- Ver tudo que já foi enviado

**Passo:** Clique em **Avisos** → escolha **WhatsApp** ou **E-mail** → veja o histórico.

> ⚠️ **Está tudo em modo de teste.** Nenhuma mensagem sai para fornecedor de verdade.

---

## 14. Status do sistema

**Essa tela serve para** conferir se está tudo funcionando.

**Aqui você consegue:** ver se o sistema está no ar.

**Passo:** Clique em **Status do sistema** → se estiver tudo verde, está tudo certo.

---

## Extra: a tela do fornecedor

**Essa tela serve para** o fornecedor responder o preço.

Ela **não fica no menu**, porque não é para quem trabalha na Porto Inc. O fornecedor
recebe um link e abre sem senha.

**Passo para mostrar:** **Cotações** → abra uma → **Copiar link** → cole numa aba anônima.

---

# 3 · Roteiro para apresentar

Siga **uma compra do começo ao fim**. Mostra muito mais que abrir tela por tela.

| # | Entre como | Faça |
|---|---|---|
| 1 | `bras` | Peça um material em **Solicitações** |
| 2 | `bras` | Aprove em **Aprovações** |
| 3 | `andre` | Monte a cotação e chame fornecedores |
| 4 | — | Abra o link do fornecedor numa aba anônima |
| 5 | `andre` | **Equalizar** → escolha os melhores → **Gerar pedidos** |
| 6 | `gilson` | Receba o material em **Recebimento** |
| 7 | `neilma` | Lance a nota e gere as parcelas |
| 8 | `neilma` | **Dar baixa** numa parcela |
| 9 | `porto@dev.com` | **Relatórios → Economia**: mostre quanto economizou |

**Termine no Início.** Ele resume tudo em números, e cada número volta para a tela de
onde veio.

> Pode mexer à vontade. Nada é enviado de verdade, e dá para recarregar os dados do zero.

---

# 4 · Se travar

| Aconteceu | O que fazer |
|---|---|
| A tela não abre | Veja **Status do sistema** |
| Não achei um botão | Aquela conta não faz aquilo. Entre com `porto@dev.com` |
| Apareceu "Muitas requisições" | Espere 1 minuto e tente de novo |
| Quero recomeçar | Peça para recarregar os dados de teste |
