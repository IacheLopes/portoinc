<!-- versao: 0.20.2 -->

# 1. Antes de começar

## O que é este sistema

O sistema da **Porto Inc.** organiza tudo que envolve **comprar material para a obra** e **controlar o almoxarifado**.

Hoje esse trabalho é feito com planilhas, grupos de WhatsApp e papel. O problema disso é que a informação fica espalhada: ninguém sabe ao certo o que foi pedido, quanto custou da última vez, ou se o material realmente chegou.

O sistema resolve isso colocando **tudo no mesmo lugar**, desde o momento em que alguém pede um material até o momento em que a nota fiscal vai para o financeiro.

## Quem usa o sistema

O sistema tem **8 funções**. Uma pessoa pode ter mais de uma função ao mesmo tempo — por exemplo, alguém pode ser *Comprador* e *Solicitante*.

| Função | O que essa pessoa faz |
|---|---|
| **Solicitante** | Pede material e confere se o que chegou é o que foi pedido |
| **Gestor de obra** | Acompanha a obra e ajuda a aprovar as compras |
| **Comprador** | Pede preço aos fornecedores, negocia e fecha o pedido |
| **Engenheiro** | É consultado quando o material exige conhecimento técnico |
| **Fundador** | Aprova compras de valor mais alto |
| **Almoxarife** | Recebe o material, confere e controla o estoque |
| **Fornecedor** | Empresa de fora que responde os pedidos de preço |
| **Administrador** | Cadastra usuários e configura o sistema |

## Como ler este manual

> Este manual cresce junto com o sistema. A cada etapa construída, ele ganha um capítulo novo.
> Nada aqui é promessa: se está descrito, está funcionando na sua máquina.

O projeto tem **12 etapas**, e este manual cobre todas: da **0** à **12**.

> A partir da versão 0.17.0 ele cobre também o **envio por e-mail** e o **arquivamento da
> nota fiscal** — duas coisas que estavam nos documentos de origem e faltavam.

---

# 2. Como o sistema é montado

## As três peças

Pense no sistema como um restaurante:

| Peça | No restaurante seria... | No sistema é... |
|---|---|---|
| **Interface** | O salão, onde você senta e pede | As telas que você vê no navegador |
| **API** | A cozinha, que prepara o pedido | O programa que faz as contas e aplica as regras |
| **Banco de dados** | A despensa, onde fica guardado | Onde ficam salvos os dados |

Você conversa apenas com o **salão** (as telas). Ele conversa com a **cozinha**, que busca coisas na **despensa**. Você nunca precisa entrar na cozinha.

## Por que Docker

Cada uma das três peças roda dentro de uma **caixa isolada** chamada *container*, criada pelo **Docker**.

A vantagem prática: o sistema funciona **igualzinho** no seu computador, no computador do colega e no servidor da empresa. Acaba o clássico *"na minha máquina funcionava"*.

Cada caixa tem um limite proposital de **1 GB de memória e 1 núcleo de processador** — exatamente o que o servidor real terá. Assim, se algo for pesado demais, descobrimos agora e não na entrega.

---

# 3. Ligando o sistema

## O que instalar antes

Você só precisa do **Docker Desktop** instalado e aberto. Nada mais.

## Ligando

Abra o terminal na pasta do projeto e digite:

```bash
docker compose up -d
```

O que acontece:

1. O **banco de dados** sobe primeiro e espera ficar pronto
2. A **API** sobe, cria as tabelas automaticamente e cadastra funções, permissões e as contas de teste
3. A **interface** sobe por último

Na primeira vez demora alguns minutos. Nas próximas, leva poucos segundos.

## Conferindo se deu certo

```bash
docker compose ps
```

Você deve ver as três caixas com a palavra **Up**.

## Abrindo o sistema

No navegador, acesse:

```
http://localhost:5173
```

> **O que significa esse endereço?**
> `localhost` quer dizer "este computador". `5173` é a porta — como se fosse o número da sala onde o sistema está atendendo.

## Desligando

```bash
docker compose stop
```

Isso **pausa** o sistema, mas mantém todos os dados salvos. Para ligar de novo, use `docker compose start`.

> **Cuidado:** o comando `docker compose down -v` apaga o banco de dados inteiro. Só use se quiser mesmo começar do zero.

---

# 4. Entrando no sistema

## A tela de entrada

Ao abrir o endereço, a primeira coisa que aparece é a tela de entrada, pedindo **e-mail** e **senha**.

O cursor já começa no campo de e-mail — você pode digitar direto, sem clicar. Use **Tab** para pular para a senha e **Enter** para entrar.

## Contas para teste

Enquanto o sistema está em desenvolvimento, existem contas prontas com os nomes das pessoas da reunião. Todas usam a mesma senha: **Porto@2026**

| Pessoa | E-mail | Função no sistema |
|---|---|---|
| Administrador | admin@portoinc.com.br | Administrador |
| Washington | washington@portoinc.com.br | Fundador |
| Andre | andre@portoinc.com.br | Comprador |
| Bras | bras@portoinc.com.br | Gestor de obra + Solicitante |
| Gilson | gilson@portoinc.com.br | Almoxarife |
| Neilma | neilma@portoinc.com.br | Comprador + Solicitante |
| Engenheiro | engenheiro@portoinc.com.br | Engenheiro |

> **Experimente:** entre como **Gilson** e depois como **Administrador**. Você vai ver que o menu da esquerda muda completamente. É assim que o sistema respeita o que cada pessoa faz.

> **Importante:** essas contas **só existem em ambiente de teste**. Na instalação real da Porto Inc. elas não são criadas, e o administrador é obrigado a definir a própria senha no primeiro acesso.

## Quando a senha está errada

O sistema responde sempre a mesma frase: *"E-mail ou senha incorretos."*

Isso é proposital. Se ele dissesse *"este e-mail não existe"*, estaria entregando a um invasor a lista de quem trabalha na empresa.

## Proteção contra tentativas repetidas

Depois de **10 tentativas em 5 minutos**, o sistema bloqueia novas tentativas por um tempo. Isso impede que alguém fique testando senhas em sequência.

Se você bater nesse limite testando, é só esperar alguns minutos.

## Você continua conectado

Ao fechar a aba e voltar depois, o sistema reconhece você e não pede a senha de novo. Isso vale por **7 dias** sem uso.

O funcionamento por trás é assim:

- Um **crachá** identifica você e vale **15 minutos**
- Uma **chave guardada no navegador** renova o crachá automaticamente, sem você perceber
- Se o crachá vazar, o estrago dura no máximo 15 minutos

---

# 5. Conhecendo a tela

## A barra de cima

Fica sempre visível, mesmo rolando a página:

| Onde | O que é |
|---|---|
| Esquerda | A marca **Porto Inc.** |
| Direita | Seu nome, quantas funções você tem, e o botão **Sair** |
| Celular | Aparece o botão **☰** para abrir o menu |

## O menu da esquerda

O menu é **dividido em quatro blocos**, na ordem em que o trabalho acontece:

| Bloco | O que tem dentro |
|---|---|
| **Compras** | Solicitações, Aprovações, Cotações, Pedidos |
| **Almoxarifado** | Recebimento, Estoque, Locação |
| **Gestão** | Financeiro, Relatórios |
| **Administração** | Cadastros, Usuários, WhatsApp, Status do sistema |

O **Início** fica solto no alto, antes dos blocos.

Aqui está o detalhe mais importante do sistema: **o menu mostra apenas o que você pode fazer**.

> E o bloco inteiro some quando você não tem nada dentro dele. O Gilson (almoxarife) não vê o título "Gestão" — não sobra um rótulo vazio na tela.

O menu **fica parado** quando você rola a página: só o conteúdo se move. Assim o item que você quer clicar está sempre no mesmo lugar, mesmo numa tela comprida como o Financeiro.

Em telas de computador o menu inteiro cabe sem rolar. Em janela baixa — um notebook pequeno, ou o navegador com muitas abas e barras —, o menu ganha uma **barra de rolagem fina, no tom do sistema**, em vez da barra cinza do Windows.

- O **Gilson** (almoxarife) vê Início, Solicitações, Recebimento, Estoque, Locação e Cadastros
- A **Neilma** (compradora) vê também Cotações, Pedidos, Financeiro e Relatórios
- O **Administrador** vê tudo, incluindo Usuários, WhatsApp e Status do sistema

A tela onde você está fica marcada de duas formas: cor diferente **e** uma barra azul na lateral. Nunca apenas pela cor — quem não distingue cores também precisa se localizar.

## No celular

O menu vira uma gaveta. Toque em **☰** para abrir e toque fora dele para fechar. Todo o resto funciona igual.

## A barra de filtros

Toda tela que lista alguma coisa tem a mesma barra no alto: os **filtros à esquerda**, com o rótulo em cima de cada um, e os **botões à direita**.

É sempre igual, de propósito. Quem aprendeu a filtrar em Materiais sabe filtrar em Locação sem reaprender.

- O campo de **Buscar** aceita **Enter**: não precisa clicar no botão
- Todo controle tem **44 pixels de altura**, que é o tamanho mínimo confortável para o dedo no celular
- Os rótulos ficam **acima** dos campos, nunca só dentro deles: texto de dentro some quando você começa a digitar

## Quando você passa o mouse

Tudo que é clicável **reage** ao mouse — botão, link, aba, linha de legenda do gráfico, fatia da rosca. Se nada acontecer ao passar por cima, aquilo não é clicável.

O cursor também avisa qual é o caso:

| Cursor | O que significa |
|---|---|
| **Mão** | Leva a algum lugar ou faz alguma coisa |
| **Interrogação** | Explica um número. É o caso dos cartões de indicador: eles não levam a lugar nenhum, só mostram de onde o valor saiu |
| **Seta normal** | Não é clicável |

Quem navega **pelo teclado** vê a mesma coisa de outro jeito: o item em foco recebe um contorno azul. Nunca só cor — contorno, que aparece em qualquer tela e para quem não distingue cores.

## A tela de Início

Mostra uma saudação pelo seu nome, quantas permissões você tem, e um **cartão para cada coisa que você consegue fazer**.

Os cartões são exatamente os mesmos itens do menu da esquerda — só que com uma frase explicando para que serve cada um. Se um módulo aparece no menu, aparece aqui; se some do menu porque você não tem permissão, some aqui também.

> Os dois saem da **mesma lista** dentro do sistema. Isso não é detalhe técnico à toa: antes eram listas separadas, e a tela de Início continuou anunciando que faltavam os relatórios depois que eles já estavam prontos.

No alto fica o aviso de andamento — hoje **"Módulo 1 completo — 12 etapas entregues"** — com o que já existe e o lembrete de que as integrações ainda rodam em modo de teste. Essa frase se monta sozinha: quando uma etapa nova entrar na lista, o texto volta a contar "x de y" sem ninguém reescrever nada.

---

# 6. Usuários e funções

> Esta tela só aparece para quem tem a função de **Administrador**.

Acesse por **Usuários** no menu da esquerda.

## O que a tela mostra

Uma lista de todas as pessoas com acesso, contendo:

| Coluna | O que significa |
|---|---|
| **Nome** | Como a pessoa aparece no sistema |
| **E-mail** | É com ele que ela entra |
| **Funções** | Pode ter mais de uma. Aparecem como etiquetas |
| **Último acesso** | Quando entrou pela última vez, ou "Nunca entrou" |
| **Situação** | Ativo ou Desativado |

## Cadastrar uma pessoa nova

1. Clique em **+ Novo usuário**
2. Preencha nome e e-mail
3. O telefone é opcional — será usado para os avisos por WhatsApp na Etapa 10
4. Defina uma **senha provisória** (mínimo 8 caracteres, com letra e número)
5. Marque **uma ou mais funções**
6. Clique em **Cadastrar usuário**

A pessoa será obrigada a criar a própria senha no primeiro acesso. Assim a senha provisória, que você digitou e possivelmente mandou por mensagem, deixa de valer.

## Como as funções somam

Este é o pedido da reunião *"cada usuário pode ter mais de uma função"*, e funciona por soma:

> A **Neilma** é Comprador **e** Solicitante.
> Comprador libera 14 ações. Solicitante libera 4.
> Ela fica com a **união das duas**, sem nada se anular.

## Desativar alguém

Use o botão **Desativar** na linha da pessoa. Isso:

- impede novas entradas no sistema
- **derruba na hora** as sessões que ela já tinha abertas
- mantém todo o histórico dela preservado

Preferimos desativar a apagar. Apagar alguém apagaria junto o rastro do que essa pessoa pediu e aprovou — e esse histórico é justamente o valor do sistema.

> Você não consegue desativar a si mesmo. É uma trava para o sistema nunca ficar sem administrador.

## O quadro de funções

Embaixo da lista há um cartão para cada uma das 8 funções, mostrando o que ela faz, quantas permissões libera e quantas pessoas a possuem.

Repare que **Fornecedor tem 0 permissões**. Não é erro: o fornecedor nunca entra pelo login. Ele responde a cotação por um link com prazo de validade, que chega por e-mail ou WhatsApp.

---

# 7. Trocar minha senha

No rodapé do menu, clique em **Trocar minha senha**.

Você precisa informar a senha atual, a nova, e repetir a nova. Se as duas últimas não baterem, o sistema avisa na hora, antes de você clicar no botão.

## Regra da senha

Mínimo de **8 caracteres**, com pelo menos **uma letra** e **um número**.

> **Por que não exigimos símbolos?** Porque senha longa protege mais que senha curta cheia de "@" e "#". `obradoportinho2026` é mais segura e mais fácil de lembrar que `P@t0!`.

## O que acontece depois

Ao trocar a senha, **todas as suas sessões caem**, inclusive a atual. Você volta para a tela de entrada e usa a senha nova.

Parece incômodo, mas é proteção: se alguém tinha entrado com a sua senha antiga, perde o acesso no mesmo instante.

---

# 8. Cadastros: por onde começar

Acesse **Cadastros** no menu da esquerda.

Esta é a base do sistema. Sem ela, nenhuma das telas de trabalho funciona — não dá para pedir um material que não existe no catálogo, nem cotar com um fornecedor que não está cadastrado.

## A ordem importa

Os cartões da tela estão numerados de propósito. Cada um depende do anterior:

| Ordem | Cadastro | Por que vem nesta posição |
|---|---|---|
| **1** | Famílias | Material precisa de família. Fornecedor precisa de família. Nada anda sem ela |
| **2** | Materiais e serviços | Depende da família |
| **3** | Fornecedores | Precisa das famílias para dizer o que cada um vende |
| **4** | Obras | Independente, mas o orçamento dela usa os códigos das linhas |
| **5** | Limites de alçada | Usa as funções do sistema, que já existem |

> Se você tentar cadastrar um material antes de criar a família, vai travar no primeiro campo. Seguindo a ordem, isso não acontece.

---

# 9. Famílias de material

A família é um **agrupamento por tipo**: elétrica, hidráulica, cimento, EPI.

## Por que ela existe

Esta é a pergunta que a família responde:

> *"O comprador montou um pacote de cotação de material elétrico. Para quem mandar?"*

O sistema procura os fornecedores ligados à família **Material elétrico** e convida só eles. Sem família, seria preciso escolher fornecedor a fornecedor, toda vez.

É exatamente o que o fluxo da Porto Inc. descreve: *"BID de materiais elétricos, somente fornecedores que fornecem materiais elétricos recebem o e-mail"*.

## Cadastrando

1. Clique em **+ Nova família**
2. **Código**: sigla curta, como `ELE`. Vira maiúscula sozinha
3. **Nome**: como aparece nas telas, como "Material elétrico"
4. **Descrição**: ajuda quem for cadastrar material a escolher a família certa

Cada cartão mostra quantos itens e quantos fornecedores estão ligados àquela família.

---

# 10. Materiais e serviços

O catálogo da empresa. Acesse por **Cadastros → Materiais e serviços**.

## Material ou serviço?

A diferença muda o comportamento do sistema:

| | Material | Serviço |
|---|---|---|
| Tem código de barras | Sim | Não |
| Entra no estoque | Sim | Não |
| Tem ponto de pedido | Sim | Não |
| Exemplo | Cimento, cabo, tinta | Mão de obra, instalação, locação |

Ao escolher **Serviço**, os campos que não fazem sentido somem da tela.

## Os três códigos — e por que são separados

A anotação da reunião pedia para *"linkar qual o material ou serviço é NBR (id de cada item)"*. Isso misturava três coisas diferentes, então o sistema tem **três campos separados**:

| Campo | O que é | Exemplo |
|---|---|---|
| **Código Porto** | O código interno, o mesmo das planilhas da empresa | `00119` |
| **Código de barras** | O GTIN impresso na embalagem | `7899888400575` |
| **Norma técnica** | A norma ABNT que o item deve cumprir | `NBR 16697` |

> Se a empresa quiser depois que só um deles seja usado, nada se perde: os três já estão lá.

## O sistema confere o código de barras

Ao digitar o código de barras, o sistema **calcula o dígito verificador**. Se você errar um número, ele avisa na hora.

Isso importa no dia a dia: um código errado no cadastro vira material bipado que "não existe" na hora do recebimento, com o caminhão parado no portão.

Ele também avisa se aquele código já está em outro item, evitando cadastro duplicado.

## Unidade de medida

Campo obrigatório, escolhido de uma lista (`SC`, `M3`, `KG`, `UN`...).

É obrigatório porque foi pedido na reunião e porque evita o erro clássico: alguém pede "10 cimento" e chegam 10 sacos quando eram 10 paletes.

## Ponto de pedido

A quantidade mínima que deve existir no estoque.

Quando o saldo cair abaixo dela, o sistema avisa que é hora de comprar — e, na Etapa 8, vai abrir a solicitação sozinho.

## Linha de orçamento sugerida

Quando alguém pedir esse material, a linha do orçamento já vem preenchida — e pode ser trocada na hora.

> **Por que só o código, e não a linha em si?**
> Cimento é usado em várias obras, e cada obra tem seu próprio orçamento. Guardamos apenas o **código da linha** (`03.01.001`) e, na solicitação, o sistema procura essa linha dentro da obra escolhida.

## Buscando

A busca procura ao mesmo tempo em descrição, código Porto, código de barras e marca. Também dá para filtrar por família e por tipo.

---

# 11. Fornecedores

Acesse por **Cadastros → Fornecedores**.

## O campo mais importante: as famílias

No fim do formulário há uma lista de famílias com caixas para marcar. **Marque tudo que o fornecedor realmente vende.**

Um fornecedor sem nenhuma família marcada **nunca será convidado para uma cotação**. O sistema avisa isso no cartão dele, com um selo amarelo.

Você também pode filtrar a lista por "Atende Material elétrico" para ver, na hora, quem seria chamado num pacote de elétrica.

## O CNPJ é conferido

O sistema calcula os dígitos verificadores do CNPJ. Se estiver errado, ele recusa.

> **Por que isso importa:** um CNPJ errado passa despercebido por semanas. O problema só aparece quando a nota fiscal chega e não bate com o cadastro — aí já tem material recebido e pagamento travado.

O CNPJ é exibido formatado (`19.131.243/0001-97`), mas guardado só com números, o que permite buscar de qualquer jeito.

## WhatsApp

Informe com **DDI e DDD**, só números: `5511988887777`.

É por esse número que a cotação será enviada quando a integração de WhatsApp for ligada, na Etapa 10.

---

# 12. Obras e orçamento

Acesse por **Cadastros → Obras**.

## Criando uma obra

Preencha código, nome, cliente e cidade. Ao salvar, o sistema **cria o almoxarifado da obra automaticamente**.

> **Por que cada obra tem o próprio almoxarifado?**
> Para que o material de uma obra não se misture com o de outra. Sem isso, o saldo do sistema nunca bate com o que está no canteiro. Também permite, mais à frente, transferir material de uma obra para outra em vez de comprar de novo.

## A tela da obra

Clique em **Abrir** na lista. Você verá:

- **Orçamento previsto** — a soma de todas as linhas
- **Almoxarifados** — os locais de estoque daquela obra
- **Realizado** — ainda vazio; passa a mostrar o gasto real a partir da Etapa 9
- A **tabela do orçamento**, com o total no rodapé

## Por que o orçamento é obrigatório

Toda solicitação de compra aponta para uma linha do orçamento. É isso que permite responder, no fim da obra:

- Quanto foi gasto em cimento?
- A fundação estourou o previsto?
- Qual obra está mais cara que o planejado?

Sem orçamento cadastrado, o sistema registra as compras, mas não consegue comparar com o previsto.

## Importando a planilha que a empresa já usa

Digitar 200 linhas à mão não é razoável. Por isso existe o botão **📥 Importar planilha**.

### Passo a passo

1. No Excel, deixe as colunas nesta ordem:

   | codigo | descricao | unidade | quantidade | valor_unitario |
   |---|---|---|---|---|
   | 03.01.001 | Cimento Portland | SC | 1200 | 34,00 |

2. Vá em **Arquivo → Salvar como → CSV**
3. Na tela da obra, clique em **📥 Importar planilha**
4. Escolha o arquivo (ou cole o conteúdo)
5. Clique em **Importar**

### O que o sistema aceita sem reclamar

- Separador **vírgula ou ponto e vírgula** — ele descobre sozinho
- Valores no **formato brasileiro**: `1.250,00` vira R$ 1.250,00
- Acentos e cedilha

### O que acontece com linhas com defeito

O sistema **não desiste do arquivo inteiro** por causa de uma linha ruim. Ele importa o que está certo e lista o que deu problema, com o número da linha:

```
Linha 5: código, descrição ou unidade em branco.
Linha 6: quantidade ou valor não é um número válido.
Linha 7: código 02.01.001 repetido no arquivo.
```

Aí você corrige só aquelas linhas na planilha e importa de novo.

### Reimportar não duplica

Linhas cujo código já existe na obra são **ignoradas**. Isso significa que você pode importar a planilha corrigida quantas vezes quiser, sem medo.

---

# 13. Limites de alçada

Acesse por **Cadastros → Limites de alçada**.

Esta tela responde: **quem precisa assinar uma compra de R$ X?**

## Por que ela existe

O fluxo enviado pela Porto Inc. dizia apenas: *"sendo valores mais elevados **A definir limite**, necessário a aprovação do fundador"*. O limite nunca foi definido.

Em vez de escolher um número e escondê-lo no código, o limite virou **configuração de tela**. A empresa muda quando quiser, sem programador.

## O simulador

É a parte mais útil da tela. Digite um valor e clique em **Simular**:

| Valor | Resposta do sistema |
|---|---|
| R$ 800 | Basta a assinatura de uma destas funções: Gestor de obra |
| R$ 7.500 | Precisa da assinatura de TODAS estas funções: Gestor de obra, Engenheiro |
| R$ 42.000 | Basta a assinatura de uma destas funções: Fundador |

Há também botões de atalho com valores comuns.

> Use o simulador antes de mudar qualquer faixa. Ele mostra o efeito da regra em segundos — muito mais rápido que tentar entender a tabela lendo.

## As faixas atuais

| Faixa | Quem aprova | Regra |
|---|---|---|
| Até R$ 2.000 | Gestor de obra | Qualquer uma |
| R$ 2.000,01 a R$ 15.000 | Gestor de obra **+** Engenheiro | **Todas assinam** |
| Acima de R$ 15.000 | Fundador | Qualquer uma |

**Estes valores são um ponto de partida.** Mude conforme a realidade da empresa.

## Qualquer uma × Todas assinam

| Regra | O que significa |
|---|---|
| **Qualquer uma** | Uma assinatura resolve. Se o gestor aprovar, está aprovado |
| **Todas assinam** | Todas as funções marcadas precisam aprovar. Mais lento, mais seguro |

## O sistema avisa se a configuração tiver furo

Ao abrir a tela, o sistema confere as faixas e avisa se encontrar problema:

- **Vão entre faixas** — ex.: uma termina em R$ 2.000 e a próxima começa em R$ 3.000. Compras de R$ 2.500 ficariam sem aprovador
- **Sobreposição** — duas faixas cobrindo o mesmo valor
- **Sem teto no fim** — a última faixa precisa ficar sem valor máximo, ou compras muito altas não seriam aprovadas

Esse aviso aparece em destaque no topo. Ele não impede de salvar — só avisa, porque a empresa pode ter um motivo.

## Criando uma faixa nova

1. Clique em **+ Nova faixa**
2. Dê um nome, como "Compras de valor médio"
3. Defina o valor mínimo e o máximo
4. Se for a faixa mais alta, marque **"Esta é a faixa mais alta (sem valor máximo)"**
5. Marque as funções que aprovam
6. Decide se **todas** precisam assinar ou se **qualquer uma** resolve

---

# 14. Abrir uma solicitação de compra

Esta é a primeira tela de trabalho do dia a dia. Acesse por **Solicitações** no menu.

## Quem pode abrir

Qualquer pessoa com a função **Solicitante** — e também gestor de obra, engenheiro, comprador e almoxarife, porque todos eles acumulam essa permissão.

> É o que o fluxo da Porto Inc. determina: *"qualquer um com uma demanda pode abrir uma solicitação"*.

## Passo a passo

1. Clique em **+ Nova solicitação**
2. Escolha a **obra** — isso carrega o orçamento dela
3. Informe **até quando** você precisa do material
4. Escreva a **justificativa** (ex.: *"Concretagem da laje do 3º pavimento"*)

> A justificativa é opcional, mas quem a preenche costuma ter a aprovação muito mais rápida. O aprovador não precisa ligar para perguntar.

## Adicionando itens

Para cada item:

1. Escolha no **catálogo** — a lista mostra código, descrição e unidade
2. Digite a **quantidade**
3. Clique em **+ Adicionar item à solicitação**

### O que o sistema preenche sozinho

| Campo | De onde vem |
|---|---|
| **Unidade de medida** | Do cadastro do item. Você não digita |
| **Linha do orçamento** | Da linha sugerida no cadastro do material |

São dois campos a menos para preencher em cada linha. Você pode trocar a linha do orçamento se aquele pedido for para outra parte da obra.

### Campos que ajudam o comprador

| Campo | Para que serve |
|---|---|
| **Valor unitário estimado** | Calcula quem vai precisar aprovar. Sem ele, o sistema considera zero |
| **Detalhes do pedido** | Marca, dimensão, cor ou condição de entrega |
| **Especificação técnica** | Descrição completa para o comprador saber o que cotar |

## Item nunca comprado antes

Se a empresa **nunca pediu aquele item**, o sistema marca automaticamente como **Primeira compra** e passa a **exigir a especificação técnica**.

Sem ela, o envio é bloqueado com esta mensagem:

> *"Cimento Portland nunca foi comprado antes. Descreva a especificação técnica (marca, qualidade, dimensões) para o comprador saber o que cotar."*

Isso atende ao pedido da reunião: *"se for algo que nunca pediram, deve ser um pedido qualitativo e quantitativo"*.

## Salvar como rascunho

O botão diz **Salvar como rascunho** de propósito: nada é enviado para aprovação ainda.

Você pode montar a solicitação com calma, sair do sistema, voltar depois e só então enviar.

## Pelo celular

A tela funciona no navegador do celular. O menu vira gaveta e os campos ficam um embaixo do outro — dá para abrir a solicitação de dentro do canteiro.

---

# 15. Acompanhar uma solicitação

## A lista

**Solicitações** mostra o que você pode ver. E isso muda conforme a pessoa:

| Quem | O que enxerga |
|---|---|
| Solicitante, almoxarife, engenheiro | **Apenas as próprias solicitações** |
| Comprador, gestor de obra, fundador, administrador | **Todas da empresa** |

A frase no alto da tela diz qual dos dois casos é o seu, para ninguém achar que sumiu informação.

> Este é o pedido literal da ata: *"cada usuário deve ver o que ele solicitou"*.

Quem enxerga todas ganha também a caixa **Só as minhas**, para filtrar rapidamente.

## As situações

| Situação | O que significa |
|---|---|
| **Rascunho** | Sendo montada. Só o autor vê e pode mudar |
| **Aguardando aprovação** | Enviada, esperando decisão |
| **Em revisão** | Devolvida com observações, esperando correção |
| **Aprovada** | Liberada. Segue para cotação |
| **Reprovada** | Recusada. Processo encerrado |
| **Cancelada** | Desistência do solicitante |

## A tela da solicitação

Clique em **Abrir** na lista. Ela mostra:

- **Total estimado** e quantidade de itens
- **Precisa até** e quando foi enviada
- **Quem aprova** — calculado na hora, pelo valor e pelas faixas de alçada
- A tabela de itens, com a linha de orçamento de cada um
- As especificações técnicas, quando houver
- O **histórico** completo

## "Quem aprova" antes de enviar

Este cartão é útil de verdade. Ele mostra, **antes** de você enviar:

> *"Precisa da assinatura de TODAS estas funções: Gestor de obra, Engenheiro."*

Assim você já sabe a quem cobrar, e entende por que um pedido de R$ 42 mil demora mais que um de R$ 800.

## Enviar para aprovação

O botão **Enviar para aprovação** só aparece para o autor, e só enquanto a solicitação for rascunho ou estiver em revisão.

Depois de enviada, ela **não pode mais ser alterada**. Isso é proposital: o aprovador precisa decidir sobre um documento que não muda embaixo dele.

## Baixar o PDF

O botão **📄 Baixar PDF** gera um documento com:

- Cabeçalho com o número e a situação
- Obra, solicitante e datas
- Tabela completa dos itens, com norma técnica e linha de orçamento
- Especificações técnicas
- Espaço para **assinatura do solicitante e do aprovador**

Serve para imprimir, anexar em e-mail ou arquivar. Atende ao pedido da reunião: *"gerar PDF de requisições aprovadas"*.

## O histórico

No pé da tela fica a linha do tempo: quem criou, quem enviou, quando, e o que o sistema registrou em cada passo.

**Esse histórico nunca é apagado.** É ele que responde, meses depois, à pergunta *"quem mandou comprar isso?"*.

## Cancelar

Enquanto não houver decisão, o autor pode cancelar. A solicitação não some — ela fica com a situação **Cancelada** e todo o histórico preservado.

---

# 16. Aprovar uma solicitação

Acesse **Aprovações** no menu. Esta tela só aparece para quem tem função de aprovador: **gestor de obra, engenheiro ou fundador**.

## A fila

A tela mostra **apenas o que depende da sua assinatura agora**.

Não aparece o que:

- você já assinou
- espera a assinatura de outra função
- **você mesmo abriu** (veja mais abaixo)

Três números no alto resumem a situação: quantas solicitações esperam por você, o valor somado, e quantas vencem em até 7 dias.

## A ordem da lista

As solicitações vêm ordenadas pela **data em que o material é necessário**. O que aperta primeiro fica no topo.

A coluna **Precisa até** avisa em cores quando o prazo está curto:

| Aparece | Significa |
|---|---|
| **Atrasada há 3 dia(s)** | Já passou do prazo |
| **É para hoje** | Último dia |
| **Faltam 4 dia(s)** | Menos de uma semana |
| Uma data comum | Ainda há folga |

## A coluna Assinaturas

| Aparece | Significa |
|---|---|
| **Basta uma** | Sua assinatura sozinha resolve |
| **1 de 2** | Já tem uma assinatura, falta a outra |

## Analisando

Clique em **Analisar**. Você vai para a solicitação completa, com todos os itens, as especificações técnicas e o histórico.

> Vale a pena olhar os itens antes de decidir, e não aprovar só pelo valor. A tela mostra a etiqueta **Primeira compra** nos itens que a empresa nunca comprou — esses merecem mais atenção.

---

# 17. As três decisões

Dentro da solicitação aparece o painel **Sua decisão**, com três opções.

## Aprovar

Libera a solicitação para a próxima etapa (cotação).

| Situação | O que acontece |
|---|---|
| A faixa exige **uma** assinatura | A solicitação fica **Aprovada** na hora |
| A faixa exige **todas** e você é o primeiro | Continua **Aguardando aprovação** e vai para a fila do próximo |
| Você é o último que faltava | A solicitação fica **Aprovada** |

Depois de aprovar, o sistema avisa em que pé ficou: *"Sua assinatura foi registrada. 1 de 2 assinaturas. Falta: Engenheiro."*

## Devolver para revisão

Manda de volta ao solicitante para corrigir.

**A observação é obrigatória.** A tela cobra isso antes de deixar confirmar:

> *"Sem explicar o motivo, o solicitante não sabe o que corrigir."*

O que acontece:

1. A solicitação fica **Em revisão**
2. O solicitante pode editá-la de novo
3. Ele corrige e reenvia
4. **As assinaturas anteriores são apagadas**

> **Por que apagar as assinaturas?** Porque elas foram dadas sobre um conteúdo que pode ter mudado. Quem aprovou 120 sacos de cimento não aprovou, por tabela, os 400 que podem aparecer depois da correção.

## Reprovar

Encerra o pedido definitivamente. **Não tem volta.**

A tela mostra um aviso vermelho antes de confirmar, sugerindo **Devolver para revisão** quando o problema for corrigível.

Uma única reprovação encerra a solicitação, mesmo que outra função já tenha aprovado.

---

## A trava mais importante: ninguém aprova o próprio pedido

Se o Bras (gestor de obra) abrir uma solicitação, **ele não consegue aprová-la**, mesmo tendo a função de aprovador.

Ela nem aparece na fila dele. E se ele tentar pela URL, o sistema recusa:

> *"Você não pode aprovar uma solicitação que você mesmo abriu."*

É o controle básico contra alguém comprar para si mesmo sem ninguém olhar. Outro gestor de obra pode aprovar normalmente.

## Quem acumula duas funções exigidas

Se a faixa exige **Gestor de obra e Engenheiro**, e a mesma pessoa tem as duas funções, o painel mostra um campo **Assinar como**.

Ela precisa assinar **duas vezes**, uma por função.

> Isso é proposital. Se uma assinatura contasse por duas, a exigência de "duas assinaturas" viraria letra morta sempre que alguém acumulasse os papéis.

---

## As assinaturas ficam registradas

Abaixo do painel aparece a tabela **Assinaturas**, com quem decidiu, com qual função, qual foi a decisão, a observação e quando.

Junto com o **Histórico**, é isso que permite reconstruir qualquer compra meses depois.

**Essas informações nunca são apagadas.**

---

## O que muda para o solicitante

| Situação | O que ele vê |
|---|---|
| **Aprovada** | A solicitação segue para cotação |
| **Em revisão** | Pode editar de novo. A observação explica o quê |
| **Reprovada** | O pedido está encerrado |

---

# 18. Montar um pacote de cotação

Acesse **Cotações** no menu. Esta tela é do **Comprador**.

## O que é um BID

É um **pacote de itens** enviado de uma vez só a vários fornecedores, pedindo preço.

> Em vez de o comprador ligar para cinco fornecedores item por item, ele monta um pacote, escolhe quem convidar e o sistema manda um link para cada um. Cada fornecedor responde no próprio tempo, sem ver os outros.

É exatamente o que o fluxo da Porto Inc. descreve: *"o comprador seleciona os materiais aprovados e os agrupa em um BID"*.

## Só entra o que já foi aprovado

A tela de montagem mostra apenas itens que:

1. Vieram de uma solicitação **aprovada**, e
2. Ainda **não entraram** em nenhum outro pacote

Isso impede dois erros comuns: cotar algo que ninguém liberou, e cotar o mesmo item duas vezes.

## Passo a passo

1. **Cotações → + Novo pacote de cotação**
2. Dê um **título** — é o que o fornecedor vê
3. Defina o **prazo de resposta**
4. Marque os itens na lista
5. **Criar pacote e escolher fornecedores**

O pacote nasce como **Rascunho**: nada foi enviado a ninguém ainda.

## Agrupe por família

Use o filtro de família e monte um pacote por vez.

> **Por quê:** o sistema convida os fornecedores pelas famílias dos itens. Um pacote só de elétrica vai só para quem vende elétrica. Se você misturar cinco famílias, alguns fornecedores vão receber itens que não atendem — e responder "não tenho" em metade da lista.

Se você misturar mais de duas famílias, a tela avisa.

---

# 19. Convidar fornecedores e abrir

## Os sugeridos

Ao abrir o pacote em rascunho, o sistema já lista **quem atende as famílias dos itens**, com as famílias de cada um e o WhatsApp.

Os que ainda não foram convidados vêm **pré-marcados** — o caminho normal é convidar todos.

> Se aparecer *"Nenhum fornecedor atende as famílias deste pacote"*, o problema está no cadastro: vá em **Cadastros → Fornecedores** e marque as famílias de cada um.

## Abrir a cotação

O botão **📨 Abrir cotação e convidar** faz três coisas:

1. Gera um **link único** para cada fornecedor
2. Marca as solicitações de origem como **Em cotação**
3. Dispara o aviso pelo WhatsApp

> **Enquanto a integração estiver simulada**, o aviso não sai do sistema — ele é apenas registrado. Você mesmo copia o link e manda como quiser.

Depois de aberto, **não dá mais para trocar itens nem convidados**. Isso é proposital: o pacote precisa ser o mesmo para todos que já receberam o link.

## Acompanhar as respostas

A tabela **Convidados** mostra, por fornecedor:

| Coluna | O que diz |
|---|---|
| **Abriu o link** | Quando ele viu o pedido pela primeira vez |
| **Respondeu** | Quando enviou a cotação |
| **Total cotado** | Quanto ficou, já com frete |
| **Pagamento** | Entrada e parcelas que ele propôs |

Quem abriu mas não respondeu merece um telefonema.

## Copiar o link

O botão **🔗 Copiar link** coloca o endereço na área de transferência. Você pode colar num e-mail, num WhatsApp ou onde preferir.

## Encerrar

Quando os prazos vencerem, ou quando já houver respostas suficientes, use **Encerrar cotação**. Os links param de funcionar e o pacote segue para a equalização (Etapa 6).

---

# 20. O portal do fornecedor

Esta é a **única tela do sistema sem login**, e a única que gente de fora da Porto Inc. vai ver.

## Como o fornecedor entra

Ele clica no link que recebeu. Não tem senha, não tem cadastro, não tem instalação.

> **Por que sem senha?** Porque o link já é a senha. Ele tem 43 caracteres aleatórios — adivinhar um no chute é inviável. Exigir cadastro faria muito fornecedor simplesmente não responder.

## O que ele vê

| Seção | Conteúdo |
|---|---|
| **Cabeçalho** | Número da cotação, título e o nome da empresa dele |
| **Prazo** | Quantos dias faltam, em destaque |
| **Itens** | Código, descrição, quantidade, norma exigida e especificação |
| **Condições** | Frete, outros custos, entrada, parcelas |

Para cada item ele informa **preço, marca, modelo e prazo de entrega**. O total aparece na hora, item a item e no fim.

## "Não tenho este item"

Cada item tem essa caixa. Ao marcar, os campos de preço somem e o item fica visualmente apagado.

> Sem essa opção, o fornecedor que não trabalha com um item teria que inventar um preço ou desistir da cotação inteira.

## O que ele NÃO vê

Este é o ponto mais importante da tela:

- ❌ Quem mais foi convidado
- ❌ Quantos fornecedores estão cotando
- ❌ Qualquer preço de concorrente
- ❌ Qualquer outra informação da Porto Inc.

Ele enxerga **apenas o próprio convite**.

## Ele pode corrigir

Enquanto o prazo estiver correndo, o fornecedor pode reabrir o mesmo link e alterar a resposta. Os campos voltam preenchidos com o que ele enviou.

> Isso atende ao passo *"Rever Cotação"* do fluxo da Porto Inc.

Vale sempre a **última** resposta.

## Quando o link para de funcionar

| Situação | O que o fornecedor vê |
|---|---|
| Link errado ou incompleto | *"Este link não é válido"* |
| Prazo vencido | *"O prazo já encerrou. Fale com o comprador"* |
| Cotação encerrada | *"Esta cotação não está mais aberta"* |

Todas as mensagens dizem o que fazer, e nenhuma expõe detalhe técnico.

---

# 21. Equalização: comparando as propostas

Esta é **a tela onde o dinheiro é decidido**. Todos os fornecedores aparecem lado a lado, item por item, e o melhor preço de cada linha vem destacado.

## Como chegar

Pelo menu **Cotações** → abra a cotação → botão **📊 Equalizar e escolher**.

> Só aparece para quem tem a permissão de gerenciar cotações (Comprador e Administrador).

## Os três cartões do topo

| Cartão | O que responde |
|---|---|
| **Escolhendo item a item** | Quanto sai se você pegar o melhor preço de cada item, mesmo que sejam fornecedores diferentes |
| **Fechando com um só** | Quanto sai comprando tudo do fornecedor mais barato no conjunto |
| **Economia ao misturar** | A diferença entre os dois |

> **Cuidado que o sistema já toma por você:** no cartão "escolhendo item a item", o frete **de cada fornecedor vencedor** entra na conta. Somar só os preços dos itens daria uma comparação injusta — dividir a compra entre três fornecedores significa pagar três fretes.

Quando a economia dá **R$ 0,00**, o sistema escreve *"Não compensa dividir neste caso"*. É uma resposta, não uma falha.

## O mapa comparativo

Cada linha é um item. Cada coluna é um fornecedor. No cabeçalho da coluna o sistema mostra **quantos itens aquele fornecedor está vencendo**.

Dentro de cada célula:

- O **valor total** daquele item com aquele fornecedor
- A etiqueta **melhor preço** na célula vencedora
- O **prazo de entrega** em dias (`7d`)
- **+100%** quando o preço está acima do melhor — para você enxergar a diferença sem fazer conta

Quem não cotou aquele item aparece como **não cotou**, e a célula não é clicável.

Nas duas últimas linhas vêm **frete e outros custos** e o **total fechando tudo com um só**.

## Escolhendo item a item

**Clique na célula** do fornecedor que você quer para aquele item. Ela fica marcada. Clicando de novo, você desmarca.

Você **não precisa** escolher tudo do mesmo fornecedor. É exatamente para isso que a tela existe.

O rodapé mostra, em tempo real:

- Quanto já está escolhido
- Quanto de frete essa combinação vai custar
- Quantos itens ainda faltam escolher

## O atalho "Aceitar todos os melhores preços"

Marca de uma vez o vencedor de cada linha. Serve como **ponto de partida**: depois você troca só o que quiser.

> Use quando a decisão for só preço. Quando prazo ou marca pesarem, vale ir item a item.

## Preço não é tudo

Abaixo do mapa fica o quadro **Condições comerciais**, com o que cada fornecedor ofereceu de pagamento, frete e validade da proposta.

> Um fornecedor R$ 300 mais caro que parcela em 3x pode ser melhor para o caixa da obra do que um mais barato à vista. O sistema mostra os dois lados — **a decisão é sua**.

## Salvando

O botão **Salvar escolhas** grava o que você marcou. Pode salvar, sair e voltar depois: nada se perde.

---

# 22. Última chamada

## Para que serve

Você abriu a cotação, três fornecedores responderam, e um deles ficou perto de ganhar mas não ganhou. A última chamada dá a ele **uma chance de rever o preço**, com um novo prazo.

No fluxo original da Porto Inc. esse passo era feito por telefone, um por um.

## Como disparar

Na tela de equalização, botão **📣 Última chamada**. Você informa:

| Campo | Para que serve |
|---|---|
| **Novo prazo** | Até quando o fornecedor pode atualizar (sugestão: 3 dias) |
| **Recado** | Um texto opcional seu, que entra no fim da mensagem |

## O que a mensagem diz — e o que ela nunca diz

A mensagem que sai é assim:

> Porto Inc. — BID-00002 · ÚLTIMA CHAMADA
> Recebemos propostas melhores nos itens abaixo:
> - 00131 Capacete de segurança classe B
> - 00134 Luva de raspa cano curto par
> Se puder rever seu preço, atualize pelo mesmo link até 15/10/2026.

Repare no que **não** está ali:

- ❌ O preço do concorrente
- ❌ O nome do concorrente
- ❌ Quanto ele precisa baixar

> **Por que essa regra existe.** Dizer *"o fulano está R$ 2 mais barato"* ensina o mercado a se alinhar: na próxima cotação todo mundo já chega no mesmo valor e a Porto Inc. passa a pagar mais caro. Além disso, combinar preço entre concorrentes é assunto de lei de concorrência. O efeito comercial que interessa — *"melhore se puder"* — é obtido do mesmo jeito, sem o risco.

## O que muda na cotação

- A cotação volta para **Aberto**, com um novo prazo
- O contador de **rodada** sobe (Rodada 2, Rodada 3...)
- O mesmo link do fornecedor continua valendo — ele não precisa de link novo
- Só os fornecedores que **já responderam e não estão vencendo** recebem a mensagem

> Enquanto as integrações estiverem em modo **simulado**, nada é enviado de verdade: o sistema registra a mensagem e mostra para você o texto exato que sairia.

---

# 23. Pedido de compra

## Gerando

Com as escolhas salvas, o botão **✅ Gerar pedidos de compra** fecha a cotação e cria os pedidos.

Antes de gerar, o sistema confere:

| Conferência | Por quê |
|---|---|
| Todo item com proposta tem um vencedor escolhido | Para não deixar item órfão no meio do caminho |
| O fornecedor escolhido realmente cotou aquele item | Evita erro de clique |
| A cotação ainda não foi concluída | Impede gerar o mesmo pedido duas vezes |

Se algo estiver faltando, ele **lista exatamente o que falta** em vez de dar um erro genérico.

## Um pedido por fornecedor

Se você dividiu a compra entre dois fornecedores, saem **dois pedidos** — cada um com o seu número, o seu frete e as suas condições de pagamento.

É assim que o mundo real funciona: cada fornecedor recebe o documento só da parte dele.

## A tela de Pedidos

Menu **Pedidos**. Mostra número, fornecedor, cotação de origem, quantidade de itens, total, condição de pagamento e situação.

| Situação | Significa |
|---|---|
| **Rascunho** | Gerado, ainda não enviado ao fornecedor |
| **Enviado** | Já foi para o fornecedor |
| **Confirmado** | O fornecedor confirmou |
| **Cancelado** | Cancelado |

## O PDF do pedido

Botão **📄 PDF** na linha do pedido. O arquivo traz dados da Porto Inc. e do fornecedor, itens com preço e prazo, totais com frete, condição de pagamento e local de entrega.

E traz, em destaque:

> **IMPORTANTE: informe o número PC-00001 na nota fiscal e na entrega.**

## Por que esse número importa tanto

Ele é a **chave do recebimento**. Quando o material chegar na obra, o almoxarife vai procurar esse número para comparar o que chegou com o que foi pedido. Sem ele, a conferência vira adivinhação.

> É a ponte entre a Etapa 6 e a Etapa 7.

---

# 24. Recebimento: conferir o que chegou

O caminhão parou no portão. Esta é a tela que decide se o material entra, e é a única do sistema pensada para ser usada **em pé, com pressa**.

## Como chegar

Menu **Recebimento**. É a tela inicial de quem tem a função de **Almoxarife**.

## O campo grande no topo

O primeiro campo da tela é o **número do pedido**, e ele já vem com o cursor dentro. Aceita três formas:

| Você pode digitar | Funciona? |
|---|---|
| `PC-00001` | Sim |
| `1` | Sim |
| `00001` | Sim |
| Leitor de código de barras | Sim — ele digita e dá Enter sozinho |

> **Por que aceitar tudo isso.** Exigir o formato exato transformaria a tela num campo minado. Quem está com luva, na chuva, conferindo carga, não pode errar por causa de um traço.

Quem não tem o número na mão usa a lista **Esperando entrega**, logo abaixo, e clica em **Conferir**.

## A tela de conferência

O título mostra o número do pedido, o fornecedor, a cotação de origem e a obra. A tabela traz uma linha por item:

| Coluna | O que é |
|---|---|
| **Pedido** | Quanto foi comprado |
| **Já recebido** | O que entrou em entregas anteriores |
| **Saldo** | **O que o fornecedor ainda deve** |
| **Recebido agora** | Quanto você está contando nesta entrega |
| **Devolvido** | O que voltou no caminhão |
| **Como chegou** | Chegou certo, com ressalva ou devolvido |

> **Saldo é a coluna que importa.** Ela responde a única pergunta que interessa no portão: *ainda falta alguma coisa?*

## Bipar o material

O segundo campo — **Bipar ou digitar o código do material** — procura o item dentro do pedido e:

1. Destaca a linha
2. Já preenche a quantidade com o saldo

Depois é só corrigir se tiver vindo menos. Ele aceita o **código de barras** do material ou o **COD PORTO**.

Se o código não estiver naquele pedido, o sistema avisa: provavelmente é material de outro pedido.

## Atalhos

| Botão | O que faz |
|---|---|
| **Recebi tudo que falta** | Preenche todas as linhas com o saldo |
| **Limpar** | Apaga o que você marcou e recomeça |

## Documento da entrega

Antes de registrar, informe:

- **Entrou no almoxarifado** — o da obra ou o central
- **Nota fiscal** e **série** — se já vieram
- **Transportadora**
- **Observações** — ex.: *"motorista não esperou a conferência completa"*

> A nota fiscal é o que vai ligar esta entrega à conta a pagar, na Etapa 9. Se ela ainda não chegou, pode deixar em branco: dá para lançar depois.

## Registrar

O botão **Registrar recebimento** grava e devolve uma frase curta:

> REC-00002 registrado. 1 item conforme. Pedido recebido por inteiro.

Cada conferência ganha seu próprio número (**REC-00001**, **REC-00002**...). O mesmo pedido pode ter vários.

---

# 25. Entrega parcial, ressalva e devolução

Este capítulo é o coração da Etapa 7. O material raramente chega exatamente como foi pedido.

## Chegou só uma parte

Preencha só o que chegou e registre. O sistema:

- Guarda o que entrou
- **Mantém o resto no saldo**
- Deixa o pedido como **Recebido em parte**

Quando o restante chegar, é só abrir o mesmo pedido de novo: a coluna **Já recebido** estará preenchida e o **Saldo** mostrará o que falta.

> Não existe limite de entregas por pedido. Areia costuma vir em cinco viagens — e as cinco entram como recebimentos do mesmo pedido.

## Chegou, mas com problema: ressalva

Use **Aceito com ressalva** quando o material entra, mas algo precisa ficar registrado: embalagem amassada, mistura de lotes, nota com dado errado.

O sistema **obriga a escrever o motivo**. Sem ele, não grava.

> Por quê? Porque daqui a três semanas, quando alguém perguntar *"por que esse cimento endureceu?"*, a resposta precisa estar escrita — e não na memória de quem recebeu.

## Não aceitou: devolução

Use **Devolvido** quando o material volta no caminhão. Informe a quantidade na coluna **Devolvido** e escreva o motivo.

## A regra mais importante desta etapa

> **Material devolvido NÃO baixa o saldo.**

Chegaram 10 sacos, 3 estavam rasgados e voltaram:

| | |
|---|---|
| Recebido agora | 7 |
| Devolvido | 3 |
| Saldo depois | **3** |

O fornecedor **continua devendo** os 3. Se o sistema baixasse o saldo, ele estaria perdoando a dívida sozinho — e o almoxarifado ficaria com 3 sacos a menos sem ninguém perceber.

## O que o sistema não deixa fazer

| Tentativa | Resposta |
|---|---|
| Receber mais do que o saldo | *"o saldo é de 40 KG, e você informou 45"* |
| Ressalva ou devolução sem motivo | *"explique o motivo da ressalva"* |
| Marcar devolvido sem quantidade devolvida | *"marcado como devolvido, mas sem quantidade devolvida"* |
| Receber de novo um item já completo | *"este item já foi recebido por inteiro"* |
| Receber um pedido cancelado | *"não receba o material sem falar com o comprador"* |

> Sobre a primeira linha: se chegou material **a mais** do que foi comprado, o sistema não deixa entrar. Aceitar significaria pagar mais do que foi aprovado. Registre o saldo e anote o excedente nas observações — quem resolve isso é o comprador.

## Quando o pedido fecha

Só quando **nenhum item tiver saldo**. Aí o pedido passa para **Recebido** e a tela avisa que não há mais o que conferir.

---

# 26. Marcar o pedido como enviado

Um passo pequeno, na tela de **Pedidos**, que liga a compra ao almoxarifado.

## Para que serve

Depois de gerar o pedido, o comprador manda o PDF para o fornecedor (hoje por fora; a partir da Etapa 10, pelo WhatsApp do sistema). O botão **Marcar como enviado** registra que isso aconteceu.

A partir daí:

- O pedido sai de **Rascunho** e vira **Enviado**
- O almoxarifado sabe o que esperar

## E se o comprador esquecer?

O material entra do mesmo jeito. O sistema **não bloqueia** o recebimento de um pedido em rascunho.

> **Por que essa escolha.** Travar a entrega porque alguém esqueceu de clicar um botão faria o caminhão esperar no portão. O almoxarife não tem como resolver isso. Então o sistema aceita, registra e segue.

O único caso em que ele barra é o **pedido cancelado** — aí o problema é real e precisa do comprador.

---

# 27. Estoque: o que tem no almoxarifado

O recebimento diz **o que chegou**. O estoque diz **o que existe agora**.

## Como chegar

Menu **Estoque**. Quem tem `estoque.ver` enxerga — almoxarife, comprador, engenheiro, gestor de obra e fundador. Só quem tem `estoque.movimentar` (almoxarife e administrador) pode dar baixa.

## Os quatro cartões

| Cartão | O que responde |
|---|---|
| **Itens em estoque** | Quantos materiais têm ficha aberta neste almoxarifado |
| **Valor parado** | Quanto dinheiro está guardado na prateleira |
| **Abaixo do mínimo** | Quantos itens precisam ser comprados |
| **Zerados** | Quantos acabaram |

## A tabela de saldo

Uma linha por material, com **saldo**, **mínimo**, **custo médio** e **valor parado**. O que está no ponto de pedido vem destacado, com o selo **Repor**.

## Custo médio: o número que vale

Quando entra material, o sistema recalcula o preço médio do que está guardado:

| Momento | Conta | Custo médio |
|---|---|---|
| Chegaram 100 sacos a R$ 30 | — | R$ 30 |
| Chegaram mais 100 a R$ 40 | (100×30 + 100×40) ÷ 200 | **R$ 35** |
| Saíram 50 sacos | não muda o preço do que ficou | R$ 35 |

> **Por que não usar o preço da última nota?** Porque o mesmo saco de cimento valeria coisas diferentes dependendo do dia em que fosse retirado. Com o custo médio, o que a obra consome é apontado por um preço só — e é esse número que vai para o custo da obra.

Transferir material entre almoxarifados **não muda o custo médio**: mudar de prateleira não deixa o cimento mais caro.

## A entrada é automática

Você não precisa lançar nada: toda entrega conferida no **Recebimento** vira entrada de estoque na hora, com o preço que foi pago no pedido.

> As entregas conferidas **antes** desta etapa existir também entraram, como *"Saldo inicial"*. O estoque não nasceu zerado mentindo.

E o que foi **devolvido** não entra — nunca esteve na prateleira de verdade.

---

# 28. Retirar, contar e transferir

Os três botões que o almoxarife usa no dia a dia. Todos abrem o mesmo painel, em cima da tabela.

## Retirar material

Botão **Retirar** na linha do material.

| Campo | Obrigatório? |
|---|---|
| Quantidade | Sim |
| Para quem / qual frente de serviço | **Sim** |
| Observação | Não |

> **Por que o destino é obrigatório.** Material que sai sem dono vira buraco no estoque. Quando o saldo não bate no fim do mês, a única pergunta que importa é *"para onde foi?"* — e a resposta precisa estar escrita.

O sistema **não deixa tirar mais do que existe**. Se o saldo é 30 e você pede 45, ele recusa dizendo exatamente isso.

## Contar (ajuste de inventário)

Botão **Contar**. Você informa **quanto contou na prateleira** — não a diferença. O sistema faz a conta.

| Campo | Obrigatório? |
|---|---|
| Quantidade contada | Sim |
| O que a contagem encontrou | **Sim** |

Se a contagem bater com o saldo, o sistema avisa que não há nada a ajustar.

> **Por que exigir explicação.** Ajuste é o único lugar do sistema em que o saldo muda sem material entrar ou sair. Sem motivo escrito, vira porta dos fundos.

## Transferir

No painel, escolha **Transferir para outro almoxarifado**. Saem dois movimentos: um de saída na origem, um de entrada no destino, com o mesmo custo.

## Entrada avulsa

Existe, mas é exceção: sobra de obra, doação, material achado. O caminho normal de entrada é o recebimento.

---

# 29. Ponto de pedido: comprar antes de faltar

## O que é

Cada material pode ter um **mínimo** cadastrado (campo *ponto de pedido*, no cadastro de materiais). Quando o saldo encosta nesse número, o sistema avisa.

## O aviso

No alto da tela de estoque aparece um quadro amarelo:

> ⚠ **1 material chegou no ponto de pedido.**
> 00068 Arame recozido n. 18 rolo 1kg — Restam 4 KG, mínimo é 25.

## Montar a reposição

Botão **Montar reposição**. O sistema lista o que comprar e **quanto**:

| Material | Tem | Mínimo | Comprar |
|---|---|---|---|
| 00068 Arame recozido | 4 KG | 25 | **46 KG** |

A sugestão repõe até o **dobro do mínimo**.

> **Por quê o dobro?** Comprar só até o mínimo deixaria o estoque no limite e dispararia o mesmo alerta na semana seguinte. O número é um ponto de partida — dá para mudar antes de enviar.

## Abrir a solicitação

Botão **Abrir solicitação com N itens**. O sistema cria a solicitação de compra já preenchida, na obra daquele almoxarifado, e te leva para a tela dela.

A partir daí é o caminho de sempre: enviar → aprovar → cotar → pedido → recebimento → **de volta para o estoque**.

> **Por que o sistema não abre a solicitação sozinho?** Porque uma semana de obra movimentada geraria dezenas de solicitações automáticas, e alguém teria que aprovar todas. O alerta é automático; a decisão de comprar continua sendo de uma pessoa. Se mais para a frente a Porto Inc. quiser 100% automático, é uma linha de configuração.

---

# 30. O extrato: por que o saldo está assim

Menu **Estoque** → botão **Ver extrato**.

Cada linha é um movimento, com número próprio (**MOV-00001**, **MOV-00002**...):

| Coluna | O que mostra |
|---|---|
| **Movimento** | Número e quando aconteceu |
| **Material** | Código, descrição e almoxarifado |
| **O que foi** | Entrada, retirada, ajuste ou transferência |
| **Quantidade** | Com sinal: **+36 KG** ou **−6 KG** |
| **Saldo depois** | Como ficou o saldo naquele instante |
| **Quem / para onde** | Quem registrou e o destino |

## A regra que sustenta tudo

> **Nada aqui é apagado ou alterado.**

Registrou errado? O conserto é um **novo movimento** — nunca a edição do antigo. É isso que permite, meses depois, explicar qualquer saldo linha a linha.

---

# 31. Nota fiscal: ligando a compra ao dinheiro

O recebimento diz o que chegou. O estoque diz o que existe. A nota fiscal diz **quanto vai sair do caixa** — e quando.

## Como chegar

Menu **Financeiro** → botão **Notas fiscais**. Quem tem `financeiro.ver` enxerga (comprador, fundador, administrador); só quem tem `financeiro.gerenciar` lança.

## Dois caminhos, o mesmo lugar

| Caminho | Quando usar |
|---|---|
| **Importar XML** | O fornecedor mandou o arquivo por e-mail. É o caminho rápido |
| **Lançar nota** | Só veio o papel (DANFE). Você digita |

> Quando a SEFAZ for ligada, ela vira um **terceiro caminho** para a mesma tela: buscar a nota pela chave. Nada do que você aprender aqui muda.

## Importando o XML

Clique em **Importar XML** e escolha o arquivo. O sistema:

1. Lê número, série, data, valores e **todos os itens**
2. Confere a **chave de acesso** de 44 dígitos
3. Descobre o fornecedor pelo **CNPJ** que está na nota
4. Mostra só os **pedidos daquele fornecedor** na lista

Você confere, escolhe o pedido e clica em **Lançar nota**.

> O XML sozinho **não grava nada**. Ele preenche o formulário; quem grava é você.

## A nota se confere sozinha

A chave de 44 dígitos não é um número qualquer. Dentro dela estão:

| Pedaço | O que é |
|---|---|
| 2 dígitos | Estado |
| 4 dígitos | Ano e mês da emissão |
| **14 dígitos** | **CNPJ de quem emitiu** |
| 2 dígitos | Modelo (55 = NF-e) |
| 3 dígitos | Série |
| **9 dígitos** | **Número da nota** |
| ... | código e **dígito verificador** |

O sistema abre a chave e compara com o que foi digitado. Se o CNPJ ou o número não baterem, ele avisa — **sem consultar a SEFAZ**. É a nota provando a si mesma.

## O que ele confere contra o pedido

| Conferência | O que acusa |
|---|---|
| Dígito verificador | *"A chave não passa na conferência dos 44 dígitos"* |
| CNPJ da chave | *"A chave é de outro CNPJ"* |
| Número da nota | *"A chave diz que esta é a nota 124, não a 999"* |
| Fornecedor | *"A nota é de um fornecedor diferente do que está no pedido"* |
| Valor acima | *"A nota está R$ 500,00 acima do que falta no pedido"* |
| Valor abaixo | *"A nota está R$ 400,00 abaixo. É entrega parcial? Se for, está certo"* |

Tudo certo? A nota fica **Conferida**. Algo estranho? Fica **Com pendência**, com a lista do que não bateu.

> **O sistema não impede de lançar.** Entrega parcial é normal, e às vezes a diferença tem explicação. Ele só não deixa passar despercebido.

## Duas notas do mesmo pedido

É comum. A segunda nota já considera o que a primeira lançou: se o pedido é de R$ 1.000 e a primeira nota foi de R$ 400, a segunda de R$ 600 fecha certinho.

O mesmo fornecedor **não lança a mesma nota duas vezes** — número e série repetidos são barrados.

---

# 31.1. Arquivar a nota fiscal

> O fluxo de compras diz que, com a entrega conforme, a nota é **arquivada em PDF**.
> São dois caminhos, e o sistema tem os dois.

## O espelho: quando a nota foi digitada

Na tela **Notas fiscais**, coluna **Arquivo**, botão **📄 PDF**. Sai uma folha com tudo o
que foi lançado: fornecedor, pedido, chave de acesso, itens, totais e as divergências.

**Este documento NÃO é o DANFE.** Ele diz isso no rodapé, com todas as letras:

> Documento interno da Porto Inc., gerado a partir do que foi lançado no sistema.
> NÃO substitui o DANFE nem tem valor fiscal.

O DANFE de verdade tem layout definido em lei e só vale acompanhado do protocolo de
autorização que a SEFAZ devolve. Enquanto o certificado digital da empresa não estiver
configurado, o sistema não tem esse protocolo — e um papel parecido com um DANFE sem
sê-lo seria pior do que papel nenhum.

## O arquivo do fornecedor: quando ele mandou

Ainda na coluna **Arquivo**, botão **📎 Arquivos**. Abre uma gaveta embaixo da nota com o
que já está guardado e um campo para subir o PDF ou o XML que o fornecedor enviou.

- Só **PDF e XML**, até **5 MB**
- O arquivo fica guardado **junto da nota** e pode ser baixado depois
- Quem guardou e quando ficam registrados

> O arquivo volta **exatamente** como entrou. O sistema guarda um resumo do conteúdo e
> confere na hora de devolver: arquivo trocado ou corrompido vira erro claro, em vez de um
> PDF que não abre e ninguém sabe por quê.

## Onde os arquivos ficam

Num volume do Docker, fora do banco. Binário dentro do banco incharia a cópia de segurança
e deixaria toda consulta mais lenta sem devolver nada em troca.

> Isso quer dizer que a **cópia de segurança do banco não leva os arquivos junto**. Ao
> mudar o sistema de máquina, o volume `portoink_arquivos` também precisa ir.

---

# 32. Contas a pagar

## De onde vêm as parcelas

Da nota, com as condições que foram **combinadas na cotação** e congeladas no pedido de compra. Ninguém digita prazo de pagamento duas vezes.

Na lista de notas, clique em **Gerar parcelas**.

## Como a conta é feita

Nota de R$ 1.208,00 com *30% de entrada + 3x a cada 30 dias*:

| Parcela | Valor | Vence |
|---|---|---|
| 1 de 4 (entrada) | R$ 362,40 | no dia da nota |
| 2 de 4 | R$ 281,87 | +30 dias |
| 3 de 4 | R$ 281,87 | +60 dias |
| 4 de 4 | **R$ 281,86** | +90 dias |

> Repare no centavo da última parcela. **A última sempre absorve o arredondamento**, para a soma bater exatamente com a nota. Sem isso sobra ou falta centavo — e é sempre o financeiro que descobre, do jeito ruim.

Nota sem pedido vinculado vira **parcela única, à vista**.

## A tela

Menu **Financeiro**. Ela foi montada para responder cinco perguntas, nesta ordem:

1. Tenho problema **agora**?
2. Tenho problema **esta semana**?
3. Quanto devo **no total**?
4. Como fica o **caixa nos próximos meses**?
5. **Para quem** devo e por **qual obra**?

### Os quatro cartões

| Cartão | Por que primeiro |
|---|---|
| **Vencidas** | É o único número que custa juros |
| **Vencem em 7 dias** | O que precisa entrar no fluxo de caixa da semana |
| **Total em aberto** | O compromisso inteiro |
| **Pago no mês** | Quanto já saiu |

Embaixo de cada valor vem uma frase curta: *A mais antiga venceu há 15 dias*, *A próxima vence amanhã*.

### Os quatro indicadores

| Indicador | O que responde | Como ler |
|---|---|---|
| **Prazo médio negociado** | Quantos dias, em média, entre a nota e o vencimento | Quanto maior, mais fôlego de caixa o comprador conseguiu |
| **Maior parcela em aberto** | Qual é o maior susto que vem por aí | Serve para planejar o mês |
| **Parcela média** | Tamanho típico de uma conta | Ajuda a perceber quando algo destoa |
| **Notas lançadas no mês** | Volume de trabalho do financeiro | Avisa quantas ainda estão sem parcelas |

---

# 33. Os gráficos do financeiro

Todos os gráficos vêm com uma **tabela equivalente escondida**, que leitores de tela leem no lugar do desenho. E quem configurou o computador para reduzir movimento vê os gráficos prontos, sem animação.

## Os números por trás do desenho

Gráfico mostra proporção; número mostra fato. Os dois aparecem:

| Onde você está | O que fazer |
|---|---|
| **Computador** | Passe o mouse por cima |
| **Celular** | Toque — e toque fora para fechar |
| **Só teclado** | Vá com **Tab** até o gráfico |

Aparece uma caixinha com os valores daquele pedaço: no fluxo, o pago, o vencido, o a vencer e o total do mês; na rosca, o valor e o percentual da faixa; nos rankings, quanto está em aberto, quanto já foi pago e o total.

> Nos **indicadores** do topo, a caixinha traz também a explicação do que aquele número significa — tipo *"quanto maior, mais fôlego de caixa o comprador negociou"*.

## Fluxo de caixa

Doze meses: os **3 anteriores** e os **8 seguintes**. O mês atual fica destacado.

Cada coluna empilha três cores:

| Cor | O que é |
|---|---|
| 🟩 Verde | **Pago** — dinheiro que já saiu, no mês em que saiu |
| 🟥 Vermelho | **Vencido** — devia ter saído e não saiu |
| 🟨 Amarelo | **A vencer** — o que está programado |

> Repare: a parcela paga conta no mês em que **o dinheiro saiu**, não no mês do vencimento. É isso que transforma o gráfico em fluxo de caixa de verdade.

Olhando as colunas da direita, dá para ver quanto o mês que vem já está comprometido — antes de assumir compromisso novo.

## Composição da carteira

A rosca divide tudo em quatro faixas: **vencidas**, **vencem em 7 dias**, **a vencer depois** e **já pagas**. No meio aparece o total movimentado em notas.

Serve para uma pergunta só: *que parte do que eu devo está atrasada?* Uma fatia vermelha grande é sinal de que o processo de pagamento está falhando, não de que falta dinheiro.

## Pontualidade

Das parcelas **já pagas**, quantas saíram até o vencimento.

| Faixa | Cor |
|---|---|
| 90% ou mais | Verde |
| 70% a 89% | Amarelo |
| Abaixo de 70% | Vermelho |

> É a régua do **processo**, não do fornecedor. Pagar atrasado gera juros e desgasta a relação com quem entrega material na obra.

## Para quem a Porto Inc. mais deve

Barras por fornecedor, separando **em aberto** de **já pago**. Mostra concentração: se um fornecedor sozinho responde pela maior parte, a construtora está dependente dele — e sem poder de barganha na próxima cotação.

## Custo por obra

As mesmas barras, agora por obra. Responde *"quanto esta obra já consumiu em material?"* sem precisar abrir planilha.

---

# 34. A tabela de parcelas

Abaixo dos gráficos. Mostra título, fornecedor, origem (nota e pedido), valor, vencimento e situação. Parcela vencida vem com o fundo em destaque e o selo **Vencida**.

Cada linha traz uma frase em português: *vence hoje*, *vence em 30 dias*, *venceu há 3 dias*.

Os filtros **Mostrar** e **Situação** recortam a lista sem mexer nos gráficos — eles continuam mostrando o quadro completo.

## Dar baixa

Botão **Dar baixa** na linha. Você informa:

| Campo | Para quê |
|---|---|
| **Pago em** | A data real do pagamento, que pode não ser hoje |
| **Valor pago** | Mude se pagou com desconto ou com juros |
| **Forma de pagamento** | PIX, boleto, transferência |

A mesma parcela **não é paga duas vezes** — o sistema barra.

## Baixar as contas

Botão **↓ Baixar contas**. Ele pergunta o formato antes de baixar — **PDF** ou **Word** —, igual a todo download do sistema. Veja *"Baixar: PDF ou Word"* no capítulo de Relatórios.

O arquivo traz todas as parcelas com título, fornecedor, CNPJ, nota, pedido, parcela, valor, vencimento, situação e pagamento, além do total em aberto no cabeçalho.

## Cancelar uma nota

Na tela de notas, botão **Cancelar**. A nota e as parcelas **em aberto** são canceladas juntas.

> Nota com **parcela já paga não é cancelada**. Apagar isso esconderia um pagamento que aconteceu de verdade. Se o pagamento foi errado, o conserto é no banco, não no sistema.

---

# 35. Por que o pagamento ainda não sai automático

O sistema sabe quanto pagar, para quem e quando. Mas **não manda o dinheiro** — a baixa é registrada por uma pessoa.

Isso é de propósito, por dois motivos:

1. **A integração com o banco ainda não foi ligada** (é a tomada `pagamento`, hoje simulada)
2. Mesmo com ela ligada, mandar dinheiro sozinho é o tipo de automação que se liga por último, com muito cuidado

Quando o banco for integrado, o que muda é só o botão: em vez de *"registrar que paguei"*, ele passa a ser *"pagar"*. A conta, o prazo e o controle continuam exatamente os mesmos.

---

# 36. WhatsApp: a trava vem antes do botão

Esta é a única etapa em que o sistema fala com o mundo de fora. Por isso ela começa por uma trava, não por um botão.

## Como chegar

Menu **WhatsApp**. Só o **Administrador** entra (permissão `sistema.integracoes`).

## O problema que a trava resolve

Os fornecedores de demonstração têm telefones **fictícios** — `5511911111111` e parecidos. Com o WhatsApp conectado de verdade, um clique em *enviar* faria a mensagem cair no celular de um desconhecido que por acaso tenha aquele número.

Por isso existe o **modo de teste**, ligado por padrão:

> Enquanto ele estiver ligado, **só sai mensagem para número que você liberar**.

Qualquer outro é barrado antes de sair — e o bloqueio fica registrado no histórico.

## Liberar um número

Na seção **Números autorizados**:

| Campo | O que é |
|---|---|
| **Número** | Com DDI e DDD, só números: `5511987654321` |
| **De quem é** | `Meu celular`, `Celular do Bras` |
| **Observação** | Opcional |

Comece liberando **o seu próprio celular**. É o jeito seguro de ver o sistema funcionando.

Para tirar da lista, botão **Tirar da lista** — e o número volta a ser barrado na hora.

## Desligar a trava

Só no arquivo `.env`, mudando `WHATSAPP_MODO_TESTE` para `false`. É proposital que não tenha botão na tela: desligar significa liberar envio para qualquer número, e isso merece uma decisão pensada, não um clique.

Com a trava desligada, a tela avisa em **vermelho**.

---

# 37. Conectar o WhatsApp

## Antes de conectar: use um chip de testes

> **Não use o número comercial da Porto Inc.**

A conexão usa uma biblioteca chamada **Baileys**, que **não é oficial** do WhatsApp. Ela funciona bem, mas existe risco real de o WhatsApp bloquear a conta. Use um chip separado enquanto estiver testando.

Quando a Porto Inc. tiver a conta comercial aprovada pela Meta, a troca para a **API oficial** é uma linha de configuração — e nada nesta tela muda.

## O passo a passo

1. Clique em **Conectar**
2. Em alguns segundos aparece o **QR Code**
3. No celular: **WhatsApp › Aparelhos conectados › Conectar um aparelho**
4. Aponte a câmera para o código na tela

A tela se atualiza sozinha enquanto a conexão está em movimento. Quando conectar, o cartão **Situação** mostra **Conectado** e o número aparece **mascarado** (`5511•••••••21`).

## Os estados

| Estado | O que está acontecendo |
|---|---|
| **Desligado** | Nada conectado |
| **Iniciando** | Preparando |
| **QR Code pronto** | Leia com o celular |
| **Esperando leitura** | O código está na tela, aguardando você |
| **Autenticando** | QR lido, confirmando |
| **Conectado** | Funcionando |
| **Reconectando** | A conexão caiu; volta sozinho, **sem pedir QR de novo** |
| **Sessão encerrada** | Alguém desconectou pelo celular; precisa de QR novo |

## Reiniciar não pede QR de novo

A sessão fica guardada num espaço próprio do Docker. Se o container reiniciar, ele reconecta sozinho.

O QR só volta a aparecer quando:
- Você clica em **Desconectar** (que apaga a sessão de propósito), ou
- Alguém encerra a sessão pelo celular

## Cuidados que o sistema toma

| Cuidado | Por quê |
|---|---|
| O QR **nunca** vai para o log | Log de Docker é permanente. Quem fotografa o log entra na conta |
| Números aparecem **mascarados** | Nem no histórico o número inteiro é mostrado |
| **Uma conexão por vez** | Dois sockets brigam pela mesma sessão e derrubam os dois |
| A pasta da sessão está no `.gitignore` | São credenciais: nunca vão para o repositório |

---

# 38. Enviar pelo WhatsApp

## Convite de cotação

Na tela da cotação **aberta**, botão **💬 Enviar convites pelo WhatsApp**.

Cada fornecedor convidado recebe o **link individual** dele:

> Porto Inc. — Pedido de cotação BID-00002
>
> Material elétrico — 2º pavimento
> 3 itens para cotar.
>
> Responda pelo link abaixo até 15/10/2026:
> http://.../portal/xxxx
>
> Não precisa de cadastro nem de senha.

Cada um recebe **o próprio link**. Ninguém vê o convite do outro, nem sabe quem mais foi chamado — a mesma regra da Etapa 5.

O sistema responde quantos foram enviados e quantos foram bloqueados pela lista.

## Pedido de compra

Na tela **Pedidos**, botão **💬 WhatsApp**. Sai o texto com total e condição de pagamento, **com o PDF do pedido em anexo**:

> IMPORTANTE: informe o número PC-00001 na nota fiscal e na entrega.

Se o envio der certo e o pedido ainda estiver em rascunho, ele passa para **Enviado** sozinho — você não precisa clicar em *Marcar como enviado* também.

## Enviar um teste

Na tela do WhatsApp, seção **Enviar uma mensagem de teste**. Serve para conferir a conexão antes de mandar qualquer coisa para fornecedor.

## O histórico guarda tudo — inclusive o que não saiu

| Resultado | Significa |
|---|---|
| **Enviada** | Saiu |
| **Bloqueada** | Barrada pela lista de autorizados |
| **Falhou** | Tentou sair e deu erro (número sem WhatsApp, conexão caída) |

> O bloqueio aparecer no histórico é de propósito. Se alguém tentou mandar para fora da lista, isso precisa ficar registrado.

---

# 38.1. Enviar por e-mail

> O fluxo de compras sempre disse "envia o pedido por **e-mail/WhatsApp**". O WhatsApp
> chegou na Etapa 10; o e-mail faltava, e agora está no lugar.

## Onde fica

Menu **Administração → Avisos**. A tela tem duas abas: **WhatsApp** e **E-mail**. Elas fazem
o mesmo trabalho — levar o convite e o pedido até o fornecedor —, têm a mesma trava e o
mesmo histórico, então ficam juntas.

## A trava é a mesma

Enquanto o **modo de teste** estiver ligado, o sistema só manda e-mail para os endereços
da **lista de autorizados**. Qualquer outro é barrado **antes de sair**, e a tentativa
fica registrada.

> Comece liberando o **seu próprio e-mail**. É assim que se confere a configuração sem
> risco de chegar alguma coisa na caixa de entrada de um fornecedor antes da hora.

## Como se manda

| Onde | Botão | O que vai |
|---|---|---|
| Cotação aberta | **✉ Convidar por e-mail** | O link individual de cada fornecedor |
| Pedidos | **✉ E-mail** | O texto com total e pagamento, **com o PDF do pedido em anexo** |

Os dois botões ficam ao lado dos de WhatsApp. Quem escolhe é quem está mandando: nem todo
fornecedor lê os dois canais.

Se o envio der certo e o pedido ainda estiver em rascunho, ele passa para **Enviado**
sozinho — igual ao WhatsApp.

Fornecedor sem e-mail cadastrado é **pulado com aviso**, e os outros seguem normalmente.

## Hoje ele está simulado

O adaptador de e-mail vem em `mock`: **nada sai para fora**. A tela diz isso no alto, e o
histórico mostra o que teria sido enviado.

Para ligar de verdade, três coisas precisam existir:

1. Conta em um provedor de e-mail transacional
2. O **domínio da empresa verificado**, com SPF e DKIM publicados no DNS
3. `EMAIL_ADAPTER=resend` e as credenciais no `.env`

> O passo 2 não é burocracia: sem ele o e-mail sai, mas cai na caixa de spam do
> fornecedor — que é pior do que não enviar, porque você acha que enviou.

---

# 39. Relatórios

> Acesse por **Relatórios** no menu. Aparece para **Administrador, Fundador, Comprador, Engenheiro e Gestor de obra**.

Até aqui o sistema **guardou** informação. Esta tela é onde ela finalmente **responde perguntas**.

O ponto importante: **nada é digitado de novo**. Todo número desta tela sai do que já aconteceu — a solicitação que alguém abriu, o preço que o fornecedor mandou, o pedido que o comprador fechou, a carga que o almoxarife conferiu. Se um número parecer errado, a resposta está no fluxo, não no relatório.

## Cinco perguntas, cinco abas

A tela tem cinco abas. Cada uma responde a **uma pergunta** que alguém faz de verdade na construtora:

| Aba | A pergunta |
|---|---|
| **Orçamento** | A obra está estourando o orçamento? |
| **Economia** | A cotação valeu a pena? |
| **Fornecedores** | Em quem dá para confiar? |
| **Tempos** | Onde o processo trava? |
| **Consumo** | O que a empresa mais compra? |

Em toda aba a ordem é a mesma: primeiro os **números grandes**, depois o **gráfico**, e só então a **tabela**. Quem abre a tela quer a resposta; a tabela é para quem já sabe o que está procurando.

> A aba fica no endereço do navegador (`/relatorios?ver=economia`). Dá para copiar o link e mandar para outra pessoa: ela abre exatamente na mesma aba.

## Baixar: PDF ou Word

Toda aba tem o botão **↓ Baixar**. Ao clicar, ele **pergunta o formato** antes de gerar o arquivo:

| Formato | Para que serve |
|---|---|
| **PDF** | Imprimir, assinar, anexar num e-mail. Sai igual em qualquer máquina. |
| **Word (.docx)** | Abrir no Word e mexer: cortar uma linha, escrever um comentário, colar num relatório maior. |

Essa mesma escolha aparece em **todo** download de tabela do sistema — aqui e no Financeiro.

### O que vem no arquivo

Não é a tabela crua. O arquivo traz:

- o **cabeçalho da Porto Inc.** e o título do relatório
- o **contexto**: obra, período e os números do resumo
- a **tabela**, com os valores já formatados (R$, %, datas em português)
- uma **nota no pé** explicando a regra que mais gera dúvida naquele relatório
- **data e hora** em que foi gerado, e o número da página

Tabela com muita coluna sai com a **folha deitada**, e o cabeçalho da tabela se repete em toda página — sem isso, da segunda folha em diante ninguém sabe qual coluna é qual.

> **Por que não sai em Excel?** Foi uma decisão sua: todo download do sistema sai em PDF ou Word. Se um dia o financeiro precisar fazer conta em cima dos números, dá para acrescentar o **.xlsx** como terceira opção no mesmo menu.

---

## Aba 1 — Orçamento: a obra está estourando?

Escolha a obra no alto. A tela mostra, linha a linha do orçamento:

| Coluna | O que é |
|---|---|
| **Previsto** | Quantidade prevista × valor unitário previsto, como está no orçamento da obra |
| **Comprado** | O que já virou pedido de compra apontando nessa linha, pelo preço que foi realmente fechado |
| **Saldo** | Quanto ainda cabe |
| **Consumo** | Quanto do previsto já foi usado |
| **Situação** | Folgado, Atenção ou Estourou |

### Por que o alerta começa em 80%

**Atenção** aparece quando a linha chega a **80% do previsto** — não quando estoura.

Avisar só depois que estourou não ajuda ninguém: quando o número fica vermelho, o dinheiro **já saiu**. Em 80% ainda dá tempo de renegociar, trocar de fornecedor ou remanejar o orçamento.

### A linha "(sem linha)"

Se aparecer uma linha chamada **"Compras sem apontamento no orçamento"**, ela significa: *esse material foi comprado para a obra, mas ninguém disse em qual parte do orçamento ele entra.*

O sistema **mostra** esse valor em vez de escondê-lo, porque escondê-lo faria o total do relatório ficar menor que o dinheiro que a empresa realmente gastou.

**Como evitar:** na hora de abrir a solicitação, escolha a **linha de orçamento** de cada item. Se o material tiver linha padrão no cadastro, o sistema já preenche sozinho — tanto na tela quanto na API.

---

## Aba 2 — Economia: a cotação valeu a pena?

Quatro números no alto:

| Número | O que significa |
|---|---|
| **Economia** | Diferença entre o que o solicitante **estimou** e o que o comprador **fechou** |
| **Ganho na disputa** | Quanto se pagaria a mais comprando do fornecedor **mais caro** da mesma cotação |
| **Taxa de resposta** | De cada 10 convidados, quantos mandaram preço |
| **Cotações encerradas** | Quantos pacotes foram concluídos no período |

### A diferença entre os dois primeiros

Eles medem coisas diferentes, e é comum confundir:

- **Economia** compara com o **chute inicial**. Se o solicitante estimou alto, a economia parece grande sem que ninguém tenha negociado nada.
- **Ganho na disputa** compara com **a pior proposta que chegou na mesma cotação**. É o que realmente mede o valor de convidar mais gente.

> A economia pode ser **negativa**. Isso quer dizer que a compra fechou acima do que se esperava — o que acontece quando a estimativa estava defasada. O número aparece em vermelho, com o sinal de menos.

### Taxa de resposta baixa

Se muitos convidados não respondem, a cotação vira uma "disputa" de um fornecedor só — e aí não há disputa nenhuma. Taxa baixa é sinal de cadastro desatualizado ou de fornecedor que não atende aquela família.

---

## Aba 3 — Fornecedores: em quem dá para confiar?

Uma linha por fornecedor com histórico:

| Coluna | O que é |
|---|---|
| **Comprado** | Quanto a empresa já comprou dele |
| **Respostas** | Quantas cotações ele respondeu, de quantas foi convidado |
| **Entregas** | Quantos itens dele já foram conferidos no almoxarifado |
| **Pontualidade** | Quantos chegaram **dentro do prazo que ele prometeu** na cotação |
| **Qualidade** | Quantos chegaram **sem ressalva e sem devolução** |
| **Leitura** | Uma frase em português resumindo o fornecedor |

### Por que a leitura só aparece depois de 3 entregas

Com uma ou duas entregas, qualquer conta dá **0% ou 100%** — e a frase mentiria nos dois sentidos:

- uma ressalva isolada viraria *"chega com problema com frequência"*
- um acerto isolado viraria *"cumpre prazo e entrega certo"*

Por isso, abaixo de três entregas a leitura diz apenas **"Só N entregas até agora — pouco para concluir"**. Os números continuam aparecendo; o que muda é a conclusão.

### Pontualidade: o prazo é o dele

O sistema não inventa um prazo. Ele compara com **o prazo que o próprio fornecedor prometeu** quando respondeu a cotação. Entregar no dia prometido conta como no prazo.

Item que chegou sem prazo combinado fica **fora** da conta de pontualidade: não dá para cobrar um prazo que ninguém combinou.

---

## Aba 4 — Tempos: onde o processo trava?

O caminho de uma compra tem cinco trechos. A tela mede a média de dias de cada um:

| Etapa | Do quê até quê |
|---|---|
| **Montar o pedido** | De abrir a solicitação até enviá-la para aprovação |
| **Aprovação** | Da solicitação enviada até a última assinatura |
| **Cotação** | Da aprovação até o pacote ser encerrado |
| **Decisão de compra** | Do fim da cotação até o pedido sair |
| **Entrega** | Do pedido até o material chegar na obra |

A barra mais comprida aparece em **laranja**: é o gargalo, onde vale atacar primeiro.

### Só entra quem já passou

Uma solicitação só conta numa etapa **depois de passar por ela**. Misturar o que ainda está em andamento puxaria as médias para baixo e daria uma impressão boa que não existe.

Do mesmo jeito, **"Do pedido à entrega"** só conta as solicitações que chegaram **por inteiro**. Considerar a primeira entrega parcial faria o relatório dizer que a obra recebe mais rápido do que recebe.

> Se todas as etapas levaram zero dia, a tela mostra **"—"** no gargalo em vez de apontar uma etapa. Dizer "a mais demorada é X" quando nada demorou mandaria alguém arrumar o que não está quebrado.

---

## Aba 5 — Consumo: o que a empresa mais compra?

Duas tabelas:

1. **Por família** — para onde vai o dinheiro (cimento, aço, elétrica, EPI...)
2. **Os itens mais comprados** — quais materiais pesam mais, com **preço médio** pago

O preço médio é útil na hora de cotar de novo: se a proposta que chegou está muito acima do preço médio histórico, é hora de perguntar por quê.

### A fatia "Outros"

Os gráficos de rosca mostram as **quatro maiores** fatias e somam o resto em **"Outros"**, em cinza. Sem isso as porcentagens não fechariam 100% e o desenho contradiria o total escrito no meio do anel.

---

## Ver os números por trás

Todos os cartões e gráficos respondem ao **mouse** no computador e ao **toque** no celular: uma caixinha aparece explicando de onde saiu aquele número.

Quem usa leitor de tela recebe a **mesma informação em tabela**, escondida visualmente mas lida em voz alta. Nenhuma informação depende só de cor: a situação sempre vem com ícone e texto junto.

---

## Preencher o sistema com histórico de demonstração

Relatório sem histórico não mostra nada. Para ver as cinco abas com dados de verdade:

```bash
docker compose exec api npx tsx prisma/seed-historico.ts
```

Esse comando cria:

- **13 compras completas** espalhadas nos últimos 10 meses, em três obras, com fornecedores que atrasaram, entregas com ressalva e uma devolução
- **4 contratos de locação**, sendo um com o equipamento parado além do prazo
- **3 solicitações esperando aprovação**, uma em cada faixa de alçada: uma que o gestor assina sozinho, uma que exige gestor e engenheiro, e uma que sobe para o fundador

Rodar duas vezes não duplica nada: ele confere o que já existe antes de criar.

Ele **passa pela API**, uma tela de cada vez, como uma pessoa faria: assim o estoque se move, a alçada é respeitada e o número do pedido sai do mesmo contador de sempre. Só as **datas** são recuadas depois, para não ser preciso esperar meses.

> É dado de demonstração. Não rode em produção.

---

# 40. Locação de equipamentos

> Acesse por **Locação** no menu. **Veem:** Administrador, Fundador, Comprador, Gestor de obra e Almoxarife. **Contratam e devolvem:** Administrador e Comprador.

## O problema que esta tela resolve

Betoneira, andaime, compactador, gerador: não são compra, são **aluguel com relógio correndo**.

Equipamento parado no canteiro **continua contando diária**, e ninguém percebe — porque não há nada gritando. A obra terminou aquela etapa há duas semanas, o equipamento está encostado num canto, e a fatura do fornecedor continua crescendo.

Foi exatamente isso que a reunião pediu: *"colocar para alertar os itens que eles locaram no dia em que eles acham que já deve ser usado"*.

## O número que importa

A tela tem quatro cartões, mas o que interessa é o segundo:

| Cartão | O que diz |
|---|---|
| **Atrasadas** | Quantos equipamentos passaram da data de devolução |
| **Custo do atraso** | **Quanto já se pagou a mais por causa disso** |
| **Vencendo** | Quantos vencem hoje ou nos próximos 3 dias |
| **Em andamento** | Quanto os equipamentos ainda na obra já custaram |

*"A betoneira está 12 dias atrasada"* não move ninguém. *"O atraso já custou R$ 780,00"* move. Por isso o valor tem cartão próprio, em vermelho.

## Como a conta é feita

**O primeiro dia conta.** Pegar de manhã e devolver à tarde é uma diária, não zero.

**Período começado é período cobrado.** Ninguém aluga meia semana: 8 dias num contrato semanal são 2 semanas. Por isso o sistema arredonda para cima — é como o fornecedor cobra.

**A quantidade multiplica.** 400 metros de andaime a R$ 12 o metro por mês são R$ 4.800 por mês.

**O relógio para na devolução.** Enquanto o equipamento não volta, o custo sobe sozinho a cada dia.

### Um exemplo

Betoneira a R$ 65 por dia, alugada em 13/08, prevista para 10/09, ainda no canteiro em 22/09:

| | |
|---|---|
| Dias de uso | 41 |
| Já custou | R$ 2.665,00 |
| Custaria se tivesse voltado no prazo | R$ 1.885,00 |
| **Custo do atraso** | **R$ 780,00** |

## O aviso vem ANTES

O sistema avisa **3 dias antes** do vencimento, não no dia.

O motivo é prático: entre pedir a retirada e o fornecedor aparecer costuma passar alguns dias, e **cada um deles é mais uma diária**. Avisar no dia do vencimento já é tarde.

| Situação | Quando aparece |
|---|---|
| ✓ **Em dia** | Falta mais de 3 dias |
| ⚠ **Vence em breve** | Faltam 3, 2 ou 1 dia |
| ⚠ **Vence hoje** | É hoje |
| ✕ **Atrasada** | Já passou |
| ℹ **Devolvida** | Voltou para o fornecedor |
| ℹ **Cancelada** | Contrato desfeito antes de começar |

No fim da tela, **"O que fazer agora"** lista em português só o que precisa de ação, com o valor do prejuízo em cada linha.

## Registrar uma locação

Botão **+ Nova locação**. Há dois caminhos:

### Veio de um pedido de compra

A locação passa pelo **mesmo fluxo de sempre**: solicitação → aprovação → cotação → pedido. Os itens de locação já estão no catálogo como serviço da família LOC.

Se o equipamento veio por aí, escolha-o no primeiro campo (**"Veio de um pedido?"**) e o sistema preenche fornecedor, obra, equipamento, quantidade e valor sozinho. Você só informa a **data prevista de devolução**.

> Só aparecem itens de locação já comprados que **ainda não viraram contrato**. Um item de pedido vira um contrato só.

### Locação avulsa

Locação de emergência acontece. Se o equipamento já está no canteiro e não passou por cotação, deixe o primeiro campo em "Não — locação avulsa" e preencha à mão.

O sistema **não obriga ninguém a mentir** para registrar o que já existe. Mas atenção: locação avulsa não passou por pedido, então ela **não aparece** no relatório de orçado × realizado da obra. Quando dá para passar pelo fluxo, passe.

### Os campos

| Campo | O que é |
|---|---|
| **Equipamento** | O que foi alugado, em português |
| **Identificação** | Placa, número de série ou patrimônio — ajuda a achar o equipamento certo no canteiro |
| **Quantidade e unidade** | 1 betoneira, 400 metros de andaime |
| **Cobrança** | Por dia, por semana ou por mês |
| **Valor do período** | Quanto o fornecedor cobra por **cada** período |
| **Início** | Quando o equipamento chegou |
| **Devolução prevista** | **É esta data que dispara o aviso.** Sem ela não há como avisar nada |

## Devolver

Botão **Devolver** na linha do contrato. Informe a data em que o equipamento realmente voltou — é ela que **encerra a contagem das diárias**.

O sistema responde dizendo se foi no prazo ou com quantos dias de atraso, e o contrato guarda **quem registrou** a devolução.

> Devolver duas vezes não é possível. O sistema recusa.

## Cancelar

Cancelar é para o contrato que **não chegou a existir de verdade** — o equipamento nunca foi entregue, por exemplo. O contrato cancelado não custa nada e sai do resumo.

**O que já aconteceu não se cancela.** Se o equipamento esteve na obra e voltou, isso é uma devolução, não um cancelamento — e o sistema recusa cancelar o que já foi devolvido. O motivo é simples: apagar um custo que existiu faria o relatório mentir.

Cancelar exige um motivo escrito.

## Baixar

Botão **↓ Baixar**, com a mesma escolha de sempre: **PDF ou Word**. O arquivo respeita os filtros de obra e situação que estiverem na tela, e traz o resumo no cabeçalho.

---

# 41. A tela de Status do sistema

> Esta tela só aparece para o **Administrador**. Acesse por **Status do sistema** no menu.

Ela é o **painel do carro**: não leva a lugar nenhum, mas diz se o carro está em condição de andar.

## Os quatro cartões

| Cartão | O que mostra | Quando se preocupar |
|---|---|---|
| **Interface** | Se as telas estão no ar | Se você está vendo a tela, está tudo certo |
| **API** | Se o "cérebro" respondeu, a versão e há quanto tempo está ligado | Se aparecer erro, veja o capítulo 44 |
| **Banco de dados** | Se os dados estão acessíveis, com contagem de funções e usuários | Se aparecer **Sem conexão**, o banco caiu |
| **Memória da API** | Quanto está sendo usado dos 1024 MB | Acima de **800 MB** merece atenção |

> O número de usuários é o detalhe mais importante da tela: ele foi **buscado dentro do banco**. Se ele aparece, a corrente inteira está funcionando — tela, API e banco.

## O botão "Atualizar agora"

Busca os dados de novo sem recarregar a página. Enquanto trabalha, ele fica escrito *"Atualizando..."* e desabilitado — você sempre sabe que o sistema está ocupado e não clica duas vezes sem querer.

---

# 42. Integrações: o que significa "simulado"

## O que são integrações

Integração é quando nosso sistema conversa com um **serviço de fora**. Serão quatro:

| Integração | Para que serve | Etapa |
|---|---|---|
| **WhatsApp** | Avisar sobre cotações, aprovações e pedidos | 10 |
| **Fiscal (NF-e)** | Conferir a nota fiscal que o fornecedor emitiu | 13 |
| **Código de barras** | Descobrir qual produto é, na hora de bipar | 13 |
| **Pagamento** | Mandar a conta para o financeiro | 13 |

## Por que elas começam simuladas

Todas dependem de coisas que ainda não temos: contrato com a Meta, certificado digital da empresa, associação à GS1 e contrato com o banco.

Em vez de esperar, o sistema já foi construído com as quatro **prontas para receber a integração**.

> **Como entender na prática:** imagine uma tomada na parede. A tomada já está instalada. Hoje temos um aparelho de teste ligado nela. Amanhã você tira o de teste e liga o de verdade. A parede não muda.

## O que "simulado" garante

Enquanto o selo estiver **Simulado**:

- Nenhuma mensagem de WhatsApp é enviada a alguém de verdade
- Nenhum centavo se move
- Nenhum fornecedor recebe nada

O sistema registra o que **teria** enviado, para você conferir. Risco zero.

---

# 41.9. O menu de três pontinhos, e as confirmações

## Os formulários que abrem em janela

Cinco ações abrem uma **janela por cima da tela**, em vez de um bloco dentro da página:

| Onde | O quê |
|---|---|
| Financeiro | **Dar baixa** numa parcela |
| Estoque | **Retirar** e **Contar** |
| Locação | **Devolver** e **Cancelar** |

Antes, clicar nesses botões abria o formulário em outro ponto da página — às vezes acima
da tabela, às vezes abaixo dela. Quem clicava numa linha do fim da lista **não via nada
acontecer**: o formulário nascia fora da tela, e a página não se mexia.

Agora o formulário vem até você. O que estiver atrás fica escurecido e não rola.

**Para sair sem salvar:** **Esc**, o **✕** do canto, ou o botão **Cancelar**/**Voltar**.

> Se você tiver digitado alguma coisa, ele pergunta antes de jogar fora. Se não digitou
> nada, sai direto — inclusive quando o campo já veio preenchido pelo sistema, como o
> preço médio em Estoque ou a quantidade contada no ajuste.

---

## O "⋮" nas tabelas

Em tabelas com muita ação por linha — como a de **Pedidos** — só a ação principal fica à
vista. O resto está no botão **⋮**, no fim da linha.

Em Pedidos, por exemplo: "Marcar como enviado" aparece direto (quando o pedido ainda é
rascunho), e dentro do **⋮** ficam **Baixar o PDF**, **Mandar pelo WhatsApp** e **Mandar
por e-mail**.

> Isso não é para esconder: é porque quatro botões na mesma linha não cabiam, e os
> últimos saíam da tela.

## Cancelar uma nota agora pergunta antes

Antes, clicar em **Cancelar** numa nota fiscal cancelava **na hora**. Agora abre uma
janela dizendo o que vai acontecer — que a nota sai das contas a pagar e deixa de contar
no orçamento da obra — com o fornecedor e o valor à vista.

Para confirmar é preciso clicar em **"Sim, cancelar a nota"**. **Esc** ou **"Voltar sem
cancelar"** saem sem fazer nada.

---

# 42.0. Achar o caminho de volta

Toda tela do sistema mostra, no alto, **onde você está** e **como voltar**.

```
Início › Cotações › Pacote de cotação        ← Voltar para Cotações
```

À esquerda fica o caminho. Cada pedaço dele é clicável: dá para pular direto para
**Cotações** sem passar pelo meio.

À direita fica o **Voltar**, e ele diz para onde vai. Repare que é "Voltar para
Cotações", não só uma seta — você sabe onde vai parar antes de clicar.

> **Ele volta um degrau, não "para a tela anterior".** Se você abriu a equalização de
> uma cotação, o Voltar leva **àquela cotação**. Se tivesse levado "à anterior", e você
> tivesse chegado por um link ou acabado de salvar alguma coisa, ele te jogaria num
> lugar inesperado.

Três telas não têm Voltar, de propósito: a de **entrar** (não há sistema atrás dela) e
o **portal do fornecedor** (ele não tem conta nem menu aqui).

---

# 42.1. Tema claro e tema escuro

O sistema abre no **tema claro**. Se você preferir o escuro, o botão está no **rodapé do
menu da esquerda**, logo acima de "Trocar minha senha":

- Com a tela clara, ele diz **"🌙 Tema escuro"**
- Com a tela escura, ele diz **"☀ Tema claro"**

O rótulo diz o que vai **acontecer** se você clicar, não como a tela está agora.

A escolha fica **guardada no seu navegador**. Você troca uma vez e o sistema abre assim
nas próximas vezes, inclusive depois de fechar tudo.

> A escolha é **sua e só neste navegador**. Se você entrar de outro computador, ou de um
> celular, ele começa no claro de novo. Isso é de propósito: a preferência é de quem está
> olhando a tela, não da conta.

---

# 43. Glossário do fluxo de compras

| Termo | O que significa |
|---|---|
| **Solicitação** | O pedido inicial. Alguém precisa de um material e registra isso |
| **Alçada** | O valor até onde cada pessoa pode aprovar sozinha. Acima disso, sobe para alguém com mais poder |
| **BID** | Um pacote de itens enviado de uma vez só para vários fornecedores pedindo preço |
| **Cotação** | A resposta do fornecedor: preço, marca, prazo, frete e forma de pagamento |
| **Equalização** | A reunião em que se comparam todas as cotações lado a lado |
| **Última chamada** | A rodada final: os fornecedores têm uma chance de melhorar o preço |
| **Pedido** | O documento oficial enviado ao fornecedor escolhido |
| **Recebimento** | O almoxarife confere o que chegou contra o que foi pedido |
| **Entrega parcial** | Quando chega só parte do pedido. O saldo continua sendo cobrado |
| **Ressalva** | Anotação feita na nota fiscal quando algo veio errado |
| **Estorno** | O acerto formal com o fornecedor quando houve devolução |
| **Ponto de pedido** | A quantidade mínima no estoque. Ao chegar nela, o sistema avisa que é hora de comprar |
| **Família de material** | Agrupamento por tipo, como "elétrica" ou "hidráulica" |
| **GTIN** | O número do código de barras do produto |
| **Permissão** | Uma ação específica que o sistema libera ou bloqueia |

---

# 44. Quando algo dá errado

## A tela não abre

```bash
docker compose ps
```

Se `portoink-web` não estiver como *Up*, ligue novamente com `docker compose up -d`.

## "Não foi possível falar com o servidor"

As telas estão no ar, mas a API não respondeu. Veja o que ela disse:

```bash
docker compose logs api --tail 50
```

## "Sessão expirada. Entre novamente."

Normal depois de 7 dias sem usar, ou se o administrador mudou suas funções. É só entrar de novo.

## "Você não tem permissão para esta ação"

Sua função não libera aquela tela. Se você precisa dela para trabalhar, peça ao administrador para incluir a função correspondente no seu usuário.

## Bloqueado por tentativas repetidas

Você errou a senha mais de 10 vezes em 5 minutos. Espere alguns minutos e tente de novo.

## O banco aparece como "Sem conexão"

Normalmente é só o banco ainda iniciando. Espere 30 segundos e clique em **Atualizar agora**. Se continuar:

```bash
docker compose restart db
```

## Mudei um arquivo e nada aconteceu

```bash
docker compose restart api    # se mudou o backend
docker compose restart web    # se mudou o frontend
```

## Adicionei uma biblioteca nova e o sistema não acha ela

Este é um detalhe do Docker que engana muita gente. O container guarda as bibliotecas num depósito próprio que **não se atualiza sozinho** quando a imagem é reconstruída.

A solução é mandar renovar esse depósito:

```bash
docker compose up -d --force-recreate --renew-anon-volumes api
```

## Quero ver tudo que está acontecendo

```bash
docker compose logs -f
```

Para sair, aperte `Ctrl + C`.

## Quero recomeçar do zero

> **Atenção: isso apaga todos os dados salvos.**

```bash
docker compose down -v
docker compose up -d --build
```

---

# 45. Comandos de bolso

| O que você quer | Comando |
|---|---|
| Ligar o sistema | `docker compose up -d` |
| Desligar (mantendo os dados) | `docker compose stop` |
| Ligar de novo | `docker compose start` |
| Ver se está tudo no ar | `docker compose ps` |
| Ver as mensagens do sistema | `docker compose logs -f` |
| Ver quanta memória está usando | `docker stats` |
| Reconstruir após mudança grande | `docker compose up -d --build` |
| Renovar bibliotecas do container | `docker compose up -d --force-recreate --renew-anon-volumes` |
| Gerar este manual em PDF | `cd scripts && npm run tutorial` |
| Conferir o alinhamento das telas | `cd scripts && npm run auditoria` |
| Conferir os hovers e o foco | `cd scripts && npm run auditoria:hover` |
| Criar histórico de demonstração | `docker compose exec api npx tsx prisma/seed-historico.ts` |
| Aplicar migrações do banco | `docker compose exec api npx prisma migrate deploy` |

---

# 46. O que vem na próxima etapa

## Já pronto

| Etapa | Entrega |
|---|---|
| **0 — Fundação** | As três peças no ar, tomadas de integração, este manual |
| **1 — Acesso** | Login, funções múltiplas, permissões, administração de usuários |
| **2 — Cadastros** | Famílias, materiais, fornecedores, obras com orçamento e alçadas |
| **3 — Solicitação** | Abrir pedido, primeira compra, PDF e histórico |
| **4 — Aprovação** | Fila por alçada, aprovar, devolver, reprovar, assinaturas múltiplas |
| **5 — Cotação** | Pacote BID, convite por família e portal do fornecedor |
| **6 — Equalização** | Mapa comparativo, última chamada, escolha item a item e pedido de compra |
| **7 — Recebimento** | Conferência por número, entrega parcial, ressalva e devolução |
| **8 — Estoque** | Saldo por almoxarifado, custo médio, retirada, inventário e ponto de pedido |
| **9 — Fiscal** | Nota fiscal (digitada ou do XML), conferência automática e contas a pagar |
| **10 — WhatsApp** | Conexão por QR Code, lista de autorizados, convites e pedidos enviados pelo sistema |
| **11 — Relatórios** | Orçado × realizado, economia das cotações, desempenho do fornecedor, tempo do processo, consumo, e download em PDF ou Word |
| **12 — Locação** | Contrato de locação, custo por diária/semana/mês, alerta de equipamento parado e devolução |

> **O copiar e colar acabou.** O convite da cotação e o PDF do pedido saem de dentro do
> sistema, e tudo o que sai fica registrado — inclusive o que foi bloqueado.

> **Revisão visual de todas as telas: concluída.** As 33 telas foram medidas uma a uma —
> alinhamento, tamanho de alvo de toque, rolagem horizontal, contraste e retorno visual ao
> passar o mouse. A régua ficou guardada em `scripts/auditoria-ui.mjs` e pode ser rodada de
> novo a qualquer momento.

## Instalar em uma máquina nova

O sistema já sobe do zero sem ninguém precisar lembrar de nada. Numa máquina com Docker:

1. `docker compose up -d` — sobe banco, API e telas
2. `docker compose exec api npm run prisma:migrate` — cria as tabelas, as funções e as
   permissões
3. Crie o primeiro administrador:

```
docker compose exec api npm run criar-admin -- \
  --nome "Maria Souza" --email maria@suaempresa.com.br
```

O comando **sorteia uma senha e mostra na tela uma única vez**. Anote. No primeiro
acesso o sistema obriga a trocá-la — nem quem instalou fica sabendo a senha com que a
pessoa vai trabalhar.

> Se o sistema já tiver administrador, o comando se recusa a rodar e manda usar a tela de
> Administração, que registra quem criou quem. Ele existe para o caso em que não há
> ninguém para entrar.

## Cópia de segurança

```
cd scripts
npm run backup
```

Grava em `backups/portoink-<data>-<hora>.dump`. Roda de dentro do container do banco:
não exige ter o Postgres instalado na máquina.

Para voltar uma cópia:

```
npm run restaurar -- --arquivo backups/portoink-2026-09-23-1049.dump --confirmo
```

> **Isto apaga o banco atual.** Por isso o `--confirmo` é escrito à mão: ninguém restaura
> por engano apertando a seta para cima no terminal. Para **conferir** uma cópia sem
> risco nenhum, restaure em um banco separado com `--banco portoink_conferencia`.

## O que o sistema confere sozinho

| Onde | Quantas provas | O que garantem |
|---|---|---|
| Regras (backend) | 637 | Alçada, estoque, recebimento, cálculo de locação, geração de PDF e Word |
| Telas (frontend) | 35 | Quem vê o quê no menu, envio de solicitação sem duplicar, alçada na tela de aprovação, custo do atraso na locação, escolha de PDF ou Word |

```
docker compose exec api npm test    # as regras
docker compose exec web npm test    # as telas
```

> As provas de tela **não medem aparência**: elas conferem comportamento. Alinhamento,
> espaçamento e contraste continuam sendo medidos pela régua em
> `scripts/auditoria-ui.mjs` (`npm run auditoria`).

## A seguir

Nada de obrigatório. O módulo 1 está fechado e o esqueleto está pronto para receber o
módulo 2.

## Finalização (sem data)

Ligar as integrações de verdade e instalar num servidor **não é etapa**: não espera
código que falte aqui, espera uma decisão da direção — e não há data marcada.

- WhatsApp, nota fiscal, código de barras e banco ligados de verdade
- Sistema instalado no servidor definitivo — é aqui que entra a decisão de **nuvem ou
  servidor na construtora**
- Treinamento da equipe

> Até lá os quatro adaptadores continuam em `mock`: **nada sai do sistema para fora**.
