<!-- versao: 0.43.1 -->

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
| O jeito como a compra anda, do pedido ao pagamento | As obras, os materiais e os fornecedores |
| As regras: quem aprova o quê, conforme o valor | As pessoas, as notas, os valores e os prazos |

> **Se for apresentar, fale isso na primeira frase.** Algo como: *"os dados são de
> exemplo, só para o sistema ter o que mostrar"*.

> **Sistema recém-instalado vem vazio.** Se as telas estiverem sem nada, não está
> quebrado: falta cadastrar. O **Guia de Como Encher o Sistema** mostra a ordem.

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
| **`porto@dev.com`** | **`admin123`** | **Tem os sete papéis. É esta que você usa** |
| `admin@portoinc.com.br` | `admin123` | Cuida do sistema |

> **Use a `porto@dev.com` para tudo.** Ela enxerga o sistema inteiro, então nenhum botão
> some da sua frente no meio de uma demonstração.

**E as contas de cada papel?** Existem seis — comprador, gestor, engenheiro, fundador,
almoxarife e solicitante —, mas **elas foram criadas por você**, na tela de Usuários, cada
uma com uma senha sorteada na hora. **Só quem criou sabe a senha.**

Elas servem para **provar permissão**: mostrar que o almoxarife realmente não consegue
aprovar uma compra. Se você não tem mais as senhas, entre em **Usuários**, abra a pessoa e
**gere uma senha nova** — o sistema mostra a senha na tela, uma vez só.

> Cinco delas ainda estão marcadas para **trocar a senha no primeiro acesso**. Se você
> entrar com uma e ele pedir senha nova, não está quebrado: é a regra funcionando.

> **O menu muda conforme quem entrou.** Se um botão não aparece, não está quebrado: é que
> aquela pessoa não faz aquilo.

> **Todo botão azul de criar abre uma janela por cima da tela.** Para fechar: o **X** no
> canto, a tecla **Esc**, um clique fora, ou **Cancelar**. Se você já tinha digitado algo,
> ele pergunta antes de jogar fora.

---

# 2 · As telas

## Em toda lista: as páginas

Toda lista grande do sistema mostra **20 linhas por vez**. Isso vale para
Solicitações, Cotações, Pedidos, Entregas, Extrato do estoque, Notas, Contas a pagar,
Locação, Materiais e Fornecedores.

**Em cima da lista** tem uma frase dizendo onde você está:

```
Mostrando 21 a 40 de 68 solicitações
```

Esse **68** é quantas existem de verdade, contadas no banco. Não é quantas apareceram.

**Embaixo da lista** ficam os botões de página:

```
«  ‹   1  …  6  [7]  8  …  250   ›  »
```

| Botão | Vai para |
|---|---|
| `«` | A primeira página |
| `‹` | A página de antes |
| Um número | Aquela página |
| `›` | A página seguinte |
| `»` | A última página |

O `…` quer dizer "tem páginas aqui no meio". E o último número — o `250` ali — **sempre**
aparece: é assim que você vê de cara o tamanho da lista.

**Quando você clica**, três coisas acontecem juntas: a tela sobe até o começo da lista,
as linhas velhas ficam apagadinhas por um instante, e as novas entram. É para você não
ficar na dúvida se mudou de página.

> **Se a lista tem 20 linhas ou menos, os botões não aparecem.** Não está quebrado: não
> há outra página para ir.

**Mudar um filtro volta para a página 1.** Se você está na página 7 e escolhe "Rascunho",
não faz sentido continuar na 7 — ela pode nem existir nesse filtro.

---

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

> **Errou alguma coisa?** Abra o pedido e clique em **✏️ Editar**. Ele abre o mesmo
> formulário com tudo já preenchido, e você corrige o que quiser. Só funciona
> **enquanto for rascunho** — depois de enviado, não muda mais.

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

> **A assinatura é conferida duas vezes.** Quem assina está vendo uma **estimativa** — o
> preço de verdade só aparece depois, na cotação. Se a compra fechar bem acima e mudar de
> faixa, ela **volta para cá** com a faixa nova, e o comprador não consegue gerar o pedido
> até alguém assinar de novo.
>
> Sem isso, quem assinasse R$ 1.900 estaria autorizando qualquer valor.

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
| **Situação** | escolha o estado e a lista filtra na hora — não tem botão de confirmar |
| **Abrir** | vai para a tela de convidar |
| **+ Novo pacote de cotação** | abre a janela de criar |

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

> **Abrir a cotação também não manda mensagem.** Abrir só fecha o pacote para mudanças.
> Mandar o convite é um botão próprio, e ele pergunta antes, mostrando a lista de quem vai
> receber.

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

> **Quanto pagamos da última vez?** Embaixo de cada item aparece o preço do último pedido
> daquele material, com a data. É a pergunta número um de quem compra, e agora ela está
> respondida **antes** da escolha, não depois num relatório.

> **O prazo de pagamento vale dinheiro.** Cada fornecedor mostra o **prazo médio** em
> dias: quem parcela em 3x tem prazo médio de 60 dias, quem exige tudo na entrega aparece
> como *à vista*. Escolhendo uma taxa na caixa **Custo do dinheiro**, o sistema mostra
> quanto cada proposta **equivale à vista** — aí dá para comparar de verdade um mais
> barato à vista com um mais caro parcelado.
>
> Ela começa em **Não considerar** de propósito: enquanto a Porto Inc. não disser quanto
> custa o dinheiro dela, o sistema não inventa número nenhum.

| Botão | O que faz |
|---|---|
| **Aceitar todos os melhores preços** | escolhe o mais barato de cada item de uma vez |
| **Salvar escolhas** | guarda sem fechar, para continuar depois |
| **Última chamada** | avisa quem não está na frente que ainda dá para melhorar |
| **Gerar pedidos de compra** | fecha: **um pedido para cada fornecedor escolhido** |

> **O mais barato nem sempre é o melhor.** Você pode escolher item por item — às vezes vale
> pagar um pouco mais por quem entrega no prazo. A aba **Fornecedores**, em Relatórios,
> mostra quem costuma cumprir.

> **O engenheiro também abre esta tela.** Ele **vê** o mapa para conferir se o que foi
> cotado atende à especificação, mas não escolhe vencedor nem fecha a compra: os botões
> de decisão não aparecem para ele. Preço é do comprador; especificação é de quem
> responde por ela.

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

**Passo:** Clique em **Pedidos** → **Abrir**, na linha do pedido.

Lá dentro você vê os itens com preço fechado, para quem vai, e o caminho que a compra
percorreu — a solicitação que pediu e a cotação que escolheu o fornecedor, com os
números clicáveis. Os botões de enviar e de baixar o PDF ficam no topo.

> **Atalho:** o **⋮** na linha da lista faz as mesmas coisas sem precisar abrir.

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

> **Quem pediu fica sabendo.** Quando tudo chega, a solicitação vira **Atendida** sozinha
> e o histórico dela conta. Chegando só parte, ela continua aberta e o histórico diz que
> ainda falta item. Antes, quem abriu o pedido nunca descobria pelo sistema que o material
> tinha chegado — e essa é a queixa número um de quem controla compra por planilha.

> **Depois de atendida, quem pediu confirma: "É o que eu pedi".** São duas conferências
> diferentes — o almoxarife conta sacos, quem pediu é que sabe se o cimento é o certo para
> a laje. Não trava nada; fica no histórico com nome e hora.

> **Serviço não entra no estoque.** Ele é conferido normalmente, mas não vira saldo de
> prateleira: não há o que guardar numa prateleira.

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

> **Errou o valor da nota?** Enquanto ela não gerou parcela, dá para **editar**. Depois
> disso só resta **cancelar** e lançar de novo — e aí o número da nota **fica livre**,
> porque o certo é a nota nova ter o mesmo número da que foi cancelada.

> **O PDF da nota é um ESPELHO.** Ele não é a nota fiscal, não substitui o DANFE e não
> tem valor fiscal. O próprio papel avisa isso, em vermelho, logo abaixo do total.

**O gráfico de fluxo de caixa** mostra quanto sai por mês.
- As setas **‹** e **›** andam um mês
- O campo do meio abre um calendário e pula para qualquer mês
- **Hoje** volta para o mês atual
- Não dá para ir para o futuro: o mês que vem ainda não aconteceu

---

## 10. Relatórios

**Essa tela serve para** responder perguntas sobre o negócio.

**Aqui você consegue:**
- Escolher uma das seis abas
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
| Estoque parado | Que dinheiro está encostado na prateleira? |

> **A aba Economia é a melhor para mostrar numa apresentação.** Ela diz, em dinheiro,
> quanto a disputa entre fornecedores economizou.

**Três números que ninguém costuma ter:**

| Onde | O que responde |
|---|---|
| **Orçamento → Comprometido** | o dinheiro que **já tem dono** mas ainda não saiu: aprovado e em cotação. O "Saldo livre" já desconta ele |
| **Fornecedores → Dependência** | quem passou de **40%** de tudo que a empresa compra. Não é preço: é o risco de não ter para onde correr no dia em que ele subir |
| **Estoque parado** | material encostado há mais de 30, 60, 90, 180 ou 365 dias — você escolhe —, valendo o custo médio. Dinheiro já pago e ainda sem uso |

> **Se a aba Estoque parado aparecer vazia, está certa.** Quer dizer que nada está
> encostado além do prazo escolhido. Ela só acusa material que **tem saldo** e **não sai**
> desde a data.

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

**Entre com `porto@dev.com`** e faça tudo com ela. Ela tem os sete papéis, então você não
precisa sair e entrar de novo no meio da apresentação.

| # | Onde | Faça |
|---|---|---|
| 1 | **Solicitações** | Peça um material — diga que é a obra pedindo |
| 2 | **Aprovações** | Aprove. Mostre que **quem assina depende do valor** |
| 3 | **Cotações** | Monte o pacote e convide dois fornecedores |
| 4 | *aba anônima* | **Copiar link** → cole → responda como se fosse o fornecedor |
| 5 | **Equalização** | Compare, escolha os melhores, **Gerar pedidos** |
| 6 | **Recebimento** | Confira a carga. Receba **só parte** dela, de propósito |
| 7 | **Financeiro** | Lance a nota e gere as parcelas |
| 8 | **Financeiro** | **Dar baixa** numa parcela |
| 9 | **Relatórios** | Feche em **Economia** e **Orçamento** |

**Termine no Início.** Ele resume tudo em números, e cada número volta para a tela de
onde veio.

## Os três momentos que impressionam

Se o tempo for curto, são estes:

1. **O passo 4** — o fornecedor responde **sem senha, sem cadastro, pelo celular**, e não
   vê quem mais foi convidado. É o que hoje é feito por WhatsApp, um a um.
2. **O passo 5** — o mapa comparativo com o melhor preço já marcado, o preço da **última
   compra** ao lado, e a conta de quanto se ganha misturando fornecedores.
3. **O passo 6, recebendo só parte** — o pedido continua aberto sozinho, esperando o
   resto. É o que a planilha nunca soube fazer.

> Pode mexer à vontade. Nada é enviado de verdade, e dá para recarregar os dados do zero.

---

# 4 · Se travar

| Aconteceu | O que fazer |
|---|---|
| A tela não abre | Veja **Status do sistema** |
| Não achei um botão | Aquela conta não faz aquilo. Entre com `porto@dev.com` |
| Apareceu "Muitas requisições" | Espere 1 minuto e tente de novo |
| A senha não entra | Só `porto@dev.com` e `admin@portoinc.com.br` têm senha conhecida (`admin123`). As outras seis foram criadas por você — gere uma senha nova em **Usuários** |
| Ele pediu para trocar a senha | É a regra funcionando: conta criada por outra pessoa troca a senha no primeiro acesso |
| Uma tela está vazia | Leia o que ela diz. Tela vazia sempre explica **por que** está vazia e o que fazer |
| A lista não mostra tudo | Ela mostra 20 por vez. A frase em cima diz o total, e os botões embaixo levam às outras páginas |
| Filtrei e a lista ficou vazia | O filtro volta para a página 1 sozinho. Se continua vazia, é que não há nada naquela situação mesmo |
| Quero recomeçar | Peça para recarregar os dados de teste |

---

# 5 · O que este sistema **não** faz

Vale saber antes que alguém pergunte na reunião:

| Não faz | Por quê |
|---|---|
| Mandar WhatsApp ou e-mail de verdade | Está tudo em **modo de teste**, de propósito. Ligar é uma decisão sua |
| Emitir nota fiscal | Ele **recebe** a nota do fornecedor. Quem emite é quem vende |
| Consultar a SEFAZ | O XML é lido do arquivo. A consulta ao governo é uma integração à parte |
| Pagar sozinho no banco | Ele controla a conta a pagar. O pagamento é feito no banco, e depois marcado aqui |
| Rodar na internet | Hoje roda **na sua máquina**. Colocar no ar é passo de outra etapa |
