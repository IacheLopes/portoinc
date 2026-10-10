<!-- versao: 0.59.0 -->

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
| `washington@portoinc.com.br` | `Porto@2026` | Fundador |
| `andre@portoinc.com.br` | `Porto@2026` | Comprador |
| `bras@portoinc.com.br` | `Porto@2026` | Gestor de obra **e** Solicitante |
| `gilson@portoinc.com.br` | `Porto@2026` | Almoxarife |
| `neilma@portoinc.com.br` | `Porto@2026` | Comprador **e** Solicitante |
| `engenheiro@portoinc.com.br` | `Porto@2026` | Engenheiro |

> **Repare na senha:** as seis de papel usam `Porto@2026`; as duas de cima, `admin123`.

> **Use a `porto@dev.com` para tudo.** Ela enxerga o sistema inteiro, então nenhum botão
> some da sua frente no meio de uma demonstração.

> **Uma tela só existe nela: "Status do sistema".** É a tela de diagnóstico — memória do
> servidor, estado do banco e quais integrações ainda são simuladas. Ela não aparece para
> mais ninguém, nem para o administrador, e não abre nem digitando o endereço.

**Para que servem as seis de papel?** Para **provar permissão**: mostrar que o almoxarife
realmente não consegue aprovar uma compra, que o solicitante não vê o Financeiro. Elas
nascem com a instalação, com a senha da tabela acima.

> Esta parte do guia dizia, até 09/10/2026, que as seis **foram criadas por você** e que
> "só quem criou sabe a senha". Era mentira: a instalação as planta com `Porto@2026`, e
> quem lesse isso achava que não conseguia entrar como o Andre.

Se você trocar uma senha e esquecer, entre em **Usuários**, abra a pessoa e **gere uma
senha nova** — o sistema mostra a senha na tela, uma vez só, para você repassar.

> Há mais cinco contas antigas no banco — `almoxarife@`, `comprador@`, `gestor@`,
> `fundador@` e `solicitante@` —, de antes de os nomes reais entrarem. Quatro delas estão
> marcadas para **trocar a senha no primeiro acesso**. Não use nenhuma: use as de nome, da
> tabela acima.

> **O menu muda conforme quem entrou.** Se um botão não aparece, não está quebrado: é que
> aquela pessoa não faz aquilo.

## Conta nova cria a própria senha

Quando o administrador cria uma conta, ele digita uma senha de entrada e passa para a
pessoa. **Essa senha não abre o sistema.**

No primeiro acesso aparece só uma tela: **"Crie a sua senha"**. Sem menu, sem barra
lateral, e nenhum endereço escapa dela. Depois de criada, o sistema abre inteiro — e quem
criou a conta não sabe a senha de ninguém.

O mesmo vale quando o administrador usa **"Redefinir senha"** em Usuários: a pessoa volta a
criar a dela no acesso seguinte.

## Criar uma função nova

As oito funções que vêm com o sistema descrevem o fluxo de compras da Porto Inc. Se a
empresa precisar de um papel que elas não descrevem — **Encarregado**, **Engenheiro de
segurança**, **Apontador** —, dá para criar.

**Administração → Usuários → aba Funções → + Nova função.** Só o administrador vê essa aba.

Você escolhe o código, o nome e **marca o que a função pode fazer**. Pelo menos uma caixa:
função sem permissão é um nome que não abre tela nenhuma.

> **As oito de fábrica não mudam de nome nem de código** — um é citado em documento, o
> outro na instalação. Mas você pode ajustar **o que elas podem** e reescrever a
> descrição com as palavras da empresa.

> **Apagar só vale para as que você criou**, e só enquanto ninguém está com ela. Função
> que alguém usou um dia fica: sumir levaria junto a resposta de *"quem assinou isto?"*.

> **O sistema não deixa você se trancar para fora.** Se você tentar tirar "Criar e editar
> usuários" de todas as funções, ele recusa — senão ninguém mais criaria conta, e a saída
> seria mexer no banco por fora.

## Mudando da planilha para o sistema

Três coisas entram por planilha, e as três ficam em **Administração**:

| O quê | Onde | Colunas |
|---|---|---|
| Orçamento da obra | Obras → abre a obra → **Importar** | `codigo;descricao;unidade;quantidade;valor_unitario` |
| Materiais | Materiais → **Importar planilha** | `familia;codigo;descricao;unidade;marca;norma;gtin;ponto_pedido;linha_orcamento` |
| Fornecedores | Fornecedores → **Importar planilha** | `cnpj;razao_social;nome_fantasia;email;whatsapp;cidade;uf;familias` |

No Excel: **Salvar como → CSV**. A primeira linha é o cabeçalho.

> **Linha errada não derruba o arquivo.** O sistema importa o que está certo e diz
> **qual linha** tem problema, para você corrigir e mandar de novo. Reimportar o mesmo
> arquivo não duplica nada.

> **A família vai pelo CÓDIGO** (ELE, HID), não pelo nome — e ela precisa existir antes.
> No fornecedor, várias se separam por barra: `ELE/HID`.

**E o dinheiro que a empresa já tem?** Em **Financeiro → Receitas e despesas → Lançar
entrada**, marque *"Este dinheiro a empresa já tinha ao entrar no sistema"*. Ele soma no
saldo e fica de fora do faturamento — a empresa não ganhou esse dinheiro aqui.

**E as dívidas de antes?** Em Receitas e despesas também, como **saída prevista**. Contas
a pagar só recebe parcela que nasceu de nota fiscal — é o que impede a mesma dívida
existir em dois lugares.

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

## 0. Como o menu funciona

**O menu tem seis linhas, e sempre vai ter seis.**

```
  Início
  ---------------
  Compras
  Almoxarifado
  Financeiro
  Relatórios
  Administração
```

**Relatórios** é tela, e fica ali de propósito: perto do dinheiro, mas fora dele — ele
fala de obra, estoque e fornecedor também, e quem o lê nem sempre abre o financeiro.

As outras quatro não são telas: são **portas**. Clicando numa delas você cai numa
tela com cartões, um para cada coisa que mora ali dentro — e cada cartão já mostra o
número do que está esperando.

| Porta | O que tem dentro |
|---|---|
| **Compras** | Solicitações · Aprovações · Cotações · Pedidos |
| **Almoxarifado** | Recebimento · Estoque · Locação |
| **Financeiro** | Contas a pagar · Notas fiscais · Receitas e despesas |
| **Administração** | Famílias · Materiais · Fornecedores · Obras · Alçadas · Usuários · Avisos |

> **Por que mudou.** O menu listava as 14 telas, e para quem administra isso eram 18
> linhas. O sistema vai crescer, e cada tela nova era mais uma linha. Agora tela nova
> vira cartão dentro de uma porta que já existe, e o menu **não cresce**.

> **Você vê só o que pode abrir.** O almoxarife não enxerga a porta do Financeiro. Se
> uma porta não tem nada que você possa ver, ela nem aparece.

**Atalho:** a tela de **Início** também leva às quatro portas, no bloco **Ir para** lá
embaixo. E os números do topo do Início levam direto à tela, sem passar pela porta.

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

**Passo:** **Compras** → **Solicitações** → **+ Nova solicitação** (azul, no canto direito, ao
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

**Passo:** **Compras** → **Aprovações** → **Analisar** → escolha **Aprovar**, **Devolver** ou
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

**Passo:** **Compras** → **Pedidos** → **Abrir**, na linha do pedido.

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

**Passo:** **Almoxarifado** → **Recebimento** → **Conferir** → marque as quantidades → preencha a
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

**Passo:** **Almoxarifado** → **Estoque** → ache o material → **Retirar** → diga quanto e para quem.

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

**Passo:** **Almoxarifado** → **Locação** → **Devolver** quando o equipamento voltar.

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

**Passo:** **Financeiro** → **Contas a pagar** → role até **Parcelas** → **Dar baixa** na conta que
foi paga → informe a data e a forma.

**Para lançar uma nota:** **Financeiro** → **Notas fiscais** → **Lançar nota** (ou
**Importar XML**, que lê tudo sozinho) → **Gerar parcelas**.

> **Errou o valor da nota?** Enquanto ela não gerou parcela, dá para **editar**. Depois
> disso só resta **cancelar** e lançar de novo — e aí o número da nota **fica livre**,
> porque o certo é a nota nova ter o mesmo número da que foi cancelada.

> **O PDF da nota é um ESPELHO.** Ele não é a nota fiscal, não substitui o DANFE e não
> tem valor fiscal. O próprio papel avisa isso, em vermelho, logo abaixo do total.

**O gráfico de fluxo de caixa** mostra, mês a mês, quanto **sai** e quanto **entra** — a entrada vem das receitas lançadas em **Receitas e despesas**.
- As setas **‹** e **›** andam um mês
- O campo do meio abre um calendário e pula para qualquer mês
- **Hoje** volta para o mês atual
- Não dá para ir para o futuro: o mês que vem ainda não aconteceu

---

## 9.1. Receitas e despesas

**Essa tela serve para** cadastrar o dinheiro que entra e o gasto que **não vem de
compra**.

**Aqui você consegue:**
- Ver quanto a empresa tem: o **saldo**
- Lançar uma entrada (medição paga, aporte dos sócios)
- Lançar uma saída avulsa (combustível, aluguel, taxa, diária de máquina)
- Marcar que o dinheiro andou
- Cancelar um lançamento, com motivo

**Passo:** **Financeiro** → **Receitas e despesas** → **Lançar entrada** (ou **Lançar saída**)
→ preencha descrição, valor e data → **Lançar**.

> **O campo Obra pode ficar vazio.** O aporte dos sócios e o aluguel do escritório são da
> **empresa**, não de uma obra. Deixe em "Da empresa".

**Os quatro cartões de cima:**

| Cartão | Em uma linha |
|---|---|
| **Saldo** | o que a empresa tem agora |
| **Entrou** | o que já caiu |
| **Saiu** | compras pagas + despesas avulsas |
| **Se tudo acontecer** | como termina se cada previsão virar realidade |

**Lançar algo que ainda vai acontecer:** desmarque **O dinheiro já entrou**. Ele fica
como *A receber* (ou *A pagar*) e **não entra no saldo** — aparece só no cartão "se tudo
acontecer". Quando o dinheiro andar, abra o menu **⋮** da linha e clique em **Registrar
que entrou**.

> **Compra de material NÃO se lança aqui.** Ela nasce da nota fiscal, em **Financeiro**.
> Lançar nos dois lugares daria duas dívidas para a mesma compra.

> **Cancelar não apaga.** O lançamento fica na lista, riscado, com o motivo escrito. É de
> propósito: quem olhar o caixa no ano que vem precisa ver que aquilo existiu.

**Para ver quem mexeu:** menu **⋮** da linha → **Ver histórico**. Mostra cada correção com
a data, quem fez e o que mudou — *"Valor: R$ 96.500,00 → R$ 99.999,00"*.

> **Gastou mais do que entrou?** O saldo aparece com o menos na frente do R$ —
> *"-R$ 19.701.951,70"* —, na tela e no arquivo baixado. Antes o arquivo escrevia
> *"R$ -19.701.951,70"*, com o sinal no meio.

> **As frases falam certo quando é um só.** "Falta 1 dia", "1 pedido", "1 permissão" —
> e não "1 dia(s)". Eram 26 frases com esse remendo, doze delas dentro de PDF.

> **Errou e quer apagar um campo?** Limpe o campo e salve. Antes isso não fazia nada;
> agora apaga de verdade.

**Os três gráficos:**

| Gráfico | Responde |
|---|---|
| **O que vem pela frente** | tenho dinheiro no dia 20? — seis semanas, com o saldo caminhando embaixo de cada uma |
| **De onde vem o dinheiro** | que parte entrou de medição, que parte de aporte |
| **Para onde vai o que não é compra** | quanto do gasto é frota, quanto é canteiro |

> **Se o caixa furar em alguma semana, um aviso amarelo aparece em cima do gráfico.** Não
> precisa caçar número vermelho.

As duas roscas usam a **categoria** que você digita ao lançar. Se deixar em branco, cai em
"Sem categoria" — não some, mas também não ensina nada.

> **Se muito gasto ficar sem categoria, a tela avisa** embaixo dos gráficos, com o valor.
> Dá para arrumar depois: menu **⋮** da linha → **Corrigir** → preencha a Categoria.

**Para baixar:** botão **Baixar lançamentos**, PDF ou Word. Ele leva **só o que o filtro
está mostrando**.

**Quem só enxerga não mexe.** O fundador vê a lista, o saldo e os gráficos, e não tem os
botões de lançar. Quem não é do financeiro nem abre a tela.

---

## 10. Relatórios

**Essa tela serve para** responder perguntas sobre o negócio.

**Aqui você consegue:**
- Escolher uma das seis abas
- Filtrar por obra e por período
- Baixar em **PDF ou Word**

**Passo:** Clique em **Relatórios**, na barra → escolha a aba → filtre → **Baixar**.

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

## 11. Administração

**Essa tela serve para** cadastrar as coisas que o resto do sistema usa, e dizer quem
tem acesso a elas.

**Aqui você consegue:** entrar nos cinco cadastros, nos usuários e nos avisos.

> **Chamava-se Cadastros.** Virou Administração quando Usuários e Avisos passaram a
> morar junto — eles não são cadastro, e o nome tinha de caber nos três.

**Passo:** **Administração** → escolha um dos cinco cadastros, na ordem dos números.

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

**Passo:** **Administração** → **Usuários** → **+ Novo usuário** → preencha → marque as funções.

> Uma pessoa pode fazer **mais de uma coisa**. A Neilma compra e paga.

---

## 13. Comunicação

**Essa tela serve para** ver as mensagens que o sistema mandou.

**Aqui você consegue:**
- Ver se o WhatsApp e o e-mail estão ligados
- Ver tudo que já foi enviado

**Passo:** **Administração** → **Comunicação** → escolha **WhatsApp** ou **E-mail** → veja o histórico.

> ⚠️ **Está tudo em modo de teste.** Nenhuma mensagem sai para fornecedor de verdade.

---

## 14. Status do sistema

**Essa tela serve para** conferir se está tudo funcionando.

**Aqui você consegue:** ver se o sistema está no ar.

**Passo:** **Administração** → **Status do sistema** → se estiver tudo verde, está tudo certo.

---

## Extra: a tela do fornecedor

**Essa tela serve para** o fornecedor responder o preço.

Ela **não fica no menu**, porque não é para quem trabalha na Porto Inc. O fornecedor
recebe um link e abre sem senha.

**Passo para mostrar:** **Compras** → **Cotações** → abra uma → **Copiar link** → cole numa aba anônima.

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
| A senha não entra | São **duas senhas**: `admin123` para `porto@dev.com` e `admin@portoinc.com.br`, e `Porto@2026` para as seis de nome. Trocou e esqueceu? Gere uma nova em **Usuários** |
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
| Mandar WhatsApp ou e-mail de verdade | O **envio está restrito**, de propósito. Ligar é uma decisão sua |
| Emitir nota fiscal | Ele **recebe** a nota do fornecedor. Quem emite é quem vende |
| Consultar a SEFAZ | O XML é lido do arquivo. A consulta ao governo é uma integração à parte |
| Pagar sozinho no banco | Ele controla a conta a pagar. O pagamento é feito no banco, e depois marcado aqui |
| Rodar na internet | Hoje roda **na sua máquina**. Colocar no ar é passo de outra etapa |
