<!-- versao: 0.59.0 -->

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

Enquanto o sistema está em desenvolvimento, existem contas prontas com os nomes das pessoas da reunião. **São duas senhas, e a tabela diz qual é a de cada uma.**

| Pessoa | E-mail | Senha | Função no sistema |
|---|---|---|---|
| **DEV-Porto** | **porto@dev.com** | **`admin123`** | **Os sete papéis de uma vez** |
| Administrador | admin@portoinc.com.br | `admin123` | Administrador |
| Washington | washington@portoinc.com.br | `Porto@2026` | Fundador |
| Andre | andre@portoinc.com.br | `Porto@2026` | Comprador |
| Bras | bras@portoinc.com.br | `Porto@2026` | Gestor de obra + Solicitante |
| Gilson | gilson@portoinc.com.br | `Porto@2026` | Almoxarife |
| Neilma | neilma@portoinc.com.br | `Porto@2026` | Comprador + Solicitante |
| Engenheiro | engenheiro@portoinc.com.br | `Porto@2026` | Engenheiro |

> **As duas de cima são a exceção.** Esta página dizia "todas usam a mesma senha" até
> 09/10/2026, e era falso: a conta do administrador nunca usou `Porto@2026`.

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

**Sobre o zoom:** você pode aproximar com dois dedos o quanto quiser — para ler um número
pequeno, por exemplo. O que não dá é **afastar** além do tamanho da tela; antes isso
deixava a página pequena no meio do visor, com faixa branca do lado.

As telas foram medidas de 360px (Android comum) a 430px (iPhone Pro Max). O aparelho de
referência do projeto é um **iPhone 14 Pro**, de 393px.

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

A tela inicial fala do **seu trabalho de hoje**, e só disso. Ela já teve, no rodapé, um aviso sobre as etapas do projeto e sobre as integrações estarem em modo de teste — foi retirado em 10/10/2026. Aquilo era assunto de quem constrói o sistema, não de quem abre a tela para trabalhar.

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
4. Marque **uma ou mais funções**
5. Clique em **Cadastrar usuário**

**Você não escolhe a senha de ninguém.** Ao salvar, aparece um **link** no alto da
tela. Copie e mande para a pessoa como preferir — WhatsApp, e-mail, pessoalmente. Ela
abre o link e escolhe a senha dela.

| | |
|---|---|
| **Quem sabe a senha** | Só a própria pessoa. Nem você |
| **Quanto tempo o link vale** | 7 dias |
| **Quantas vezes abre** | Uma. Depois de usado, morre |
| **Perdeu o link?** | Clique em **Redefinir senha** na linha dela e gere outro |

> ⚠️ **O link aparece uma vez só.** Ele não fica guardado em lugar nenhum — o sistema
> guarda apenas um resumo dele, que não dá para desfazer. Se você recarregar a tela
> antes de copiar, gere outro em **Redefinir senha**.

### Por que mudou

Até 10/10/2026 você digitava uma senha provisória e mandava para a pessoa. Funcionava, e
tinha um problema que nenhuma senha boa resolve: **durante o caminho, duas pessoas sabiam
a senha de uma conta** — e a primeira não era a dona. Com o link, isso acaba.

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
| R$ 800 | Precisa de 1 assinatura: Gestor de obra. |
| R$ 7.500 | Precisa de 2 assinaturas: Gestor de obra e Engenheiro. |
| R$ 42.000 | Precisa de 1 assinatura: Fundador. |

A conjunção é a regra inteira: **e** quer dizer que as duas assinam; **ou** quer dizer que qualquer uma das duas resolve.

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

### Se a obra não tiver orçamento cadastrado

A lista de linhas vem vazia e o modal avisa em amarelo, logo abaixo da obra. **Leia o aviso**, porque o estrago é silencioso e definitivo:

> Os itens nascem **sem vínculo** com o orçamento, e **não dá para amarrar depois** — nem corrigindo o rascunho pelo Editar, nem criando o orçamento em seguida. A compra fica fora do relatório de orçado x realizado para sempre.

Dá para seguir assim: só aquele relatório fica cego a esta compra. Mas se for para vincular, alguém com perfil de **Administrador** precisa cadastrar o orçamento em **Cadastros → Obras** **antes** de você salvar a solicitação.

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

Quem enxerga todas ganha também o filtro **Quem pediu**, ao lado do de Situação: em *"Todo mundo"* por padrão, ou *"Só as minhas"*.

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

É o terceiro cartão da fileira, ao lado de *Total estimado* e *Precisa até*. Ele responde, **antes** de você enviar, quantas assinaturas a compra precisa e de quem:

```
Quem aprova
2 assinaturas
Gestor de obra e Engenheiro
```

A conjunção é a regra inteira: **e** quer dizer que as duas assinam; **ou** quer dizer que qualquer uma resolve.

Depois de enviada, o mesmo cartão acompanha o andamento — você não precisa descer até a tabela de Assinaturas para saber o que falta:

| O cartão diz | Quer dizer |
|---|---|
| `2 assinaturas` · Gestor de obra e Engenheiro | ninguém assinou ainda |
| `1 de 2 assinaturas` · Falta assinar: Engenheiro | metade do caminho |
| `Assinada` · Por Marcos Teste e Ana Teste | completo |
| `Reprovada` · Por Ana Teste, Engenheiro | parou aqui |
| `Devolvida` · Por Marcos Teste, Gestor de obra | voltou para revisão |
| `Sem faixa` | **nenhuma faixa de alçada cobre este valor** — avise o administrador |

Assim você já sabe a quem cobrar, e entende por que um pedido de R$ 42 mil demora mais que um de R$ 800.

## Corrigir um rascunho

O botão **✏️ Editar** abre o mesmo formulário da criação, com tudo já preenchido. Dá para trocar obra, prazo, justificativa, observações e os itens.

Ele só aparece para **o autor** e só enquanto a solicitação for **rascunho ou estiver em revisão**.

> **Quando você mais vai precisar dele:** o envio é recusado quando um item de primeira compra está sem especificação técnica. Corrija por aqui e envie de novo — não precisa cancelar e refazer.

## Enviar para aprovação

O botão **Enviar para aprovação** só aparece para o autor, e só enquanto a solicitação for rascunho ou estiver em revisão.

Depois de enviada, ela **não pode mais ser alterada** — nem pelo Editar. Isso é proposital: o aprovador precisa decidir sobre um documento que não muda embaixo dele.

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

## São dois passos, nesta ordem

**1. Convidar.** Confira as marcações e clique em **📨 Convidar 2 fornecedores** — o botão azul embaixo da tabela. Eles passam para `Já convidado` e aparecem na seção **Convidados**.

**2. Abrir.** Aí o botão **🔒 Abrir cotação**, no topo, fica disponível.

> Enquanto não houver ninguém convidado, o botão de abrir fica **desligado**, com o motivo escrito ao lado. Não adianta abrir uma cotação que ninguém vai responder.

## O que "abrir" faz — e o que ele NÃO faz

1. Marca as solicitações de origem como **Em cotação**
2. Fecha o pacote para mudança de itens e de convidados
3. Libera os botões de convite por WhatsApp e e-mail

**Abrir não manda mensagem nenhuma.**

Antes mandava, sozinho, no momento em que você clicava. Duas coisas erradas nisso: ninguém espera que *abrir* faça algo sair da empresa, e quem abre ainda não conferiu quem vai receber.

Agora são atos separados. **Um botão, um trabalho.**

> O **link único de cada fornecedor** nasce antes, quando você o convida para o pacote — não ao abrir. Por isso dá para copiar o link e mandar do seu jeito mesmo sem usar os botões de envio.

## A confirmação antes de mandar

Clicando em **Convidar pelo WhatsApp** ou **Convidar por e-mail**, aparece uma janela com **a lista de quem vai receber**:

```
Enviar convite pelo WhatsApp
O convite da BID-00003 sai agora para quem está na lista.

Constrular              +55 (48) 9000-0004
Marquilip               +55 (48) 9000-0001

⚠ Envio restrito. Só recebe quem estiver na
  lista de números liberados, em Avisos.

              Cancelar    💬 Enviar 2 convites
```

Ela não pergunta só *"tem certeza?"*. Uma janela dessas vira quebra-molas: em três dias a pessoa clica em **Sim** sem ler.

O que ela faz é mostrar **o que dá para conferir**:

- **quem vai receber**, com o contato de cada um — porque o erro real não é o clique acidental, é o fornecedor errado na lista
- **quem não tem contato cadastrado**, que aparece como *"sem WhatsApp cadastrado"* e não recebe
- **o aviso do envio restrito antes**, e não depois. Sem ele, você só descobre que foi bloqueado quando a mensagem não chegou em ninguém

O botão diz o que faz — *Enviar 2 convites*, com o número — e o texto continua o mesmo do começo ao fim: você clica em **Convidar**, confirma **Enviar convite**, e recebe **"2 de 2 convites enviados"**.

> A mesma janela aparece nos dois botões do **pedido de compra**, avisando que o PDF vai em anexo.

> Na **última chamada** não há janela: aquele painel já pede prazo e recado, e já é a parada consciente. A lista de quem vai receber aparece ali dentro, logo acima do botão. Duas confirmações seguidas ensinam a pessoa a parar de ler.

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
| **Condições** | Duas perguntas: *"Você cobra frete?"* e *"Como você quer receber?"* |

## Cada item é uma pergunta só

O item mostra o que a Porto Inc. pede — código, descrição, quantidade, especificação — e embaixo **um campo grande, o preço**:

```
2 de 2                                        00002
Argamassa colante AC-II saco 20kg
60 SC
┌──────────────────────────────────────────────────┐
│  Argamassa AC-II, ABNT NBR 14081, saco de 20 kg  │
└──────────────────────────────────────────────────┘

Seu preço por SC
┌────────────────────────────┐
│ R$                   26,00 │
└────────────────────────────┘
60 SC × R$ 26,00 = R$ 1.560,00

Marca          Modelo         Entrega em (dias)
[Votomassa]    [        ]     [ 3 ]

☐ Não trabalho com este item
```

**A conta aparece embaixo do preço enquanto ele digita.** É o que faz a tela parecer um orçamento e não um formulário — e é onde erro de casa decimal salta aos olhos antes de virar proposta.

Marca, modelo e prazo são **opcionais** e ficam menores de propósito: ajudam o comprador, mas não travam ninguém.

## O preço tem máscara

Digitando `510000`, o campo escreve **R$ 510.000,00**. Sem os pontos de milhar, R$ 5.100 e R$ 51.000 são a mesma mancha na tela — e a diferença é a proposta inteira.

A vírgula abre os centavos; o ponto é sempre milhar. Ao sair do campo, os centavos se completam sozinhos.

## A barra que não sai da tela

No pé da página fica preso o **total da proposta** e o botão de enviar. Ele acompanha cada tecla.

Enquanto faltar o preço de algum item, o botão fica desligado e a barra diz quantos faltam.

## "Não trabalho com este item"

Cada item tem essa caixa, **no fim** do bloco — em voz baixa, porque a resposta comum é o preço, não a recusa. Ao marcar, os campos somem e o item fica apagado, com um botão para voltar atrás.

> Sem essa opção, o fornecedor que não trabalha com um item teria que inventar um preço ou desistir da cotação inteira.

## O que ele NÃO vê

Este é o ponto mais importante da tela:

- ❌ Quem mais foi convidado
- ❌ Quantos fornecedores estão cotando
- ❌ Qualquer preço de concorrente
- ❌ Qualquer outra informação da Porto Inc.

Ele enxerga **apenas o próprio convite**.

## Ele confere antes de enviar

Quando o fornecedor toca em **Enviar cotação**, nada sai ainda: abre uma janela de
conferência com o resumo do que ele digitou — cada item com a quantidade, o preço unitário,
o total daquela linha, e o total geral embaixo.

Ele escolhe entre **Voltar e corrigir**, que devolve o formulário preenchido, e
**Confirmar e enviar**, que manda.

> **Por que a janela existe.** Ela não pergunta só *"tem certeza?"* — janela assim vira
> quebra-molas, e em três dias a pessoa clica em "Sim" sem ler. O corpo dela é a conta,
> que é a única coisa que dá para conferir. E ela é a **última chance**: um dígito errado,
> R$ 5.100,00 no lugar de R$ 51,00, vira proposta comercial depois do envio.

## A resposta enviada é final

Depois de enviar, abrir o mesmo link **não** traz o formulário de volta. Aparece uma tela
verde com *"Você já enviou a sua cotação, muito obrigado!"* e o comprovante do que ele
mandou: data e hora, quantos itens e o total.

> **Por que travou.** Até 10/10/2026 o fornecedor podia reabrir o link e mudar o preço
> enquanto o prazo corresse — era o passo *"Rever Cotação"* do fluxo da Porto Inc. Só que
> o preço dele já entrou na comparação com os concorrentes: mudar depois desfaz a
> comparação sem ninguém ficar sabendo.

**Quem destrava é o comprador.** A **última chamada** reabre o pacote numa rodada nova, e
o link volta a aceitar resposta sozinho — é justamente dela que o fornecedor recebe o
convite para rever o preço. É assim que o passo *"Rever Cotação"* continua existindo, agora
com a Porto Inc. decidindo quando ele acontece.

## Quando o link para de funcionar

| Situação | O que o fornecedor vê |
|---|---|
| Link errado ou incompleto | *"Este link não é válido"* |
| Prazo vencido | *"O prazo já encerrou. Fale com o comprador"* |
| Cotação encerrada | *"Esta cotação não está mais aberta"* |
| **Já respondeu nesta rodada** | *"Você já enviou a sua cotação, muito obrigado!"*, com o comprovante |

Todas as mensagens dizem o que fazer, e nenhuma expõe detalhe técnico.

> A última é a única que **não** aparece em vermelho. Quem reabre o link depois de responder
> quase sempre está conferindo se deu certo — alerta vermelho em resposta a um acerto ensina
> a pessoa a desconfiar de uma tela que está certa.

---

# 21. Equalização: comparando as propostas

Esta é **a tela onde o dinheiro é decidido**. Todos os fornecedores aparecem lado a lado, item por item, e o melhor preço de cada linha vem destacado.

## Como chegar

Menu **Compras → Cotações** → abra a cotação → botão **📊 Equalizar e escolher**.

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

## Quanto pagamos da última vez

Embaixo da descrição de cada item, quando o material já foi comprado antes, aparece:

> *Última compra: R$ 18,50 em 12/08/2026*

É a pergunta número um de quem compra, e o sistema tinha a resposta guardada sem mostrar para ninguém.

Na validação de 28/09/2026 uma compra fechou **56% abaixo** do que o solicitante tinha estimado. Ele teria acertado o chute se soubesse o preço da última vez — e o comprador teria sabido, na hora de escolher, que a proposta era boa de verdade.

O número vem do **último pedido** daquele material, seja de qual fornecedor for, ignorando pedidos cancelados. Material comprado pela primeira vez não mostra linha nenhuma.

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

O botão fica **embaixo da tabela**, junto do "Salvar escolhas". É onde o trabalho termina:
num pacote grande você desce escolhendo item a item, e seria ruim ter de voltar ao topo
para guardar o que acabou de fazer.

## Quando dois fornecedores empatam

Acontece: dois cotam exatamente o mesmo preço num item. Nesse caso **as duas células ficam
verdes**, as duas dizem *"melhor preço"*, e o cabeçalho conta o item para os dois.

É de propósito. A tela está dizendo *"empatou, a escolha é sua"* — e aí você decide pelo que
o preço não mostra: prazo de entrega, marca, quem costuma cumprir.

O atalho **Aceitar todos os melhores preços** precisa marcar um só, e nesse caso ele marca
**quem entrega mais rápido**. Você pode clicar na outra célula e trocar.

> **Por que isto é importante.** Até 10/10/2026 o sistema tratava quem perdia o empate como
> se estivesse mais caro — aparecia como "atrás", igualzinho a um fornecedor 87% acima. Pior:
> a **última chamada** usava essa conta, e mandaria para o empatado a frase *"recebemos
> propostas melhores nestes itens"*, pedindo que ele baixasse um preço que já era o mais
> barato. Estar empatado no melhor preço não é estar atrás de ninguém.

## Preço não é tudo

Abaixo do mapa fica o quadro **Condições comerciais**, com o que cada fornecedor ofereceu de pagamento, frete e validade da proposta.

> Um fornecedor R$ 300 mais caro que parcela em 3x pode ser melhor para o caixa da obra do que um mais barato à vista. O sistema mostra os dois lados — **a decisão é sua**.

### Prazo médio: comparando maçã com maçã

Cada fornecedor mostra o **prazo médio de pagamento**: em quantos dias, na média, o dinheiro sai do caixa.

Não é o prazo da última parcela. É a média **ponderada**: a entrada pesa no dia 0, e cada parcela no dia em que vence.

| Proposta | Prazo médio |
|---|---|
| Tudo na entrega | **À vista** |
| 3x a cada 30 dias | **60 dias** (vence em 30, 60 e 90) |
| 30% de entrada + 2x de 30 dias | **31,5 dias** |

Fornecedor que informou parcelas **sem dizer o intervalo** aparece com **—**: o sistema não inventa 30 dias para ele, porque isso seria colocar palavra na boca de quem cotou.

### Custo do dinheiro: transformando prazo em reais

No alto do quadro há a caixa **Custo do dinheiro**, que começa em **Não considerar**.

Escolhendo uma taxa — 0,5%, 1%, 1,5%, 2%, 2,5% ou 3% ao mês —, cada fornecedor passa a mostrar quanto a proposta dele **equivale à vista**:

> **R$ 9.700,00** — R$ 300,00 a menos que R$ 10.000,00, pelo prazo

A conta é simples e de propósito: *total × taxa ÷ 100 × dias ÷ 30*. Desconto simples, não juro composto — em 60 dias a diferença é de centavos, e a conta precisa ser explicável para quem vai assinar.

**Por que começa em zero.** Cada empresa tem um custo de dinheiro diferente: depende do capital de giro, do limite no banco, da taxa que ela paga. Enquanto a Porto Inc. não disser qual é o dela, o sistema **não arbitra nenhum número** — mostra só o prazo em dias. Quem definir a taxa, escolhe na caixa; a escolha fica guardada no navegador e vale para as próximas cotações.

> O "equivale à vista" só aparece para quem cotou o **pacote inteiro**. Fornecedor que cotou metade não tem total para descontar.

### 100% de entrada não tem parcela

Se um fornecedor tentar responder **100% de entrada** e ao mesmo tempo **5x a cada 30 dias**, o portal recusa e explica.

As duas coisas não existem juntas. O sistema aceitou essa combinação uma vez, e o prazo médio leu aquilo como "à vista", engolindo as cinco parcelas sem avisar ninguém.

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

> Olá, Eletro Minas!
>
> ÚLTIMA CHAMADA — a Porto Inc. reabriu o prazo.
> EPI — Residencial Aurora
>
> Recebemos propostas melhores nestes itens:
> - 00131 Capacete de segurança classe B (40 UN)
> - 00134 Luva de raspa cano curto par (120 PR)
>
> Toque no cartão acima para rever seu preço.
> Novo prazo: 15/10/2026.
>
> https://.../p/Xk3mQ9pL2vTz

> **A quantidade vai junto, e não é enfeite.** Um pacote agrupa solicitações de obras
> diferentes, então o mesmo material aparece em várias linhas — 20, 100 e 400 rolos do
> mesmo cabo. Sem a quantidade, o fornecedor recebia a mesma frase repetida três vezes e
> não sabia qual rever.

Quem está na frente em tudo recebe outro texto, sem lista nenhuma: *"Sua proposta está com
o melhor preço em todos os itens. Se quiser revisar algo, toque no cartão acima."*

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
| **O preço que fechou ainda cabe na alçada aprovada** | A assinatura foi dada sobre uma estimativa |

Se algo estiver faltando, ele **lista exatamente o que falta** em vez de dar um erro genérico.

## A alçada é conferida DUAS vezes

Esta é a conferência mais importante, e ela não existia.

A alçada é decidida quando a solicitação é **enviada**, em cima do valor que o solicitante
**estimou**. Só que entre a estimativa e a compra passam dias, e o preço muda.

Na prática, quem assinasse uma solicitação de R$ 1.900 estava autorizando **qualquer
valor**: se a cotação fechasse em R$ 8.000, o pedido saía do mesmo jeito, com a assinatura
de quem só podia até R$ 2.000. A assinatura virava formalidade.

Agora, na hora de gerar os pedidos, o sistema compara o **preço real** com o que foi
aprovado:

| O que aconteceu | O que o sistema faz |
|---|---|
| Fechou **mais barato** | Segue. Quem assinou tinha poder de sobra |
| Fechou até **20% acima** | Segue. Material varia de preço, e isso é normal |
| Fechou acima de 20% **mas na mesma faixa** | Segue. Quem assinou já podia autorizar esse valor |
| Fechou acima de 20% **e mudou de faixa** | **Trava.** A solicitação volta para Aprovações |

Quando trava, o sistema diz qual solicitação, quanto foi estimado, quanto fechou e quem
precisa assinar agora. **Suas escolhas continuam salvas** — depois de assinada, é só
clicar em Gerar pedidos de novo.

> **As assinaturas antigas são apagadas.** Elas foram dadas sobre outro valor. Deixá-las
> de pé faria a solicitação voltar já assinada, e a volta não serviria de nada.

> **O frete fica fora dessa conta.** A alçada foi decidida sobre os materiais; misturar
> as duas coisas travaria compra por causa da entrega.

> **Os 20% são ajustáveis** — hoje estão escritos no sistema, em `TOLERANCIA_DE_ALCADA`.
> Se a Porto Inc. achar o número apertado ou frouxo demais, é uma linha.

## Um pedido por fornecedor

Se você dividiu a compra entre dois fornecedores, saem **dois pedidos** — cada um com o seu número, o seu frete e as suas condições de pagamento.

É assim que o mundo real funciona: cada fornecedor recebe o documento só da parte dele.

## A tela de Pedidos

Menu **Compras → Pedidos**. Mostra número, fornecedor, cotação de origem, quantidade de itens, total, condição de pagamento e situação.

| Situação | Significa |
|---|---|
| **Rascunho** | Gerado, ainda não enviado ao fornecedor |
| **Enviado** | Já foi para o fornecedor |
| **Confirmado** | O fornecedor confirmou |
| **Cancelado** | Cancelado |

## Abrir o pedido

Botão **Abrir** na linha. A tela do pedido mostra tudo que o PDF mostra, e mais:

**De onde veio** — a corrente inteira da compra, com os números clicáveis:

```
Alguém pediu        O mercado respondeu      Fechamos com
SOL-00003     →     BID-00001           →    Marquilip
                    Laje 3º pavimento         19.131.243/0001-97 · São Paulo/SP
```

É a resposta a *"por que compramos isto, deste fornecedor, por este preço"* — e esta é a única tela do sistema que fecha esse caminho. Clique em qualquer número para voltar no tempo.

**Itens do pedido** — com marca, modelo, norma técnica e a obra de cada linha, mais o fecho: itens, frete, outros custos e total.

**Para quem vai** — razão social, CNPJ, e-mail, WhatsApp e quando o pedido foi enviado.

As ações ficam todas no topo: **Marcar como enviado**, **Baixar o PDF**, **Mandar pelo WhatsApp** e **Mandar por e-mail**.

## O PDF do pedido

Botão **📄 PDF**, na linha ou dentro do pedido. O arquivo traz dados da Porto Inc. e do fornecedor, itens com preço e prazo, totais com frete, condição de pagamento e local de entrega.

> A tela e o PDF leem **do mesmo lugar** no servidor. Se um mostrar um total, o outro mostra o mesmo — é o mesmo documento, e o fornecedor recebe uma cópia dele.

E traz, em destaque:

> **IMPORTANTE: informe o número PC-00001 na nota fiscal e na entrega.**

## Por que esse número importa tanto

Ele é a **chave do recebimento**. Quando o material chegar na obra, o almoxarife vai procurar esse número para comparar o que chegou com o que foi pedido. Sem ele, a conferência vira adivinhação.

> É a ponte entre a Etapa 6 e a Etapa 7.

---

# 24. Recebimento: conferir o que chegou

O caminhão parou no portão. Esta é a tela que decide se o material entra, e é a única do sistema pensada para ser usada **em pé, com pressa**.

## Como chegar

Menu **Almoxarifado → Recebimento**. É a tela inicial de quem tem a função de **Almoxarife**.

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
| **Item** | O código, o nome, a marca e a unidade |
| **Saldo** | **O que o fornecedor ainda deve** |
| **Recebido agora** | Quanto você está contando nesta entrega |
| **Devolvido** | O que voltou no caminhão |
| **Como chegou** | Chegou certo, com ressalva ou devolvido |

> **Saldo é a coluna que importa.** Ela responde a única pergunta que interessa no portão: *ainda falta alguma coisa?*

Embaixo do saldo, em letra miúda, vem a conta que deu nele:

```
    Saldo
      4
Pedido 40 · Recebido 36
```

Foram pedidos 40, já entraram 36 em entregas anteriores, faltam 4.

> **Por que não são três colunas separadas.** Eram, até a versão 0.36.0. Só que
> *Pedido* e *Já recebido* são consulta — ninguém digita neles — e ocupavam tanto
> espaço quanto a coluna onde se trabalha. No celular cada item virava sete blocos
> empilhados, e conferir um único material dava mais de uma tela de rolagem.

## Bipar o material

O segundo campo — **Bipar ou digitar o código do material** — procura o item dentro do pedido e:

1. Destaca a linha
2. Já preenche a quantidade com o saldo

Depois é só corrigir se tiver vindo menos. Ele aceita o **código de barras** do material ou o **COD PORTO**.

Se o código não estiver naquele pedido, o sistema avisa: provavelmente é material de outro pedido.

## Atalhos

| Botão | O que faz |
|---|---|
| **Preencher com o saldo** | Preenche todas as linhas com o saldo. **Não registra nada** — você confere e registra no fim da página |
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

## Quem pediu fica sabendo

Registrar o recebimento **avisa a solicitação** que deu origem à compra:

| O que chegou | O que acontece com a solicitação |
|---|---|
| Uma parte | Continua **Em cotação**, e o histórico ganha a linha *"Chegou parte do material… ainda falta item"* |
| Tudo | Passa para **Atendida**, e o histórico diz *"Tudo que foi pedido chegou e foi conferido no almoxarifado"* |

Isso parece pequeno e é o contrário disso. Antes, a solicitação ficava **"Em cotação" para sempre**: o material chegava, entrava no estoque, virava nota fiscal e virava conta paga — e a tela de quem pediu continuava dizendo que estava em cotação.

O comprador sabia, o almoxarife sabia, o financeiro sabia. **Só quem pediu não sabia** — que é exatamente a queixa número um de quem controla compra por planilha.

> **Atendida é o fim da vida da solicitação.** Dali ela não volta para lugar nenhum.

## "É o que eu pedi": a segunda conferência

Quando a solicitação fica **Atendida**, quem a abriu vê um botão novo: **✓ É o que eu pedi**.

São **duas conferências diferentes**, e o fluxo da Porto Inc. pede as duas:

| Quem | Confere o quê |
|---|---|
| **Almoxarife** | Se chegou a **quantidade** certa, e se veio danificado |
| **Quem pediu** | Se chegou a **coisa** certa — a marca, a bitola, a resistência |

O almoxarife conta sacos; ele não tem como saber se o cimento é CP-II-Z-32 ou se serve para a laje. Quem pediu sabe.

**Não trava nada.** O material já está no estoque e a nota já virou conta a pagar. É o registro que responde, três meses depois: *"mas alguém conferiu isso?"*. Fica no histórico com nome e hora.

> Quem supervisiona solicitações também pode confirmar — solicitante de férias não pode travar o registro.

## Serviço não entra no estoque

Item cadastrado como **serviço** é conferido normalmente, mas **não gera saldo** no almoxarifado.

Faz sentido quando se pensa: não há o que guardar numa prateleira. Uma instalação elétrica contratada, se entrasse no estoque, apareceria depois no relatório de **Estoque parado** como dinheiro encostado — num item que não existe fisicamente.

O filtro é por item, não por pedido: um pedido com cimento e mão de obra dá entrada no cimento e ignora a mão de obra.

---

# 25. Entrega parcial, ressalva e devolução

Este capítulo é o coração da Etapa 7. O material raramente chega exatamente como foi pedido.

## Chegou só uma parte

Preencha só o que chegou e registre. O sistema:

- Guarda o que entrou
- **Mantém o resto no saldo**
- Deixa o pedido como **Recebido em parte**

Quando o restante chegar, é só abrir o mesmo pedido de novo: embaixo do **Saldo** a linha miúda mostrará quanto já entrou, e o saldo em si, o que ainda falta.

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

Menu **Almoxarifado → Estoque**. Quem tem `estoque.ver` enxerga — almoxarife, comprador, engenheiro, gestor de obra e fundador. Só quem tem `estoque.movimentar` (almoxarife e administrador) pode dar baixa.

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

Menu **Almoxarifado → Estoque** → botão **Ver extrato**.

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

Menu **Financeiro → Notas fiscais**. Quem tem `financeiro.ver` enxerga (comprador, fundador, administrador); só quem tem `financeiro.gerenciar` lança.

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

> E a conta das primeiras é arredondada **para baixo**, de propósito. Arredondando para o mais próximo, as primeiras podiam somar mais que o total e a última virava **negativa** — R$ 10,00 em 60x gerava uma parcela de R$ -0,18. Conta a pagar negativa envenena todo relatório que a soma.

Nota sem pedido vinculado vira **parcela única, à vista**.

## A tela

Menu **Financeiro → Contas a pagar**. Ela foi montada para responder cinco perguntas, nesta ordem:

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

Doze meses, com o mês escolhido **no meio**: os **5 anteriores** e os **6 seguintes**.
O mês atual fica destacado com uma faixa azul.

Cada coluna empilha três cores:

| Cor | O que é |
|---|---|
| 🟩 Verde | **Pago** — dinheiro que já saiu, no mês em que saiu |
| 🟥 Vermelho | **Vencido** — devia ter saído e não saiu |
| 🟨 Amarelo | **A vencer** — o que está programado |

> Repare: a parcela paga conta no mês em que **o dinheiro saiu**, não no mês do vencimento. É isso que transforma o gráfico em fluxo de caixa de verdade.

Olhando as colunas da direita, dá para ver quanto o mês que vem já está comprometido — antes de assumir compromisso novo.

### Olhando um mês que já passou

No canto direito do gráfico há três controles:

| Controle | O que faz |
|---|---|
| **‹** e **›** | andam **um mês** por toque |
| **setembro de 2026** | abre o calendário do seu aparelho e salta direto para qualquer mês |
| **Hoje** | volta para o mês atual |

**O botão "Hoje" só aparece depois que você sai do mês atual.** Botão que não faz nada
ensina a ignorar os que fazem.

**A seta ›  fica desligada quando você está em hoje.** Não dá para avançar para o mês que
vem: ele ainda não aconteceu, e só mostraria colunas vazias — o que pareceria dado
perdido.

> **Só o gráfico muda.** Os números do topo, a rosca, a pontualidade e os rankings
> continuam falando de hoje. Isso é de propósito: assim você compara um mês antigo com a
> situação atual, em vez de trocar a tela inteira de época.

Uma coisa que o gráfico **não** faz, e é bom saber: mudar o período não muda o que é
"vencido". Uma parcela atrasada continua vermelha mesmo quando você olha um mês em que
ela ainda estava em dia. Quem decide o que está vencido é **hoje**, não o mês que você
está olhando — senão o gráfico mentiria sobre a situação atual.

### No celular

O gráfico mostra o nome do mês **de três em três** (jun/26, set/26, dez/26, mar/27). As
doze barras continuam lá; só os rótulos é que saem, porque doze nomes não cabem na
largura de um telefone.

**O mês atual aparece sempre**, mesmo fora dessa contagem.

Para saber o mês e o valor exatos de qualquer barra, **toque nela**.

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
| **Valor pago** | Já vem com o que falta. Mude se pagou a menos ou a mais |
| **Forma de pagamento** | PIX, boleto, transferência |

A mesma parcela **não é paga duas vezes** — o sistema barra.

## Pagou menos? O sistema pergunta o que aconteceu

Se o valor for **menor** que o que falta, aparece a pergunta:

> **Está faltando R$ 500,00 para quitar esta parcela. O que aconteceu?**
>
> ☐ **Paguei só uma parte.** O restante continua em aberto.
> ☐ **Foi desconto.** A parcela fica quitada e a Porto Inc. não deve mais nada dela.

São coisas opostas, e a diferença é dinheiro:

- **Parte** → a parcela **continua aberta** pelo saldo. Numa de R$ 1.000 com R$ 300 pagos, o painel mostra R$ 700 ainda devidos, e o botão **Dar baixa** continua lá para quando o resto sair.
- **Desconto** → a parcela **fecha**. A diferença fica registrada, e a dívida acaba ali.

> **Por que essa pergunta existe.** Até 10/10/2026 qualquer valor fechava a parcela — o sistema tratava todo pagamento menor como desconto. Numa varredura do financeiro, pagar R$ 1,00 numa parcela de R$ 634,80 apagou R$ 633,80 da dívida: a parcela saiu do "em aberto", sumiu da previsão de caixa, e nenhum aviso apareceu. A empresa só descobriria quando o fornecedor ligasse cobrando — e, numa obra, fornecedor não pago para de entregar.

Pagando **a mais** (juros, multa), a parcela quita e a diferença fica anotada. Aí não há pergunta: só um aviso dizendo quanto passou.

## A condição de pagamento não entra pela metade

Três momentos barram condição incompleta, e sempre com a mesma regra:

| Onde | Quando |
|---|---|
| **No portal do fornecedor** | Na hora de ele enviar a cotação |
| **Ao gerar os pedidos** | Última chance de corrigir, antes de congelar |
| **Ao gerar as parcelas** | Rede de segurança, já com a nota na mão |

O que é recusado:

- *"Entrada de 30%"* sem dizer **em quantas vezes** o resto será pago
- *"3 parcelas"* sem dizer **de quantos em quantos dias** elas vencem

> **O portal é a porta que importa.** É o único momento em que a pessoa que sabe a resposta — o vendedor — está na tela. Três meses depois, com a nota chegando, ninguém mais consegue perguntar a ele de quanto em quanto tempo queria receber. E o pedido congela a condição: depois de gerado, não há tela para editá-la. A saída seria reabrir a cotação numa última chamada.

## Baixar as contas

Botão **↓ Baixar contas**. Ele pergunta o formato antes de baixar — **PDF** ou **Word** —, igual a todo download do sistema. Veja *"Baixar: PDF ou Word"* no capítulo de Relatórios.

O arquivo traz todas as parcelas com título, fornecedor, CNPJ, nota, pedido, parcela, valor, vencimento, situação e pagamento, além do total em aberto no cabeçalho.

## Digitou errado? Corrija, não cancele

Botão **✏️ Corrigir**, na linha da nota. Abre o mesmo formulário com tudo preenchido, e a conferência contra o pedido roda de novo — se o valor passa a bater, a pendência some sozinha.

> **Só enquanto a nota não virou conta a pagar.** Depois de gerar as parcelas o botão some: mudar o valor por baixo de uma parcela em aberto faria a conta divergir da nota em silêncio, e se a parcela já foi paga seria reescrever um pagamento que aconteceu.

## Cancelar uma nota

Na tela de notas, botão **Cancelar**. A nota e as parcelas **em aberto** são canceladas juntas.

> Nota com **parcela já paga não é cancelada**. Apagar isso esconderia um pagamento que aconteceu de verdade. Se o pagamento foi errado, o conserto é no banco, não no sistema.

### A nota cancelada devolve o número

Cancelou por engano de digitação? **Pode lançar de novo com o mesmo número.** A regra de nota duplicada só vale entre notas vivas.

Isso importa porque cancelar serve para duas coisas que o sistema não distingue:

| | O que aconteceu | O número |
|---|---|---|
| Cancelada na SEFAZ | a nota morreu no mundo | ninguém vai reusar |
| Cancelada aqui | **erro de digitação** | continua válido e precisa voltar |

O segundo caso é o comum. Bloquear para sempre transformaria o engano mais banal num beco sem saída.

> **Duas notas vivas com o mesmo número continuam proibidas** — essa é a regra fiscal de verdade, e ela não foi afrouxada.

### Elas somem da lista, não do sistema

Na barra de ações há o filtro **Situação**, igual ao das outras listas. Ele começa em *"Em aberto"*, que esconde as canceladas; escolha **Cancelada** para vê-las.

**Nota fiscal não é apagada.** Mesmo errada, o registro de que existiu e foi cancelada vale numa auditoria.

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

Menu **Administração → Comunicação**. Só o **Administrador** entra (permissão `sistema.integracoes`).

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

## Seis perguntas, seis abas

A tela tem seis abas. Cada uma responde a **uma pergunta** que alguém faz de verdade na construtora:

| Aba | A pergunta |
|---|---|
| **Orçamento** | A obra está estourando o orçamento? |
| **Economia** | A cotação valeu a pena? |
| **Fornecedores** | Em quem dá para confiar? |
| **Tempos** | Onde o processo trava? |
| **Consumo** | O que a empresa mais compra? |
| **Estoque parado** | Que dinheiro está encostado na prateleira? |

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

### O dinheiro que já tem dono

No alto da aba há cinco cartões. Dois deles respondem a pergunta que o saldo sozinho não responde:

| Cartão | O que é |
|---|---|
| **Comprometido** | Solicitações **aprovadas** e cotações **em andamento** que ainda não viraram pedido |
| **Saldo livre** | O previsto **menos** o que já saiu **e** o que já está prometido |

O comprometido é dinheiro que ainda não saiu do caixa, mas também **não está disponível**: alguém já assinou embaixo.

Sem esse número o relatório era espelho retrovisor. Quem lesse *"gastei 3% do orçamento"* acharia que tinha 97% na mão — e ofereceria de novo um dinheiro que já tinha dono.

> Assim que a solicitação vira **pedido de compra**, o valor sai do comprometido e entra no comprado. Nunca aparece nos dois ao mesmo tempo: isso dobraria o dinheiro.

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
| **Participação** | Quanto ele representa de **tudo** que a empresa comprou |
| **Respostas** | Quantas cotações ele respondeu, de quantas foi convidado |
| **Entregas** | Quantas **cargas** dele já foram conferidas no almoxarifado |
| **Pontualidade** | Quantos chegaram **dentro do prazo que ele prometeu** na cotação |
| **Qualidade** | Quantos chegaram **sem ressalva e sem devolução** |
| **Leitura** | Uma frase em português resumindo o fornecedor |

### O selo "Dependência"

Quando um fornecedor passa de **40%** de tudo que a empresa comprou, a linha dele ganha o selo **Dependência**.

Não é acusação de preço alto — é aviso de **poder**. Quando um fornecedor concentra quase toda a compra, ele sabe disso. No dia em que ele subir o preço, atrasar ou simplesmente parar de responder, não há para onde correr: não existe outro cadastrado com histórico para assumir o volume.

O que fazer com o aviso: **convidar mais gente** para as próximas cotações daquela família, mesmo que o preço do concentrador esteja bom. Segunda opção viva vale dinheiro no dia em que for preciso usá-la.

> Fornecedor com 0% não recebe selo nenhum. Quem não vendeu nada não é dependência — é lista vazia.

### Uma carga é uma entrega, não um item

A coluna **Entregas** conta **caminhões**, não linhas de item.

Um caminhão trazendo cimento e argamassa é **uma** entrega. Quando ele chega atrasado, é uma entrega atrasada — não duas. E se um dos itens vier com ressalva, a entrega inteira conta como problema: quem recebe não separa o caminhão em pedaços.

Isso importa por causa da regra logo abaixo: contar itens em vez de cargas fazia o sistema achar que já tinha três entregas quando tinha uma, e emitir veredito sobre um fornecedor de uma compra só.

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

## Aba 6 — Estoque parado: que dinheiro está encostado?

Material encostado no almoxarifado é dinheiro que a empresa **já pagou e ainda não usou**. Ele não aparecia em relatório nenhum: o orçado × realizado já deu a compra por gasta, e o saldo de estoque diz o que **tem**, nunca **há quanto tempo está lá**.

Três números no alto:

| Cartão | O que é |
|---|---|
| **Dinheiro encostado** | O saldo de cada material pelo **custo médio** do almoxarifado |
| **Nunca saíram** | Quantos materiais entraram e **nunca** tiveram uma saída sequer |
| **Parado há mais tempo** | O campeão de prateleira |

### Quantos dias é "parado"?

Você escolhe, no alto da tela: **30, 60, 90, 180 ou 365 dias**. Começa em 90.

Não existe número certo, e é por isso que ele não está cravado no sistema: cimento encostado 90 dias é desperdício, andaime encostado 90 dias pode ser planejamento. Quem lê o relatório é que sabe qual é o caso.

### De quando a conta começa

Da **última saída** do material. Quando nunca saiu nada, vale a data em que **entrou**.

Contar sempre da entrada esconderia justamente o pior caso — o material que chegou ontem e nunca vai ser usado ficaria invisível por três meses. E contar da entrada num material que sai toda semana acusaria de parado o que está girando.

> Material com saldo **zero** não aparece: prateleira vazia não é dinheiro parado. Material sem nenhum movimento registrado também fica de fora — acusar o que não se sabe é pior que ficar calado.

### O selo "Nunca saiu"

É o caso que mais dói: alguém comprou, o material chegou, e ninguém nunca precisou dele. Ou a compra foi feita sem uso à vista, ou a obra mudou depois. Nos dois casos o dinheiro está lá, na prateleira, esperando.

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

Integração é quando nosso sistema conversa com um **serviço de fora**. São três:

| Integração | Para que serve |
|---|---|
| **WhatsApp** | Avisar sobre cotações, aprovações e pedidos |
| **Fiscal (NF-e)** | Conferir a nota fiscal que o fornecedor emitiu |
| **Pagamento** | Mandar a conta para o financeiro |

> **Eram quatro.** A quarta era a **GS1**, que responderia "que produto é este?" ao bipar
> um código de barras desconhecido. Saiu na reunião de 08/10/2026: é serviço pago por
> assinatura, e a Porto Inc. não vai assinar.
>
> **O código de barras continua no sistema.** O campo, o leitor, o dígito verificador e a
> busca no catálogo da própria empresa seguem iguais. O que se perdeu foi a sugestão
> automática de descrição ao bipar um código que ainda não está cadastrado — nesse caso
> quem cadastra digita a descrição, como já digitava para todo item sem código de barras.

## Por que elas começam simuladas

Todas dependem de coisas que ainda não temos: contrato com a Meta, certificado digital da empresa e contrato com o banco.

Em vez de esperar, o sistema já foi construído com as três **prontas para receber a integração**.

> **Como entender na prática:** imagine uma tomada na parede. A tomada já está instalada. Hoje temos um aparelho de teste ligado nela. Amanhã você tira o de teste e liga o de verdade. A parede não muda.

## O que "simulado" garante

Enquanto o selo estiver **Simulado**:

- Nenhuma mensagem de WhatsApp é enviada a alguém de verdade
- Nenhum centavo se move
- Nenhum fornecedor recebe nada

O sistema registra o que **teria** enviado, para você conferir. Risco zero.

---

# 41.9. O menu de três pontinhos, e as confirmações

## No celular, cada linha vira um cartão

Nas telas de lista — Pedidos, Notas fiscais, Solicitações, Estoque e as outras — a tabela
muda de forma no telefone: **cada linha vira um cartão**, com o nome da coluna em cima de
cada valor.

> No computador continua tabela. É a mesma informação, na forma que cabe em cada tela.

Antes a tabela rolava de lado dentro da própria caixa, e o telefone mostrava **quatro das
oito colunas** de Pedidos — Total, Situação e Ações ficavam escondidas à direita, sem
nenhum sinal de que existiam.

### A exceção: a equalização

Na **Equalização de cotação** a tabela continua rolando de lado, inclusive no celular. Ali o
trabalho é comparar o mesmo item entre fornecedores — virar cartão desmontaria justamente o
que você abriu a tela para ver.

## Os números ficam lado a lado

Os cartões de número (Pedidos, Valor total, Fornecedores...) aparecem **dois por linha** no
celular, em vez de um. Um por linha fazia a tela ter três alturas de tela antes de chegar na
lista.

---

## Alçadas: quando não há faixa nenhuma

Se ninguém configurou faixa de alçada ainda, a tela **diz isso** em vez de mostrar uma
tabela vazia — e explica o que acontece sem faixa: nenhuma solicitação sabe quem precisa
assinar.

## As buscas ficaram do tamanho certo

Os campos **Buscar** de Materiais, Fornecedores, Obras e Usuários eram enormes. Agora têm o
tamanho de uma busca. O que você digita e o resultado não mudaram.

---

## Os campos passaram a ter o tamanho do que recebem

Antes, um campo para digitar "PC-00001" ocupava quase a tela toda. Agora a caixa tem a
largura do conteúdo: campo de número é curto, campo de data é curto, campo de texto livre
usa o espaço.

> Isso não muda o que você digita — muda o que você **vê** antes de digitar. Uma caixa
> enorme para três dígitos faz procurar onde escrever, e sugere que cabe muito mais.

## As caixas dos formulários ganharam nome

Em **Nova solicitação** e **Nova cotação**, cada bloco do formulário agora diz o que é:
"Para qual obra", "Adicionar item", "Antes de salvar", "O pacote", "Resumo do pacote".
Antes eram caixas sem título nenhum.

---

## O "?" dos cartões de número

Nas telas de **Financeiro**, **Relatórios** e **Locação**, cada cartão de número tem um
**?** no canto. Clique nele e a explicação do que aquele número significa abre **dentro do
cartão**. Clique no **×** para fechar.

> Antes a explicação aparecia ao passar o mouse, e a caixinha cobria o cartão do lado —
> escondendo o número do vizinho. E passar o mouse não existe no celular.

## Os números agora concordam

"1 parcela" e não "1 parcela(s)"; "1 função" e não "1 função(ões)". Vale em toda a tela do
sistema.

---

## A tela inicial responde uma pergunta

Ao entrar, a primeira tela responde **o que precisa de você agora**. Ela é montada com as
suas permissões: você só vê número de coisa que você pode resolver.

### "O que precisa de você"

A faixa de cima, quando tem alguma coisa. A ordem é a do dia: primeiro o prazo que já
passou, depois o que vence se ninguém agir.

| Faixa na lateral | Quer dizer |
|---|---|
| **Vermelha** | prazo já perdido — parcela vencida, equipamento que devia ter voltado |
| **Amarela** | vence se ninguém agir — assinatura parada, material no ponto de repor |

> A cor nunca informa sozinha: a faixa está lá para quem não distingue as cores, e a linha
> de baixo diz por extenso o que aconteceu.

Quando não há nada, no lugar da faixa aparece **"Nada esperando por você"**. Ela não fica
vazia nem some.

### "Como estão as coisas"

Os outros números, sem cobrança: cotações abertas, entregas a conferir, suas solicitações
em andamento. Bom saber, não pede nada.

### Todo número leva até a tela dele

**O cartão inteiro é clicável.** "Contas vencidas: 3" abre o financeiro já filtrado nas
vencidas; "Esperando sua assinatura" abre a fila de aprovação.

> O número que aparece aqui é o **mesmo** que a tela de destino mostra: quem conta é o
> servidor, uma vez só. A tela inicial não refaz conta nenhuma.

### O que cada função vê

| Quem entra | Vê, por exemplo |
|---|---|
| Almoxarife | material abaixo do mínimo, entregas a conferir |
| Financeiro | contas vencidas, o que vence em 7 dias |
| Gestor de obra | o que espera a assinatura dele |
| Comprador | cotações abertas, pedido emitido e não enviado |

### O aviso de andamento saiu do topo

O texto sobre as etapas do projeto e o modo de teste continua na tela, mas **no fim e em
voz baixa**. Ele fala do projeto, não do seu trabalho — e ocupava o lugar mais valioso.

---

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

# 42.2. As páginas das listas

Até a versão 0.41 **toda lista do sistema cortava num número fixo, em silêncio.**

As consultas pediam `take: 200` — ou 300, ou 500 — e devolviam esse corte como se fosse
tudo. A solicitação de número 201 continuava no banco e não aparecia em tela nenhuma. E a
tela ainda dizia:

```
200 solicitações listadas
```

**O defeito nunca foi o limite: foi o silêncio.** Quem olha conclui que o sistema perdeu
a compra antiga.

## O que a tela mostra agora

Duas peças, em lugares diferentes, porque fazem trabalhos diferentes.

**Em cima da lista**, a contagem:

```
Mostrando 21 a 40 de 68 solicitações
```

Aquele **68** vem contado no banco, com o mesmo filtro da busca. É o que conserta a
mentira.

**Embaixo da lista**, a barra:

```
«  ‹   1  …  6  [7]  8  …  250   ›  »
```

O `…` é um buraco, e ele é informação: diz que existe coisa pulada ali no meio. O último
número — `250` — aparece **sempre**, e como número, não como seta: ver "250" conta o
tamanho do conjunto, uma seta não conta nada.

> **Por que separadas?** A barra inteira ficava embaixo, junto dos botões. O dono clicou
> no "2" e perguntou *"será que eu mudei de página?"*. A confirmação existia — mas no
> porão: depois do clique a pessoa continuava embaixo, olhando linhas que não pediu, com a
> resposta fora de vista.

## O que acontece ao clicar

Três coisas, de propósito:

1. A tela **rola até o começo da lista** — não da página: o cabeçalho e os filtros
   saírem de vista tirariam o contexto de onde você está
2. As linhas velhas ficam **esmaecidas** e os botões **travam**, enquanto a página nova
   não chega
3. As linhas novas entram com um **fade**, que é o que confirma sem texto que a lista é
   outra

A rolagem é **instantânea, não suave**. Com a tabela cheia a distância passa de mil
pixels, e a rolagem suave faz a pessoa assistir à lista inteira voar — o que desorienta em
vez de orientar. Isso apareceu numa foto tirada no meio da animação.

## As dez listas que paginam

| Tela | Rota |
|---|---|
| Solicitações | `/api/solicitacoes` |
| Cotações | `/api/cotacoes` |
| Pedidos | `/api/pedidos` |
| Entregas conferidas | `/api/recebimentos` |
| Extrato do estoque | `/api/estoque/movimentos` |
| Notas fiscais | `/api/notas-fiscais` |
| Contas a pagar | `/api/contas-pagar` |
| Locação | `/api/locacao` |
| Materiais | `/api/materiais` |
| Fornecedores | `/api/fornecedores` |

**20 por página.** Cabe numa tela de computador sem rolar e, no celular — onde cada linha
vira cartão —, dá uma rolagem curta. Quem quiser pede outro tamanho por `?porPagina=`, com
**teto de 100**: sem teto, `?porPagina=999999` derruba a API.

## As filas de trabalho ficaram de fora

De propósito: a fila de aprovação, os itens esperando cotação e os pedidos esperando
entrega continuam sem barra de páginas.

**Fila que cresce é fila parada.** Ali o número grande é o problema a resolver, não uma
lista para navegar — e paginar uma fila é dar conforto para conviver com ela.

## Como é feito, por dentro

Cada rota paginada faz **duas** consultas: uma `count`, que diz quantas existem, e uma
`findMany` com `skip`/`take`, que traz as da página.

```ts
const filtro = { /* …o MESMO filtro nas duas… */ };
const pedido = lerPaginacao(req.query);

const [total, linhas] = await Promise.all([
  banco.X.count({ where: filtro }),
  banco.X.findMany({ where: filtro, skip: pedido.pular, take: pedido.porPagina }),
]);

return { solicitacoes: linhas.map(formatar), ...camposDaPagina(total, pedido) };
```

**O filtro tem de ser o mesmo objeto nas duas.** Se divergirem, a barra promete sete
páginas e a sétima vem vazia. É por isso que ele é declarado uma vez, numa variável.

Na tela, o estado de "em que página eu estou" mora num gancho só —
`frontend/src/ganchos/pagina.ts` —, usado pelas dez. Repetir aquilo dez vezes não daria
dez telas iguais: daria dez telas **parecidas**, e cada diferença dessas é um chamado do
tipo "nessa tela a paginação é esquisita".

## Duas coisas que a régua passou a cobrar

No `scripts/pente-fino.mjs`:

- **PAGINA_SEM_TOTAL** — rota que traz a página e não conta o total. É o defeito antigo
  com outra roupa: quem escrever a décima primeira lista vai copiar uma das dez
- **MEIA_BARRA_DE_PAGINAS** — tela com a barra e sem o contador, ou o contrário. As duas
  peças andam juntas

## Dois casos que não seguem o molde

**Locação** corta a página **na memória**, e é a única. "Atrasada", "vence hoje" e o
custo acumulado não existem como coluna — são conta feita em cima da data de hoje, e o
banco não sabe fazê-la. Cortar antes seria filtrar o alerta dentro de uma página só, e o
resumo de cima contaria apenas as vinte da tela. Contrato de locação é coisa de dezenas
por ano, então carregar a tabela é aceitável; se um dia passar de alguns milhares, o
caminho é guardar o alerta como coluna, atualizada por tarefa diária.

**Pedidos** precisou de SQL cru. Os três números do alto da tela — quantos pedidos, o
valor total e quantos fornecedores distintos — saíam de contar o array que a tela tinha em
mão. Enquanto a lista vinha inteira isso era quase verdade; com vinte por página, "Valor
total · Soma de todos" mostraria a soma de vinte com cara de total da empresa.

Os dois primeiros são fáceis: `count` e `groupBy`. O valor total não: o total de um pedido
não é coluna, é `soma(quantidade × valor unitário) + frete + outros custos`, e o
`aggregate` do Prisma não multiplica duas colunas. Então ele é uma consulta escrita à mão,
com a soma dos itens numa subconsulta agrupada por pedido — num JOIN direto, um pedido com
três itens entraria três vezes e o frete dele seria contado três vezes.

**Cotações** tinha o mesmo problema em dois indicadores, e sem o SQL: "Pacotes abertos" e
"Respostas recebidas" viraram dois `count`. Eles **não** seguem o filtro da lista, de
propósito: são o estado do trabalho em andamento, e continuam valendo enquanto a pessoa
olha as canceladas do ano passado.

> **A lição dos dois.** Paginar uma lista não é só cortar a lista: é conferir todo número
> na tela que saía de contar o que estava em mão. O contador da lista é o mais óbvio
> deles, e não é o único.

---

# 42.3. Os números da tela inicial

A tela inicial mostra nove cartões: "3 aprovações esperando você", "2 contas vencidas",
"4 materiais no ponto de repor". Seis deles já perguntavam ao banco **quantos são**. Três
faziam diferente: traziam as linhas para a memória e contavam aqui.

Um desses três mentia.

## O que mentia

O cartão de **aprovações** pedia no máximo 500 solicitações e contava quantas esperavam
a sua assinatura. Com 600 na fila, ele contava 500 e mostrava o resultado como se fossem
todas — **um número menor que o certo, e calado**.

É a mesma doença das listas que paravam em 200 e diziam que era tudo. O problema nunca
foi o limite: foi o silêncio.

Os outros dois — **material no ponto de repor** e **contas a pagar** — acertavam o
número. O que eles faziam era trazer a tabela inteira para contar, a cada abertura da
tela que abre primeiro de manhã.

## Contas a pagar: dois `count`, e uma armadilha de fuso

Viraram duas perguntas ao banco: quantas vencem antes da meia-noite de hoje, e quantas
vencem de hoje até o fim do sétimo dia.

A armadilha está em **quem decide que dia é hoje**. O `CURRENT_DATE` do Postgres responde
em UTC, e o container roda assim. Depois das 21h de São Paulo o UTC já virou o dia — e a
tela que existe para avisar prazo passaria a marcar como vencida, toda noite, a conta que
vence amanhã.

É o mesmo defeito de 27/09/2026 que levou `diaDeHoje` a existir, e ele viajaria para
dentro da consulta sem ninguém ver.

Por isso a fronteira das datas é calculada **no sistema**, pelo mesmo caminho de sempre, e
vai ao banco como parâmetro:

```ts
const comecoDeHoje = inicioDoDiaBr(hoje);
const fimDaSemana  = inicioDoDiaBrMais(8, hoje);
```

O banco não precisa saber onde fica São Paulo. E o "fim do sétimo dia" é o **começo do
oitavo**: assim a conta que vence às 23h do sétimo dia entra, e a do oitavo não.

## Material no ponto de repor: SQL, e uma regra em dois lugares

A comparação é entre **duas colunas** — o saldo e o ponto de pedido do material —, e o
Prisma não compara coluna com coluna. Então essa é uma consulta escrita à mão.

E aqui mora o preço: a regra de `precisaComprar` passou a existir **duas vezes**, uma em
TypeScript e outra em SQL. Ela não é um `<=` simples:

```ts
if (pontoPedido === null || pontoPedido <= 0) return false;
return quantidade <= pontoPedido + TOLERANCIA;
```

A folga do ponto flutuante é a **mesma constante**, exportada e passada como parâmetro —
duas cópias desse número divergiriam no dia em que ele mudasse.

O resto é cobrado por teste. Em `testes/inicio.test.ts` os dois caminhos rodam sobre os
mesmos dados e têm de dar o mesmo número, incluindo os casos de borda: saldo exatamente
igual ao ponto de pedido, um acima, zerado, ponto de pedido zero.

> **Duas coisas que o teste revelou, e que ficaram como estão.** O cartão conta
> **saldos**, não materiais: o mesmo material no vermelho em dois almoxarifados conta
> duas vezes. E material cadastrado com ponto de pedido mas **nunca comprado** não
> aparece, porque não há linha de saldo. Os dois são comportamento antigo; mudá-los é
> mudar o que o cartão significa, e isso é outra conversa.

## Aprovações: o número conserta, a conta fica

Essa foi a única que **não** foi para o banco, e de propósito.

"Espera você" depende das regras de alçada: qual faixa o valor pegou, quais funções ela
exige, quem já assinou, quem é o autor. Essa regra está escrita **uma vez**, em
`podeDecidir`, e a fila de Aprovações usa a mesma função — senão a tela inicial e a fila
diriam números diferentes sobre a mesma compra.

Reescrevê-la em SQL criaria uma segunda cópia, em outra linguagem. No dia em que uma
faixa de alçada mudasse, alguém atualizaria uma e esqueceria a outra — e o sistema
começaria a se contradizer sobre dinheiro.

O que mudou foi o teto:

- **Caiu o `take: 500`.** O número passa a estar certo sempre.
- **"Não sou o autor" desceu para o banco.** Ninguém aprova o próprio pedido — isso é
  regra de segurança, não de alçada, então ela filtra na consulta em vez de aqui. Vem
  menos coisa do que vinha antes.

### O que isso custa, e quando revisitar

Sem teto, a fila inteira entra na memória para ser contada. Cada linha são quatro campos
pequenos — quem abriu, a situação, quais cargos assinam, quem já assinou —, então isso só
pesa com **dezenas de milhares** de compras paradas esperando assinatura. E uma empresa
nessa situação tem um problema maior que o do sistema.

**Se um dia a fila passar de algumas centenas com frequência, ou a tela inicial demorar a
abrir**, o caminho é guardar "quem falta assinar" como coluna da solicitação, atualizada a
cada assinatura. Resolve de vez — e em troca toda decisão (assinar, devolver, reprovar)
passa a ter o dever de mantê-la. Se um caminho esquecer, a coluna mente, e aí o erro é
pior do que o de hoje: silencioso e permanente.

---

# 42.4. Os relatórios: o que foi mexido, e o que não foi

Os seis relatórios buscam linhas e fazem a conta aqui dentro. **Nenhum deles mente** — o
número sai certo. O que havia era o tamanho do que eles carregam, que cresce junto com a
empresa.

Por isso esta etapa foi cirúrgica, e não uma reescrita.

## Como estavam

| Relatório | O que buscava | Risco |
|---|---|---|
| Fornecedores | Todo fornecedor × convites × pedidos × itens × recebimentos, **sem filtro** | O maior |
| Estoque parado | Todos os saldos, e **o extrato inteiro** | Segundo |
| Orçamento | Quatro consultas, todas presas a **uma obra** | Cresce com a obra |
| Economia, Tempos, Consumo | Presos a uma **faixa de datas**, 12 meses por padrão | Já contidos |

## O que foi feito

**Estoque parado.** Ele carregava o extrato inteiro para achar duas datas por material em
cada almoxarifado: a última saída e o primeiro movimento. Viraram duas consultas
agrupadas — o banco devolve uma linha por par, em vez de dezenas de milhares.

O extrato é a tabela que mais cresce no sistema: toda retirada de saco de cimento é uma
linha, e nenhuma é apagada.

> **A armadilha que quase passou.** A variável se chama `primeiraEntrada`, mas o código
> sempre pegou o primeiro movimento de **qualquer tipo** — podia ser uma saída, um ajuste,
> uma transferência. Uma consulta escrita pelo nome da variável filtraria `tipo =
> 'ENTRADA'`, e o material que chegou a um almoxarifado por **transferência** sumiria do
> relatório — não erraria a data: sumiria.
>
> Ficou o que o código fazia. O nome é que estava mentindo, e há teste guardando isso para
> quem um dia resolver "arrumar" a consulta para combinar com ele.

**Fornecedores, metade.** Ele trazia todos e descartava, na linha seguinte, quem nunca foi
convidado nem teve pedido. O descarte desceu para o banco. Num cadastro com centenas de
fornecedores, a maioria nunca foi convidada para nada.

## O que NÃO foi feito, e por quê

**O relatório de Fornecedores continua ignorando a faixa de datas.** Ele mede a vida
inteira de cada fornecedor, desde o primeiro convite. É o que o torna o mais pesado — e
consertar isso **muda o que o relatório diz**:

> A Marquilip atendeu mal em 2023 (8 atrasos em 10 entregas), trocou de dono e melhorou
> (12 entregas sem atraso em 2025).
>
> Hoje: 20 entregas, 40% de atraso. "Fornecedor problemático."
> Com faixa de 12 meses: 12 entregas, 0% de atraso. "Cumpre prazo."

Memória longa protege contra fornecedor ruim; memória curta deixa fornecedor melhorar.
**Quem decide é a Porto Inc.**, e enquanto não decidir fica como está.

**As análises não foram reescritas em SQL.** Economia, tempos e desempenho são funções
puras em `servicos/relatorios.ts`, com teste — e com histórico: foi ali que apareceu o
"3 entregas" que eram um caminhão só, achado pelo dono lendo o PDF, justamente no número
a partir do qual o sistema se permite opinar.

Trocar código testado por código novo, para ganhar velocidade num sistema que ainda não
está lento, nos relatórios que decidem dinheiro, é risco maior que o ganho. A hora de
voltar nisso é quando houver base grande o bastante para medir o quanto dói.

---

# 42.5. ## A memória do fornecedor: longa, com data

O relatório de Fornecedores olha a **vida inteira** de cada um, desde o primeiro convite.
Os outros três que têm faixa de datas olham os últimos 12 meses; este não.

**É decisão da casa, e está certa.** Histórico que apaga não protege de fornecedor ruim
nem deixa ver quem melhorou. O status acompanha: quem era bom e piorou vai piorando na
conta; quem era ruim e melhorou vai subindo.

O que faltava era **quando**. A tabela dizia "64% no prazo" e quem lia não tinha como
saber se aquilo era de agosto ou de três anos atrás — era o único dos seis relatórios sem
data nenhuma, nem na tela nem no PDF.

Agora:

- Sob o nome de cada fornecedor, **última em 27/09/2026**
- No alto da tabela e no PDF, **o período que a história cobre**
- E quando a última entrega passa de um ano, a frase diz: *"Cumpre prazo e entrega certo
  — mas não entrega há 14 meses"*

> **Doze meses, e não um número novo.** É o mesmo período que Economia, Tempos e Consumo
> usam por padrão. Quem não entrega há mais de um ano saiu da faixa que o resto do sistema
> chama de "como estamos indo".

### O que foi considerado e descartado

Cogitou-se uma **janela das últimas 10 entregas** para o veredito. Foi descartado depois
de medir:

- **A tela de convidar não mostra desempenho nenhum** — nome, CNPJ, famílias e nada mais,
  com todos marcados por padrão. Nenhuma rota de cotação, pedido ou recebimento lê o
  desempenho. O veredito não decide convite; ele informa quem lê o relatório.
- **Na escala da empresa, "últimas 10" é a vida inteira.** No ritmo modelado — pouco mais
  de uma compra por mês na empresa toda —, um fornecedor leva uns dois anos para chegar a
  10 entregas. A janela não faria nada por dois anos.

A janela volta à mesa quando algum fornecedor passar de ~15 entregas. Aí a conversa tem
dado, e não chute.

---

# 42.6. Cartão esticado, com vazio dentro

O dono abriu os Relatórios e achou duas coisas no mesmo dia:

- clicar no **"?"** de um indicador fazia **todos os blocos da fileira crescerem**
- os cartões de gráfico tinham **muito espaço em branco**, em mais de um lugar

Eram o mesmo defeito, com duas caras.

## A causa

A grade do painel usava o padrão do navegador: **esticar todo item até a altura do mais
alto da fileira.** Medido, aba por aba:

| Onde | O que acontecia |
|---|---|
| Qualquer fileira de indicadores | abrir UM "?" levava os quatro de 154px para 248px — três caixas com **94px de nada** |
| Consumo · "Para onde vai o dinheiro" | **180px** de vazio |
| Fornecedores · "Concentração das compras" | **172px** de vazio |

O estado do "?" sempre foi individual. Quem crescia era a fileira, e por isso parecia que
o botão tinha aberto todos.

A correção é uma linha: a grade deixou de esticar.

> **Caixa com borda e vazio dentro parece quebrada. Caixas de alturas diferentes parecem
> o que são:** conteúdos de tamanhos diferentes.

## O terceiro, que apareceu ao olhar a foto

O ranking "Quanto a empresa comprou de cada um" listava **Constrular R$ 0,00** e **Hidro
Sul R$ 0,00** — barras vazias num gráfico sobre quanto se comprou.

E a rosca ao lado já os omitia. **Os dois cartões falavam da mesma coisa e discordavam
sobre quem estava na lista**: um mostrava seis nomes, o outro quatro.

Tirados os zerados, os dois passaram a concordar — e as alturas ficaram quase iguais
sozinhas, sem regra nenhuma forçando. Quem foi convidado e não vendeu continua na tabela
abaixo, com a leitura explicando.

## O que a régua aprendeu, e o que ela desaprendeu

A régua cobrava **alturas iguais** na mesma fileira: mais de 2px de diferença era achado.
Fazia sentido enquanto a grade esticava — ali, diferença era bug. Depois da correção ela
acusaria para sempre.

Então ela passou a medir o que de fato dói: **vazio dentro da caixa**.

> **A primeira versão dessa medição estava errada, e isso quase passou.** Ela media a
> distância entre o fim do conteúdo e o fim da caixa — e o **padding do cartão caía nessa
> conta como se fosse vazio**. Resultado: 60 achados em 15 telas que estavam certas.
>
> Régua que acusa o sistema inteiro não é régua, é ruído; e confiar nela teria levado a
> "consertar" quinze telas sadias.
>
> A medição certa não chuta padding: ela **solta o cartão do esticamento, mede, e
> devolve**. A diferença é exatamente o que a grade impôs.

## Dois acertos dentro dos gráficos

Com o vazio resolvido, sobraram duas coisas que a régua não mede — ela cobra transbordo e
sobra, não desalinho nem ordem.

**A legenda da rosca estava torta quando o nome quebrava.** A coluna do nome tem 128px;
"Bandeirantes Elétrica" e "Cimento e Argamassas" não cabem e passam para duas linhas. Com
o alinhamento no meio, o quadradinho de cor e o valor ficavam boiando entre as duas
linhas, e a linha inteira destoava das vizinhas.

Agora alinham pela **primeira linha**, como marcador de lista faz.

**Os dois gráficos apareciam em ordem trocada.** Consumo e o painel do Financeiro abrem com
a rosca e seguem com o ranking; Fornecedores fazia o contrário, e era o único. Quem
trocava de aba via os dois blocos pularem de lado.

A ordem tem razão de ser: a rosca mostra a **repartição** — quanto do bolo é de cada um —,
e o ranking mostra o **detalhe ordenado**. Do geral para o detalhe é como se lê.

## Onde a régua cobra, e onde não cobra

Só nas grades que declararam **não** esticar — e a distinção é da casa:

- **Nos painéis** de Relatórios e Financeiro, cada cartão é uma coisa diferente: um
  gráfico, um número, uma rosca. Esticar só produz vazio. Qualquer sobra é defeito.
- **Nas grades de catálogo** — famílias, fornecedores, cadastros — os cartões são do mesmo
  tipo, lado a lado. Ali alinhar a base é o acordo, e o vão de quem tem menos texto é o
  preço dele.

Como a régua só cobra onde a grade declara `align-items: start`, apagar essa linha calaria
as duas ao mesmo tempo. Por isso o **pente-fino** ganhou a regra `PAINEL_SEM_ALINHAMENTO`:
ela cobra a intenção no texto do CSS, em 0,2 segundo. Uma mede o resultado, a outra cobra
a decisão.

---

# 42.7. Os blocos de gráfico, dois a dois

Os gráficos dos Relatórios e do Financeiro ficam **lado a lado, dois por fileira**. O dono
reclamou de como eles se comparavam: *"ou os blocos estão pequenos em relação aos outros,
ou grandes e com espaço em branco que torna feio"*.

## Por que um era maior que o outro

A altura de cada bloco é escrava de **quantas linhas ele tem** — e ninguém escolhe isso: é
quantos itens o banco devolveu.

Medido: cada barra de ranking ocupava **56px**, cada linha de legenda da rosca **44px**, e
o desenho da rosca é um piso de **195px**.

| Par | Antes |
|---|---|
| Consumo | 3 famílias (278px) × 6 itens (457px) — **179px de degrau** |
| Fornecedores | 4 fornecedores (286px) × 4 (330px) — 44px |
| Financeiro | 4 credores (363px) × 2 obras (236px) — 127px |

## As duas alavancas

**Teto de 4 barras no ranking**, e ele mora dentro do componente, não em cada tela — padrão
escrito em cinco lugares dura até alguém escrever o sexto. O gráfico diz o que não
mostrou: *"Os 4 maiores de 6"*.

**O mesmo ritmo de linha nos dois.** A legenda da rosca passou de 44px para 56px por
linha, igual à barra do ranking. Quatro linhas de um lado passaram a dar a mesma altura
que quatro do outro.

| Par | Antes | Agora |
|---|---|---|
| Fornecedores | 44px | **8px** |
| Consumo | 179px | **78px** |
| Financeiro, rosca × medidor | 2px | 2px |

Consumo ainda tem 78px porque a rosca só tem **três** famílias: com poucas fatias quem
manda na altura é o desenho de 195px, e nenhum ajuste de ritmo alcança as quatro barras do
lado.

## O que faltava: ligar o que já estava escrito

Mesmo com os dois ajustes acima, os pares não terminavam na mesma linha — 8px em
Fornecedores, 78px em Consumo. O dono viu de novo: *"veja, n ta alinhado"*.

Esticar os dois até a mesma altura resolveria o alinhamento e traria de volta o buraco no
fundo. **A não ser que o conteúdo centralize na sobra** — e a regra para isso já estava no
sistema, escrita e desligada:

```css
.ranking {
  flex: 1;
  /* Com poucos itens, as barras ficam no meio do cartão em vez de
     grudadas no topo deixando um vazio embaixo. */
  justify-content: center;
}
```

O `.rosca-area` tem o mesmo `flex: 1`. As duas nunca funcionaram: o `figure.gr` que as
contém era só `margin: 0` — **não era container flex**, então a altura do cartão nunca
chegava nelas.

Ligando o `.gr` e devolvendo o esticamento **só aos cartões de gráfico** — os indicadores
com "?" continuam sem esticar —, os pares passaram a terminar juntos com o conteúdo
centrado:

| Par | Antes de tudo | Agora |
|---|---|---|
| Fornecedores | 44px | **0px** |
| Consumo | 179px | **0px** |
| Financeiro, rosca × medidor | 2px | **0px** |
| Financeiro, 4 barras × 2 barras | 127px | **0px** |

## O defeito que morava na largura que ninguém media

Mesmo com tudo acima, o dono abriu os relatórios e disse: *"cara, ta muito errado isso"*.

A tela dele é mais larga que 1440. Medido, com o cartão indo de 490px a 810px:

| Largura | Rosca | Coluna do nome na legenda |
|---|---|---|
| 1280 | 195px | a legenda cai para baixo do desenho |
| 1440 | 195px | **128px** — nomes longos quebram em duas linhas |
| 1600 | 195px | 208px |
| 1920 | 195px | **368px** — "Marquilip" a trezentos pixels do próprio valor |

**A rosca tinha 195px fixos em qualquer tela.** Num cartão de 810px vira um anelzinho
perdido, enquanto a legenda engole toda a sobra e afasta o nome do valor. O layout só
ficava bom numa faixa estreita de largura — justamente a que eu media.

Agora a rosca é uma fração da área, presa entre 160 e 280px: cresce com o cartão e encolhe
quando aperta. E a legenda ganhou teto de largura — lista de pares nome → valor só se lê
enquanto os dois estão perto.

| Largura | Rosca antes | Rosca agora | Coluna do nome |
|---|---|---|---|
| 1440 | 195 | 160 | 163 *(era 128)* |
| 1920 | 195 | **228** | **247** *(era 368)* |

### A régua ganhou a largura que faltava

Este é o conserto que vale mais que o CSS.

A régua media **1440 e 420** — o computador de quem desenvolve e o celular. Monitor de
1920 é o mais comum em escritório, e era exatamente onde o defeito morava: em 1440 o mesmo
layout estava justo, em 420 estava certo.

Ela passou a medir **1920, 1440 e 420**.

> **Medir só até 1440 é medir a máquina de quem escreve o código, não a de quem usa o
> sistema.**

## Uma régua que era teatro

Para vigiar isso escrevi a regra `PAR_DESALINHADO`: cartões esticados da mesma fileira têm
de ter a mesma altura.

Fui testá-la quebrando o CSS e descobri que **ela nunca poderia acusar** — itens esticados
pelo CSS Grid têm a mesma altura por definição. Era código morto dando sensação de guarda.

No lugar entrou `CONTEUDO_NO_TOPO`, que mede o que de fato pode dar errado: num cartão
esticado, o conteúdo grudar no topo com a sobra inteira no fundo. Conferida tirando o
`justify-content: center` de propósito.

E como apagar a declaração do esticamento não produz vazio nenhum — a régua ficaria muda
—, o pente-fino ganhou `GRAFICOS_SEM_PAREAR`, que cobra a linha no texto do CSS.

> **A lição, que vale para a próxima régua: regra que não pode falhar é pior que régua
> nenhuma.** Testar nos dois sentidos não é zelo, é o que separa guarda de enfeite.

## O que foi tentado e não funcionou

**Aumentar a rosca de 195px para 240px.** A ideia era óbvia: se o desenho é o piso, sobe o
piso. Deu errado na primeira foto — com 240 a legenda deixa de caber ao lado e o
`flex-wrap` a joga **para baixo** do desenho. O cartão foi de 286px para **535px**, e o
degrau de 44 para 205.

**Deixar a rosca ceder largura em vez de empurrar** (`flex-shrink`). Também não: quem
decide a quebra é o conteúdo **mínimo** da legenda, não a vontade da rosca.

Nesta largura de cartão, 195px é perto do teto. Ficou escrito no CSS, para ninguém tentar
de novo.

**Esticar os cartões até a mesma altura** é o que havia antes, e produz exatamente a caixa
com vazio dentro da seção 42.6.

---

# 42.8. A tela de diagnóstico saiu da vista

"Status do sistema" mostra a memória da API, o estado do banco e **quais integrações ainda
são simuladas**. Para quem desenvolve é a primeira tela a abrir quando algo cheira mal.
Para quem usa o sistema, ela só denuncia o que ainda é maquete.

Pedido do dono, em 08/10/2026: *"deixe apenas na conta DEV, as outras contas não podem ver
de maneira nenhuma"*.

## Por que não bastava esconder o menu

Três tentativas óbvias, e por que cada uma falha:

| Tentativa | Problema |
|---|---|
| Tirar o item do menu | o endereço continua funcionando: `/admin/status` |
| Tirar a permissão do ADMINISTRADOR | **a conta DEV também é administradora** — perderia junto |
| Deixar como está e pedir para não clicar | não é trava, é combinado |

## O que foi feito

A permissão `sistema.status` **mudou de casa**: saiu do ADMINISTRADOR e foi para uma função
nova, **DESENVOLVEDOR**, que a migração `0021` dá só à conta de desenvolvimento.

Essa função **não aparece na tela de Usuários**. Se aparecesse, o administrador se daria a
função e veria tudo de novo.

E não aparecer também não bastava: a atribuição é por **id**, não por nome. Quem
descobrisse o id se daria a função pela API. Então criar e editar usuário **recusam** essa
função explicitamente, com 403.

## O que isso garante

| | Administrador | Conta DEV |
|---|---|---|
| Vê o item no menu | não | sim |
| Abre `/api/status` direto | **403** | 200 |
| Enxerga a função na lista | não | — |
| Consegue se dar a função | **403** | — |

Quatro provas guardam isso em `testes/acesso.test.ts`.

> **Um teste antigo quebrou, e estava certo quebrar.** Ele usava `/api/status` para provar
> que "quem entrou passa" — e o administrador deixou de passar ali. A intenção dele era o
> crachá, não a permissão; passou a usar outra rota, e ganhou um irmão que prova o 403.

---

# 42.9. O financeiro ganhou entrada

O financeiro **só sabia tirar**. Toda saída nascia da nota do fornecedor, virava parcela em
contas a pagar, e pronto. Entrada nenhuma tinha lugar.

Iache, em 08/10/2026, perguntando onde se cadastra a receita da empresa e as despesas que
não são automatizadas. Emerson, na reunião do mesmo dia: *"como é que tu fez um
financeiro que eu não consigo cadastrar receita e despesa? Ele vai descontar de uma conta
que não tem cadastro de dinheiro de entrada"*.

## Onde fica

Menu **Financeiro → Receitas e despesas**. Também se chega por **Financeiro** →
botão **Receitas e despesas**.

## O que entra aqui, e o que não entra

| Entra aqui | Continua em contas a pagar |
|---|---|
| Medição que o cliente pagou | Compra de material |
| Aporte dos sócios | Qualquer coisa que veio de nota fiscal |
| Combustível da frota | |
| Aluguel do container, diária de máquina | |
| Taxa de prefeitura, energia do escritório | |

> **Por que a compra não se repete aqui.** Ela já nasce da nota, com fornecedor, pedido e
> conferência atrás dela. Lançar de novo daria **dois lugares para a mesma dívida**, e um
> dia eles divergiriam — e aí ninguém sabe qual dos dois acreditar.

## Os quatro cartões

| Cartão | O que responde |
|---|---|
| **Saldo** | Quanto a Porto Inc. tem. Entradas recebidas menos tudo que já saiu |
| **Entrou** | As receitas que caíram. O que falta receber aparece embaixo |
| **Saiu** | As compras pagas **mais** as despesas avulsas — separadas no detalhe |
| **Se tudo acontecer** | O saldo de hoje, mais o a receber, menos o a pagar |

O **Saldo** fica verde quando positivo e vermelho quando negativo. Os outros três existem
para explicá-lo: quem vê um saldo e não entende de onde saiu volta a conferir no papel.

> **O "Saiu" soma duas origens de propósito.** Um número único não diria se o aperto é
> de compra ou de custo de operação — e são dois assuntos com dois donos. O detalhe do
> cartão mostra os dois lados.

## Previsto e realizado

Todo lançamento nasce de um dos dois jeitos:

| Situação | Entra no saldo? | Onde aparece |
|---|---|---|
| **Previsto** | não | no cartão "se tudo acontecer" |
| **Realizado** | sim | no "entrou" ou no "saiu" |

Ao lançar, a caixa **O dinheiro já entrou** (ou *já saiu*) vem marcada, porque registrar
depois do fato é o caso comum. Desmarque para lançar uma previsão — a medição do mês
que vem, por exemplo.

Quando o dinheiro andar, use **Registrar que entrou** (ou *que saiu*) no menu da linha. A
data gravada é a de hoje.

## O lançamento não se apaga

Cancelar pede um **motivo**, que fica escrito nas observações. O lançamento continua na
lista, riscado e cinza.

Lançamento é dinheiro: quem olhar o caixa daqui a um ano precisa ver que aquilo existiu e
foi cancelado. Um buraco na numeração não se explica sozinho.

> **Cancelado não se corrige.** Pedir correção de um lançamento cancelado devolve erro:
> lance outro.

## Da empresa ou da obra

O campo **Obra** é opcional, e isso é escolha, não esquecimento. O aporte dos sócios e o
aluguel do escritório são da **empresa**, não de uma obra. Exigir obra obrigaria a
inventar uma — e a Porto Inc. acabaria com uma obra chamada "Geral".

Filtrando por obra, o saldo passa a ser **daquela obra**: tanto os lançamentos quanto as
parcelas de compra que chegaram até ela.

## A categoria é texto livre

Nenhuma lista fixa. A Porto Inc. vai descobrir as categorias dela usando o sistema —
*Frota*, *Canteiro*, *Taxas*, *Medição de obra*. Lista fixa decidida hoje seria um palpite
sobre o trabalho de outra pessoa.

## Os três gráficos

Os quatro cartões dizem **quanto**. Os gráficos dizem **quando** e **por quê**.

Nenhum deles repete o painel de Contas a pagar: lá os cinco gráficos olham para a
compra — a carteira, a pontualidade, para quem se deve, o custo por obra. O dinheiro que
não nasce de compra era invisível até aqui.

### O que vem pela frente

Seis semanas, começando na segunda-feira desta semana. Barra azul é o que entra, barra
âmbar é o que sai, e **embaixo de cada semana vem o saldo projetado** até ali — verde
se sobra, vermelho se falta.

É a pergunta que o cartão "Se tudo acontecer" não responde. Com R$ 96 mil a receber e
R$ 5 mil a pagar, o saldo final é ótimo — e ainda assim pode faltar dinheiro no dia 17,
se o que entra só entra no dia 26.

> **Se o caixa furar em alguma semana, um aviso aparece ACIMA do desenho.** Esperar que a
> pessoa repare no número vermelho embaixo da terceira barra é apostar na atenção dela.

Duas regras que mudam o número, e por isso estão escritas:

| Caso | O que o gráfico faz | Por quê |
|---|---|---|
| Parcela que **já venceu** | cai na **primeira** semana | ela continua tendo de ser paga; deixá-la de fora faria o caixa parecer mais folgado |
| Algo previsto para **depois das 6 semanas** | fica **de fora** | por isso o último saldo daqui não bate com o cartão "Se tudo acontecer", que soma tudo |

As **parcelas de compra entram junto** com as despesas avulsas: do ponto de vista do
caixa, as duas são dinheiro que vai sair.

### De onde vem o dinheiro · Para onde vai o que não é compra

Duas roscas, lado a lado, somando **o que já aconteceu** — agrupado pela **categoria**
que você digita ao lançar.

O previsto fica de fora de propósito: um aluguel de R$ 50 mil que ainda nem foi pago
faria a rosca dizer que a empresa gasta 90% com canteiro, gastando R$ 0 com ele.

> **As cores destes dois gráficos não significam nada**, e isso é de propósito. No resto
> do sistema vermelho é problema e verde é certo. Aqui as fatias são assuntos, não
> estados: pintar "Frota" de vermelho diria que há algo errado com a frota, e não há —
> ela só é a maior fatia. A família de cores é azul-para-roxo, longe do vermelho de
> alarme e do verde de aprovado.

Da sétima categoria em diante, tudo vira uma fatia **"Outras N"**: seis é quanto a rosca
mostra antes de virar confete, e a cauda somada continua fechando o total.

## Baixar a lista

Botão **Baixar lançamentos**, em PDF ou Word — nunca CSV.

**O arquivo respeita o filtro da tela.** Filtrou "só saídas"? O papel sai só com as
saídas. Baixar sempre tudo faria a pessoa descobrir o engano depois de imprimir.

O papel traz, no alto, quantos lançamentos, quanto entrou, quanto saiu e o saldo deles —
e uma nota dizendo que **as compras não estão ali**, porque quem recebe o arquivo não tem
como adivinhar isso.

## Quem pode

| | Ver a lista e o saldo | Lançar, corrigir, cancelar |
|---|---|---|
| Comprador | sim | sim |
| Administrador | sim | sim |
| Fundador | sim | **não** |
| Almoxarife, engenheiro, solicitante | **não** | não |

É a mesma dupla de permissões do resto do financeiro: `financeiro.ver` e
`financeiro.gerenciar`.

## O gráfico de fluxo

Antes o gráfico tinha três barras — pago, vencido, a vencer — e **as três eram saída**:
quem olhava via a construtora só gastando.

Agora **cada mês é um par**: entra à esquerda, sai à direita.

| Barra | O que é |
|---|---|
| Esquerda, azul sólido | **Recebido** no mês |
| Esquerda, azul listrado | **A receber**: prometido e ainda não caído |
| Direita | **Sai**, empilhado em pago, vencido e a vencer — como sempre foi |

> **Quem conta a direção é a posição, não a cor.** As três cores do gráfico já
> significam o ESTADO do dinheiro que sai. Pintar a entrada de verde faria o verde dizer
> duas coisas opostas no mesmo desenho. Por isso a entrada tem a cor que sobrou, fica
> sempre à esquerda, e a legenda nomeia os dois grupos.

**O número embaixo do mês é o saldo**: `+ R$ 295,6k` em verde quando sobrou, `− R$ 3,0k`
em vermelho quando faltou. As barras mostram os dois lados; o número diz o resultado.

A **despesa avulsa cai nas mesmas barras da parcela**, e isso não é atalho: do ponto de
vista do caixa, combustível pago em março e parcela paga em março são a mesma coisa —
dinheiro que saiu em março. De onde veio o gasto é assunto da lista, não do fluxo.

> **A barra de saída pode virar um fio.** Quando a medição do mês é de R$ 300 mil e as
> parcelas somam R$ 10 mil, a barra da direita quase some — e isso é o gráfico falando a
> verdade sobre a proporção. Para ver os números, toque na barra: a dica abre com cada
> linha, e a tabela logo abaixo do gráfico tem tudo por escrito.

---

# 42.10. A GS1 saiu, o código de barras ficou

A **GS1** é a entidade que mantém o cadastro mundial de códigos de barras. Assinando o
serviço dela, o sistema poderia perguntar *"que produto é este?"* ao bipar um código que
ainda não está no catálogo, e já sugerir a descrição.

**Decisão da reunião de 08/10/2026: a Porto Inc. não vai assinar.** É mensalidade para
uma conveniência, não para uma necessidade.

## O que saiu, e só isso

| | Antes | Agora |
|---|---|---|
| Campo **Código de barras** no material | tem | **tem** |
| Dígito verificador conferido ao salvar | sim | **sim** |
| Código repetido recusado | sim | **sim** |
| Bipar e achar no catálogo da Porto Inc. | sim | **sim** |
| Bipar desconhecido e receber descrição de fora | sim | **não** |
| Integração listada em Status do sistema | 5 | **4** |

Na prática, muda **uma frase** numa tela: ao bipar um código que não está no catálogo, o
sistema dizia *"Encontramos 'Cimento Portland CP-II 50kg' na base externa. Deseja
cadastrar?"*. Agora diz só para cadastrar. Quem cadastra digita a descrição — como já
digitava para todo item que não tem código de barras, que é a maioria do catálogo de uma
construtora.

## Onde foi parar a conta do dígito verificador

Ela morava junto da integração, em `integracoes/gtin/porta.ts`, e teria ido embora com a
pasta. **Mas a conta nunca foi da GS1**: é a regra do próprio código de barras, publicada
e fixa, e serve para pegar leitura incompleta e dedo errado.

Mudou de casa para `servicos/util.ts`, ao lado das outras validações da casa — CNPJ,
texto obrigatório, unidades. Os testes dela já moravam lá.

> **Para voltar atrás um dia**, o desenho ajuda: a GS1 era um **adaptador** atrás de uma
> porta. Religar é recriar a pasta e uma linha no `.env` — nenhuma tela precisa mudar.
> É a mesma tomada de sempre: hoje não há nada ligada nela, e a parede está intacta.

---

# 42.11. O menu encolheu, e não vai crescer de novo

Emerson, na reunião de 08/10/2026, logo no começo:

> *"Vai tudo ficar meio que encolhido, pra parecer que é pouca coisa — e ele querer
> colocar mais. Assim, mano, fica coisa demais. É pra dar meio que uma resumida no tanto
> de aba que tem aí."*

O pedido **não era ter menos telas**. Era o sistema PARECER enxuto, para o cliente querer
pedir mais.

## O que a medição mostrou antes de mexer

Quem via "coisa demais" era **só o administrador** — que é justamente a conta da
demonstração:

| Função | Abas que via | Linhas na barra |
|---|---|---|
| **Administrador** | **14** | **18** |
| Fundador | 11 | 15 |
| Comprador | 10 | 14 |
| Engenheiro / Gestor de obra | 7 | 11 |
| Almoxarife | 6 | 9 |
| **Solicitante** (quem mais usa) | **4** | 7 |

O pedreiro que abre solicitação já via quatro abas.

## A resposta já existia num canto do sistema

O menu listava 14 telas, mas o sistema tem 24. As outras dez já estavam escondidas:
**Cadastros** era uma linha com cinco telas atrás, **Financeiro** escondia as Notas
fiscais, **Estoque** escondia o Extrato. Ninguém nunca reclamou disso.

Então o que mudou foi aplicar o mesmo padrão ao menu inteiro.

## A barra agora

```
  Início
  ---------------
  Compras          -> Solicitações, Aprovações, Cotações, Pedidos
  Almoxarifado     -> Recebimento, Estoque, Locação
  Financeiro       -> Contas a pagar, Notas fiscais, Receitas e despesas
  Relatórios       -> tela única, com seis abas
  Administração   -> os cinco cadastros, Usuários, Avisos

**Os Relatórios ficam na barra, logo abaixo do Financeiro.** Eles não entram em destino
nenhum, e isso é escolha:

- **não cabem num só** — falam de orçamento, economia, fornecedores, tempos, consumo e
  estoque parado; enfiar em "Financeiro" diria que o relatório de consumo é assunto de
  dinheiro
- **e quem os lê nem sempre abre o financeiro** — o engenheiro e o gestor de obra têm
  permissão de relatórios e **não** têm a do financeiro. Morando dentro do Financeiro,
  os dois perderiam os relatórios por completo.

Mas o lugar deles é **perto do dinheiro**, e não no alto da barra. Então: solto, e
ancorado logo abaixo do Financeiro. Para quem não enxerga o Financeiro, eles caem no
mesmo lugar relativo — a ordem não muda de pessoa para pessoa.
```

**Seis linhas, para qualquer pessoa.** As quatro de baixo abrem uma tela com cartões, e
cada cartão traz o número do que está esperando: *"Aprovações · 3 esperando você"*.

> **O número é o que faz a parada valer.** Sem ele o índice seria um corredor — uma tela
> a mais entre a pessoa e o trabalho. Com ele, a pessoa decide onde entrar antes de abrir.
>
> E ele não custou consulta nova: vem do mesmo `/api/inicio` que já alimentava a tela
> inicial. **Uma conta, um lugar** — se o índice fizesse a própria, um dia diria 3 onde a
> outra diz 4.

## A tela de Início acompanhou

O bloco **Ir para** passou de 14 cartões para cinco. Se não tivesse mudado, o menu
ficaria enxuto e a primeira tela da demonstração continuaria dizendo "isto é enorme" —
seria trocar o problema de lugar.

Os dois blocos de cima — *O que precisa de você* e *Como estão as coisas* — ficaram
iguais: são o valor da tela.

## A regra que faz isso durar

> **Tela nova vira cartão num índice que já existe. Índice novo é decisão do dono.**

Com dez telas novas, a barra continua com seis linhas. **E isso está medido, não só
escrito:** `navegacao.test.ts` falha se alguém criar um quinto destino, e a conversa
acontece antes do commit em vez de seis meses depois com a barra em onze linhas.

## Dois endereços mudaram

| Antes | Agora |
|---|---|
| `/financeiro` (contas a pagar) | `/financeiro/contas` |
| `/cadastros` (o índice) | `/administracao` |

As telas filhas ficaram onde estavam: `/cadastros/materiais` continua o mesmo. E
`/cadastros` ainda funciona — leva para o endereço novo.

## O que se perdeu, dito com todas as letras

Quem usa o sistema todo dia passou a dar **dois cliques onde dava um**. Para o
solicitante, que via quatro abas e não achava nada demais, é perda pura.

A troca foi essa: pior para quem já usa, melhor para quem vai ver e pedir mais. Foi o que
a reunião pediu, e está escrito aqui para quando alguém perguntar por quê.

Três coisas amortecem: os números do topo do Início continuam levando **direto** à tela;
a migalha e o botão Voltar mostram o caminho inteiro; e Relatórios ficou solto na barra,
a um clique.

---

# 42.12. O que um lançamento de R$ 20 milhões quebrou

O dono lançou uma saída de **R$ 20.000.000,00** para testar, e a tela mostrou três
defeitos de uma vez. Os três valem para o sistema inteiro, não só para esta tela.

## 1. O número grande quebrava em duas linhas

`-R$ 19.705.971,70` tem 17 caracteres e não cabia no cartão. O navegador quebrava
**depois do sinal** — um traço sozinho na primeira linha e o valor na segunda. Quem bate
o olho lê um traço.

Dois consertos:

- o valor **nunca quebra** (`white-space: nowrap`)
- e **encolhe por degraus**, conforme o comprimento

Os cortes foram **medidos**, não chutados:

| Valor | Caracteres | O que acontece |
|---|---|---|
| `R$ 305.000,00` | 13 | cabe inteiro |
| `R$ 1.234.567,89` | 15 | encolhe um degrau |
| `-R$ 19.705.971,70` | 17 | encolhe dois |

> **O sinal conta**, porque ocupa lugar — era exatamente o caractere que sobrava.

A conta já existia escrita à mão dentro da rosca. Virou **uma regra só**, e cada lugar
traduz o degrau na unidade dele.

## 2. Fatia que existe dizia "0%"

Com R$ 20 milhões de um lado e R$ 3.240,50 do outro, o arredondamento levava as quatro
fatias pequenas para **0%** — afirmando que elas não existem.

Agora leem **`<1%`**. Zero de verdade continua `0%`.

## 3. "Lancei e não apareceu no gráfico"

Apareceu: como **Sem categoria**, 100% do bolo. E foi por isso que não pareceu aparecer —
a rosca virou um círculo de uma cor só e as outras fatias sumiram.

**O gráfico estava certo e o aviso faltava.** Quando "Sem categoria" passa de 20% do
gasto, a tela diz o valor e explica que o agrupamento sai do campo **Categoria** do
lançamento, e que dá para corrigir pelo menu da linha.

## E as explicações dos quatro cartões encolheram

Com os quatro "?" abertos, a fileira ficava esfarrapada — os textos tinham 3, 4 e 5
linhas.

**Não se consertou esticando os cartões.** Isso já foi tentado em 05/10 e produziu vazio
dentro da caixa, que é pior. Quem se igualou foi o **texto**: as quatro explicações
viraram duas frases curtas, do mesmo tamanho. A caixa segue a regra de sempre; o que
mudou foi a escrita.

---

# 42.13. As oito pendências, conferidas contra o documento de origem

Havia oito perguntas em aberto. O dono mandou conferir cada uma contra o **PDF do fluxo de
compras**, as **anotações do Iache** e a **transcrição da reunião de 08/10/2026**, em vez
de decidir no achismo. Três se fecharam só com a leitura.

## Fechadas pelo documento, sem código

**Baixa em conta a pagar é da Neilma ou do Andre?** O BPMN responde: na tabela de papéis,
*"Comprador | Monta BID, cotação, equalização, pedido, **contas a pagar** | Neilma"*. O
Andre aparece como *"(Admin/Financeiro) — **não está no BPMN**, mas aparece na reunião"*,
e o que ele faz hoje é controlar a planilha que este sistema veio substituir.

O sistema já está assim: quem tem `financeiro.gerenciar` é o **Comprador** e o
**Administrador**. Se o Andre precisar entrar, ele recebe uma dessas funções — é cadastro,
não código. **Nada a fazer.**

**O comprador precisa ver desempenho do fornecedor na hora de convidar?** O BPMN diz que o
convite sai *"para fornecedores da família correspondente"*. Nem o PDF nem as anotações
pedem nota de fornecedor nesse momento. Somado à verificação de 05/10 — que mostrou que
nenhuma rota de cotação lê desempenho, e que na escala da empresa "últimas 10 entregas" é
a vida inteira —, **fica fora**. Volta quando algum fornecedor passar de ~15 entregas.

**Comparativo de período nos relatórios.** Não está em documento nenhum, e sem histórico
real compara ruído com ruído. **Fica fora.**

## Resolvidas com código

### O relatório de Fornecedores passou a responder a própria pergunta

A aba se chama **"Em quem dá para confiar?"** e tinha dois gráficos desenhando **o mesmo
número**: a rosca repartia `valorComprado` e a barra ao lado mostrava `valorComprado`.
Comprar muito de alguém não diz se ele entrega.

O dado para responder já era calculado — `pontualidade`, do prazo prometido na cotação
contra o dia em que o caminhão chegou. Só não estava desenhado.

| Gráfico | Pergunta |
|---|---|
| **Concentração das compras** (rosca) | depender dele é risco? |
| **Quem entrega no prazo** (barras) | ele entrega? |

> **Só entra quem JÁ ENTREGOU.** Pontualidade de quem nunca entregou não é zero, é
> desconhecida — e uma barra vazia ao lado do nome acusaria o inocente. Quem foi
> convidado e nunca vendeu continua na tabela, com a leitura explicando.

### Um campo opcional agora dá para apagar

Preencheu errado o nome fantasia, a inscrição estadual ou a categoria de um lançamento?
Limpar o campo e salvar **não fazia nada**, sem erro nenhum na tela.

A causa: ausente, vazio e nulo viravam todos `undefined`, e `undefined` diz ao banco "não
mexa neste campo". Agora:

| O que a tela manda | O que acontece |
|---|---|
| campo ausente | o banco não toca |
| campo **em branco** | **apaga** |
| campo com texto | grava o texto |

Vale para as 67 chamadas do sistema.

### Quem mexeu no dinheiro fica registrado

O plano de arquitetura do projeto pede auditoria de *"toda aprovação, alteração de preço e
movimento de estoque"*. A solicitação tinha a trilha dela; o dinheiro lançado à mão, não
— dava para trocar uma entrada de R$ 100 mil por uma saída de R$ 100 mil, mexer R$ 200
mil no saldo, e não sobrar nem quem fez nem o que havia antes.

Menu **⋮** da linha → **Ver histórico**. Cada evento traz a data, quem fez e o quê:

```
  08/10/2026   Valor: R$ 96.500,00 -> R$ 99.999,00 ·
  Neilma       Categoria: Medicao de obra -> Medicao revisada
```

> **Só o que mudou de verdade entra.** Uma correção que trocou só o valor não anota sete
> campos iguais: trilha cheia de linha sem novidade é trilha que ninguém lê, e trilha que
> ninguém lê não audita nada.

> **A trilha nunca derruba o trabalho.** Se o registro falhar, o lançamento já aconteceu —
> devolver erro faria a pessoa repetir uma operação que deu certo, e duplicar dinheiro é
> pior que perder uma linha de log.

### Um botão azul por tela, na Equalização

Eram três — *Salvar escolhas*, *Gerar pedidos de compra* e *Reabrir e avisar os
fornecedores*. Três chamadas principais não chamam nada.

No fluxo da Porto Inc., o passo da equalização termina em **pedido**. Guardar escolhas
preserva o trabalho e não avança o processo; reabrir anda para **trás**. O azul ficou com
"Gerar pedidos de compra".

### O rodapé do indicador, no celular

O `margin-top: auto` existe para os cartões de uma fileira terminarem na mesma linha. Com
uma coluna só ele não alinha nada — só empurra: a frase descia até 61px abaixo do número
que ela explica. Agora só vale acima de 640px.

## E dois defeitos que apareceram no caminho

**O relatório escrevia "37.8%".** Juntar número com texto em JavaScript usa o ponto. Numa
tela que escreve "R$ 3.000,00" três dedos ao lado, dois separadores decimais conviviam —
e o errado é o que ninguém questiona, porque parece só um número.

**"Bandeirantes Elétrica" saía em vermelho** num gráfico chamado "Concentração das
compras". Nome de fornecedor não é estado: a rosca usava as cores de significado e a
quarta da fila era `erro`. Passou a usar a paleta sem significado.

---

# 42.14. Onze cópias da mesma função, e o que elas escondiam

Havia **onze** funções diferentes no backend para escrever dinheiro, uma por arquivo,
todas com o mesmo corpo copiado à mão. Mais cinco para quantidade e duas para
percentual. Dezoito no total, para três formatos.

A décima do dinheiro é a prova de que o problema não é desatenção: eu a escrevi neste
mesmo dia, em `rotas/lancamentos.ts`, **minutos depois de juntar três outras** — e no
arquivo que já importava a oficial, logo acima. Quando a cópia se chama `dinheiro(v)`,
ela parece local; e o que parece local ninguém procura em outro lugar.

Agora são três, todas em `servicos/util.ts`: `reaisBr`, `quantidadeBr`, `porcentoBr`.
As 83 chamadas passaram a usar o nome oficial em vez de um apelido por arquivo, de
propósito — procurar `reaisBr` no projeto agora acha **todo** lugar que escreve
dinheiro.

## O que as cópias escondiam

**Duas arredondavam diferente das outras nove.** As de `servicos/envio-pedido.ts` e
`servicos/fiscal.ts` pediam o mínimo de duas casas decimais e esqueciam o máximo — e o
JavaScript, sem máximo, mostra até três. Um preço de média ponderada, que é o que sai
de um recebimento parcial, saía assim:

| | antes | agora |
|---|---|---|
| e-mail que vai ao fornecedor | `R$ 1.234,567` | `R$ 1.234,57` |
| saída fiscal | `R$ 1.234,567` | `R$ 1.234,57` |

**Duas separavam o R$ do número com um espaço diferente.** As que usavam
`style: 'currency'` devolvem espaço **não separável** — outro byte, idêntico na tela.
Quem apertasse Ctrl+F num PDF e digitasse "R$ 1.800" com espaço comum não achava
aquelas linhas. Na tela o não separável é o certo, porque impede o "R$" de quebrar
para longe do número; em arquivo é o errado. O backend escreve arquivo, então ficou com
o espaço comum, e a tela continua com o outro — a diferença agora está escrita no
código, para ninguém "consertar" um nos moldes do outro.

**E o sinal do negativo estava do lado errado.** Este só apareceu porque consolidar
obrigou a escrever o primeiro teste que a função teve em toda a vida:

| | antes | agora |
|---|---|---|
| Saldo livre de orçamento estourado | `R$ -1.234,56` | `-R$ 1.234,56` |
| Saldo destes lançamentos | `R$ -19.701.951,70` | `-R$ 19.701.951,70` |
| Economia de cotação que fechou acima | `R$ -800,00` | `-R$ 800,00` |

A tela sempre escreveu `-R$`, porque usa `Intl`. A mesma linha de caixa saía de um jeito
na tabela e de outro no PDF da tabela.

> **Negativo que, escrito, é zero não é negativo.** Subtrair dois valores de dois
> decimais devolve `-4,5e-13` com frequência, e `-R$ 0,00` não quer dizer nada para quem
> lê. A função arredonda o módulo primeiro e decide o sinal depois — o que também mantém
> o meio centavo simétrico nos dois lados, porque `Math.round(-0.5)` no JavaScript
> devolve `-0`.

## A régua passou a olhar o backend

`npm run padrao` conferia sete regras, todas no frontend. Seis falam de tela — cartão,
cabeçalho, estado de lista, cor, espaçamento — e não fazem sentido numa rota. **A de
formatação faz**, e foi ligada: a varredura agora inclui `backend/src`, com
`servicos/util.ts` e `servicos/data-br.ts` como as duas casas oficiais.

A régua do frontend pegou a cópia que eu fiz do `porcento` neste mesmo dia, em minutos.
A do backend não existia — e por isso a décima cópia do dinheiro passou.

> **Juntar primeiro, ligar depois.** Ligar a varredura antes de consolidar deixaria a
> régua vermelha com 18 achados, e régua que vive vermelha é régua que todo mundo
> aprende a ignorar.

Provada nos dois sentidos: com uma cópia plantada de propósito em `rotas/estoque.ts` ela
acusou e nomeou o arquivo; desfeita a plantação, voltou ao verde.

---

# 42.15. Dois caracteres que o PDF desenhava errado, em silêncio

Achado baixando os arquivos para conferir o dinheiro com o olho, depois da consolidação.

Os PDFs do sistema usam as fontes padrão do PDFKit (Helvetica), que não precisam de
arquivo externo — é o que mantém o contêiner dentro de 1 GB. Essas fontes falam
**WinAnsiEncoding**, uma tabela de 256 posições. **O que está fora dela não dá erro: dá
outra letra.**

| no código | no PDF | onde aparecia |
|---|---|---|
| `− R$ 1.500,00` (menos matemático) | `" R$ 1.500,00` | **toda saída** do caixa |
| `marcada com ⚠` | `marcada com &` | legenda do relatório de Fornecedores |

O PDFKit escreve o byte **alto** do código do caractere: `0x2212` vira `0x22`, que em
WinAnsi é a aspa; `0x26A0` vira `0x26`, o "e" comercial. Sem aviso, sem registro, sem
teste vermelho — só a frase errada no arquivo que a pessoa baixou.

**O DOCX do mesmo lançamento sempre saiu certo**, porque guarda Unicode. Foi assim que
ficou provado: o leitor de DOCX engasgou no caractere `U+2212` que o Word recebia
intacto, enquanto o PDF trazia uma aspa.

A correção mora em `servicos/pdf-texto.ts` e vale **só para o caminho do PDF**: trocar o
menos no DOCX seria piorar o que já estava bom.

| | vira |
|---|---|
| `−` menos matemático | `-` hífen-menos |
| `⚠` triângulo de aviso | `(!)` |
| `→` e `←` | `->` e `<-` |
| qualquer outro fora da tabela | `?` |

> **O `?` é feio de propósito.** Um `?` numa descrição de material faz alguém perguntar,
> e a pergunta chega até aqui. O glifo errado — que é o que acontecia — não faz ninguém
> perguntar nada.

O saneamento acontece **uma vez, na porta** de cada gerador, e não em cada chamada de
texto: os geradores têm dezenas delas, e a que alguém esquecesse seria exatamente a que
ninguém olha.

## O que NÃO foi mexido, e por quê

O travessão (`—`), as aspas curvas e a bala (`•`) estão entre os 27 tipográficos que o
WinAnsi tem e o latin1 não. Ao ler o PDF como latin1, eles apareciam como um vão — e eu
quase "consertei" um caractere que o arquivo sempre desenhou certo. O leitor foi
corrigido antes da acusação.

E a célula do fornecedor marcado: a coluna *Participação* tem 29,4pt úteis, e
`100,0% (!)` ocupa 36,9pt, então ela quebra em duas linhas. Medido, e **deixado como
está**: `100,0% &` — o glifo quebrado de hoje — já ocupava 34,7pt, ou seja a célula já
quebrava antes da correção. Células quebram por desenho neste gerador, e a fileira cresce
junto. Alargar a coluna reflui as outras dez da tabela, e isso pede olho numa página
impressa, não um palpite.

---

# 42.16. "1 parcela(s)" — vinte e seis frases que não concordavam

A regra já estava escrita no sistema, num comentário de
`backend/src/rotas/relatorios.ts`:

> O "(s)" é a saída preguiçosa de quem não quis contar: sobra escrito no papel que vai
> para a diretoria, e quando o número é 1 está simplesmente errado. Contar custa três
> linhas.

Estava escrita, e valia **num lugar só** — a função logo abaixo do comentário. O resto do
sistema tinha 26 frases com `"(s)"`: doze no backend, sete delas dentro de PDF, e catorze
na tela.

## A função já existia, e eu fiz a segunda

`backend/src/servicos/inicio.ts` tinha uma `plural()` escrita dentro dele, com dez
chamadas e com o padrão de frase certo. Eu escrevi uma segunda em `servicos/util.ts` sem
achar a primeira — exatamente como aconteceu com o dinheiro algumas horas antes, no mesmo
dia. **Cópia com nome local parece local, e o que parece local ninguém procura em outro
lugar.**

Hoje há uma, em `servicos/util.ts`, e nenhuma outra.

## A palavra leva a frase inteira

Em português a concordância não para no substantivo: ela contamina o adjetivo e o verbo.

| antes | agora |
|---|---|
| `3 item(ns) marcado(s) como disponível estão…` | `3 itens marcados como disponíveis estão…` |
| `1 item(ns) marcado(s) como disponível estão…` | `1 item marcado como disponível está…` |
| `1 dia(s) de atraso, que custaram R$ 65,00` | `1 dia de atraso, que custou R$ 65,00` |
| `1 fornecedor(es) avisado(s)` | `1 fornecedor avisado` |
| `1 item(ns) não receberam nenhuma cotação` | `1 item não recebeu nenhuma cotação` |

Por isso a função recebe a **frase**, e não só o substantivo:

```
plural(n, 'dia de atraso, que custou',
          'dias de atraso, que custaram')
```

> **Partir isso em pedaços é como nasce "1 itens marcados".** Quem conserta o substantivo
> e esquece o verbo deixa um defeito de meio caminho, que parece conserto.

## Duas funções, porque há dois formatos de frase

Na tela apareceram dois casos onde escrever o número junto não serve:

**O número está em outro elemento.** `<strong>{n}</strong> usuários` põe negrito só no
número. Usar `plural` ali engrossaria a palavra também — mudaria o desenho da tela para
consertar a gramática.

**O verbo vem antes do número.** *"Falta 1 dia"* e *"Faltam 2 dias"*: o verbo concorda e
aparece primeiro, onde `plural` não alcança.

Para esses dois, `palavra(n, um, muitos)` devolve só a palavra. Fora deles, `plural`, que
resolve com uma chamada.

## O número agora sai formatado

A versão do backend escreve o número com `quantidadeBr`. A antiga concatenava cru, e
`1234 + ' pedido(s)'` dava **"1234 pedidos"**, sem o ponto do milhar, dentro de um PDF.
E o único chamador que passa média — o tempo médio de uma solicitação — ganhou as duas
casas que ela precisa: `4,53 dias`, e não `5 dias`.

> **O singular segue o número ESCRITO, não o calculado.** Com zero casas, 1,4 sai escrito
> "1" — e "1 dias" é exatamente o defeito que a função existe para matar.

## E um plural cravado, que a régua não acha

`frontend/src/paginas/admin/Usuarios.tsx` escrevia `<strong>{n}</strong> permissões`, com
a palavra fixa: com uma permissão a tela dizia **"1 permissões"**. É o mesmo defeito sem
o `"(s)"` para denunciá-lo — achado por estar na linha de cima de um que tinha.

## A oitava regra da régua

`npm run padrao` passou a conferir plural remendado, nos dois lados.

O regex tem de separar `dia(s)` de `setSituacao(s)` — o segundo é chamada de função com um
argumento chamado `s`, e existe de verdade em duas telas. O que os separa: substantivo
português escrito numa frase é minúsculo, identificador de JavaScript que recebe argumento
é camelCase; e chamada termina em `;` ou `)`, enquanto palavra de frase não.

Comentário e nome de teste ficam de fora: eles **citam** a forma errada de propósito.
Acusar o comentário que explica a regra seria acusar quem a documentou de não a seguir.

As oito regras passaram, com dívida zero nas oito.

---

# 42.17. A varredura que o Emerson pediu, e o que ela achou

Na reunião de 08/10 o pedido foi literal: *"pede pro Claude testar um por um e ver se está
funcionando, o que não está funcionando você me diz, corrige, e depois me diz o que ele
corrigiu."*

Foi o que se fez. **169 verificações**, com o navegador abrindo de verdade, as sete contas
entrando e o fluxo de compras percorrido de ponta a ponta — da solicitação ao pagamento,
passando pelo portal do fornecedor. Sem WhatsApp e sem ninguém de fora: a tela de cotação
tem **"Copiar link"**, que é o caminho que o comprador usa quando o WhatsApp não está no ar.

## O que a varredura confirmou que funciona

| | |
|---|---|
| Acesso | 7 contas, 21 rotas proibidas digitadas na barra de endereço — **todas barradas** |
| Telas | 66 visitas: todas carregam, com título, sem engolir erro de servidor |
| Formulários | 14 vazios e 4 com dado errado — **nenhum grava calado** |
| Fluxo de compras | 13 passos, 6 papéis, **ponta a ponta** |
| Downloads | 8 arquivos, PDF e Word, zero CSV |

E três travas de segurança respondendo como devem: limite de 200 chamadas por minuto,
**10 tentativas de login por 5 minutos** (força bruta) e **rotação da chave de renovação** —
a chave usada é revogada, de modo que uma chave roubada denuncia o roubo na segunda vez.

## O percentual que saía com ponto

```
R$ 339,50  +7.8%
```

Na **Equalização** — a tela que a anotação do Iache pede nominalmente: *"mostrar onde cada
fornecedor chegou no preço melhor"*. O backend calcula `7.8` e a tela colava o número no
texto, e juntar número com texto em JavaScript usa o ponto do inglês. Ao lado de
`R$ 339,50`, dois separadores decimais na mesma linha.

**E ele passou por tudo:** 1.320 testes, sete regras de padrão, e a correção do mesmo
defeito feita no dia anterior no relatório de Fornecedores. Passou porque a régua procurava
formatador **duplicado** (`toLocaleString` repetido), e aqui não havia formatador nenhum.

A régua ganhou uma oitava regra, e ela achou mais três casos na primeira execução:

| onde | saía |
|---|---|
| Relatórios → Fornecedores, barra de pontualidade | `66.7%` |
| O mesmo gráfico, no `aria-label` e no balão de dica | idem |
| Condição de pagamento, em cotação e no fiscal | `33.33% de entrada` |

O último é o mais sorrateiro: o campo de entrada aceita decimal, então basta o fornecedor
digitar `33,33` no portal.

> **CSS fica de fora da regra, e não por conveniência:** `style={{ height: 50 + '%' }}`
> *tem* de usar o ponto, senão o navegador não entende.

## Número grande

O dono não sabe de quanto é o faturamento da Porto Inc., e pediu folga até a casa dos
bilhões. A planilha "Análise de aprovação" do próprio fluxo de compras já traz linhas de
**R$ 1.894.926,96** — a escala real é o milhão.

Três coisas estavam no caminho, todas na mesma função, a que escreve o eixo dos gráficos:

| | antes | agora |
|---|---|---|
| Bilhão | `R$ 1000,0M` | `R$ 1,0B` |
| Negativo | `R$ -20,0M` | `-R$ 20,0M` |
| Separador | trocado à mão | localizado |

E no PDF: a **célula de número agora encolhe a fonte** em vez de quebrar em duas linhas. A
coluna mais estreita do sistema é a do relatório de Fornecedores, com 59,3pt úteis, onde
`R$ 1.894.926,96` embrulhava. O cabeçalho já fazia isso desde sempre; a célula, onde mora o
dinheiro, não.

> **Alargar a coluna consertaria uma tabela. Encolher a fonte conserta todas.**

As quatro telas de dinheiro foram medidas com um bilhão dentro, em 1920, 1440 e 420px:
nenhuma rola para o lado, nenhum texto estoura.

## O aviso que nascia atrás do modal

Em **Notas fiscais**, clicar em "Lançar nota" com o formulário vazio parecia não fazer
nada. A mensagem existia — *"Escolha o pedido de compra a que esta nota se refere."* — mas
nascia **fora** do `<dialog>`, em `y=374`, enquanto o modal cobria de `y=48` a `y=852`.
Ficava atrás do véu.

Agora mora dentro do formulário enquanto ele está aberto, e fora quando fechado. Nunca nos
dois lugares: duas cópias com `role="alert"` fazem o leitor de tela anunciar a mensagem
duas vezes.

## E a casa da formatação ficou uma só

`dinheiro` e `quantidade` moravam em `servicos/cadastros.ts` — um **cliente de API**, com
dois formatadores pendurados no fim. O resto sempre morou em `servicos/texto.ts`. Vinte e
três arquivos importavam formatação do lugar errado.

Hoje é uma casa só, e isso destravou um defeito antigo: `plural(1234, 'nota', 'notas')`
escrevia **"1234 notas"**, sem o ponto do milhar. Só dava para consertar com a função de
quantidade morando no mesmo arquivo — importar o cliente de API dentro do módulo de texto
arrastaria código de rede para lá.

---

# 42.18. Os buracos das réguas, e as duas que mentiram

A varredura funcional achou defeito; mas ela também mostrou **onde as réguas não enxergam**,
e isso é mais caro, porque uma régua cega aprova o que está errado. Quatro buracos foram
tapados, e cada conserto foi conferido **nos dois sentidos**: a régua passa no que está
certo, e acusa quando o defeito é plantado de propósito.

## O percentual que nenhuma régua procurava

A régua de padrão caçava formatador **duplicado** — `toLocaleString` escrito à mão ao lado
da função oficial. Na Equalização não havia formatador nenhum: o número ia colado no texto
com `+`, e o JavaScript escreve `7.8`. A nona regra procura esse `+` e achou mais três
casos na primeira execução.

## O limite de 30 segundos que não existia

A régua de telas travou calada por **doze minutos** na tela 38 de 40. O motivo de fora: eu
editei código do servidor no meio da medição, o servidor reiniciou, e uma promessa nunca
voltou. O motivo de dentro: a conversa com o navegador **não tinha prazo**. Hoje tem teto
de 30 segundos, e o navegador fechando derruba o que estava pendurado.

E a foto saiu do caminho da medida: **duas tentativas por foto**, e falhar na foto custa a
foto, não a medição da tela. Na varredura final isso salvou doze telas.

## A régua que acusou um desenho certo

Em Aprovações, a régua acusou **"dois botões principais ao mesmo tempo"** nas três larguras.
Os culpados eram dois links **"Analisar"**, um por linha da fila — e o azul ali é
deliberado: ele diz *"esta espera a sua assinatura"* antes do clique, e a linha que não é
sua fica branca, com o rótulo "Ver".

Só apareceu agora porque a varredura **encheu a fila**: antes havia uma solicitação, passou
a haver três.

A regra da casa dizia *"ação de linha de tabela é discreta"*, e estava escrita larga demais:
descrevia o caso comum como se fosse o único. Hoje a regra tem a exceção escrita — **numa
fila, cada linha é um próximo passo** — e a exceção tem **condição**, que a régua também
cobra: se a página tiver botão de criar no cabeçalho, ele volta a competir com as linhas, e
aí a tela é acusada.

## As duas que mentiram sobre a senha

A régua de telas morreu com `não apareceu .menu__lista em 40s` — mensagem que manda procurar
defeito na barra lateral. Não era a barra lateral: era a **senha de fábrica embutida na
régua**, que não serve para a conta que ela usava.

Puxando esse fio, dois documentos estavam errados:

| onde | dizia | é |
|---|---|---|
| Guia de teste manual | "todas usam a senha `Porto@2026`" | a conta `admin@` usa **`admin123`** |
| Guia de navegação | as seis contas de papel "foram criadas por você, só quem criou sabe a senha" | elas **nascem com a instalação**, com `Porto@2026` |

A segunda é a pior: quem lesse o guia concluía que **não dava para entrar como o Andre** —
e dava, desde sempre. As duas tabelas agora trazem conta, senha e papel, lado a lado, e a
régua usa a conta DEV por padrão, que é a única que enxerga as 40 telas.

> **A lição:** documento que descreve acesso é **testável**. Enquanto ninguém testa, ele
> envelhece em silêncio, e quem perde tempo é quem confiou nele.

---

# 42.19. A mudança de casa: o que a simulação de entrega consertou

Em 09/10/2026 o sistema foi **zerado e entregue a uma empresa fictícia**, que entrou por
onde a Porto Inc. vai entrar: sete contas criadas uma a uma, duas obras, dois
almoxarifados, duas famílias, quatro materiais, dois fornecedores, três faixas de alçada,
orçamento por planilha, R$ 2 milhões em caixa e um ciclo completo de compra.

Saíram **16 achados**. Estes são os consertos.

## A senha provisória não abre mais o sistema

O pior de todos, e o mais barato de corrigir. O banco marcava a conta, o servidor mandava
a marca no login, o frontend declarava o campo no tipo — **e nenhuma tela lia**. As sete
contas entraram direto no painel com a senha que o administrador tinha digitado.

| | |
|---|---|
| Na tela | um terceiro estado: *sem conta* → **precisa criar senha** → *com conta* |
| No servidor | o porteiro recusa tudo, menos saber quem é, trocar a senha e sair |

A trava fica nos dois lugares porque é a regra escrita da casa: *"permissão verificada no
servidor — nunca só escondendo botão na tela"*.

E a tela fala a língua do momento: o título é **"Crie a sua senha"**, o campo é **"A senha
que você recebeu"** (ela não tem uma senha "atual"), e o botão é **"Criar minha senha"**.

> **No dia seguinte isto mudou de lugar, e continua valendo.** Em 10/10/2026 a senha
> provisória foi aposentada: cadastrar alguém passou a gerar um **link**, e por ele
> ninguém recebe senha de outra pessoa. A trava descrita aqui **não virou código morto** —
> ela é o caminho do **primeiro administrador**, criado pela linha de comando com senha
> sorteada, que não tem a quem pedir um link. Ver *Cadastrar uma pessoa nova*.

## O preço, que decide quem assina

Um pedido de **800 tubos — R$ 25.200** — foi para a fila de quem assina até R$ 2.000. O
valor unitário era opcional, e sem ele o total dá R$ 0,00, que cai na menor faixa.

Três camadas:

1. o preço vem sozinho **da linha de orçamento** da obra, que a empresa já importou;
2. quem digita manda sobre o orçamento;
3. sem preço em lugar nenhum, o envio é recusado.

Junto, o **prazo** virou obrigatório — está na lista de campos obrigatórios da análise do
fluxo de compras desde o primeiro dia —, cobrado **uma vez** por solicitação, não por item.

## O que falta, antes do clique

A conferência de envio passou a vir **junto com a solicitação**, não só depois de uma
tentativa recusada. A tela diz *"Faltam 2 coisas para enviar"* com a lista, e o botão
espera. É a Parte 3.2 do DESIGN: trava onde a pessoa vê o que falta.

## O Almoxarifado Central

A decisão D3 diz "por obra, com um Almoxarifado Central como mais um local". A peça inteira
existia — coluna opcional de obra, marca `central`, o recebimento já oferecendo "os desta
obra **ou** os centrais" — e **quem criava o central era a semente**, que não roda em
produção. A empresa recebia o sistema sem lugar para o que não é de obra nenhuma.

Passou para a migração `0024`, onde nasce com a instalação. As obras seguem com os seus,
sem mudar nada.

## A instalação, três achados por um arquivo

```
antes:  migrate deploy && seed && dev
agora:  migrate deploy && prisma generate && seed-se-vazio && dev
```

- **`prisma generate`** — o `node_modules` do contêiner é volume anônimo. Um
  `down -v` o apaga, e ele volta **da imagem**, com o cliente gerado na última construção.
  Na simulação isso derrubou o Financeiro inteiro com erro 500 na primeira tela que a
  empresa abriria.
- **`seed-se-vazio`** — a semente usa `upsert` e rodava a cada subida. Reiniciar a API
  ressuscitava 8 contas com senha conhecida. Agora só planta em banco sem nenhum usuário.
  *(Provado ao vivo: antes de reconstruir a imagem, a semente recriou 6 contas; depois,
  o log diz "O banco já tem 14 usuário(s). Nada foi plantado.")*
- **`package.json` montado** — o `npm` de dentro anunciava 0.40.0 com o projeto em 0.56.0.

## Fornecedor sem família, e o "já aconteceu" sem volta

Dois avisos que chegavam tarde:

- o cadastro de fornecedor **avisava** que sem família ninguém é convidado a cotar, e
  deixava salvar assim mesmo. Agora exige, na tela e no servidor.
- lançamento nascido "já aconteceu" não voltava a ser previsão: a caixa só aparece na
  criação. Nasceu **"Voltar para previsto"**, e a volta fica no histórico — desfazer não é
  apagar.

## O dinheiro que a empresa já tinha

A empresa não começa do zero: chega com caixa. O financeiro conhecia dois tipos, e o
único caminho era lançar o saldo como receita — o que faz o cartão anunciar **"Entrou
R$ 2.000.000,00"** de um dinheiro que ninguém faturou, e a rosca marcar *Saldo inicial,
100%*.

> **A proposta era um terceiro tipo, e virou uma marca.** Sete lugares do caixa perguntam
> `tipo === 'RECEITA'` para somar. Com um tipo novo, cada um esquecido faria o dinheiro
> **desaparecer** da conta. A marca falha para o lado seguro: o saldo inicial continua
> sendo entrada, todas as somas seguem certas, e só as leituras que falam de
> **faturamento** passam a descontá-lo.

Agora o cartão diz: *"Entrou R$ 2.000.000,00 — sendo R$ 2.000.000,00 de saldo inicial;
faturado aqui: R$ 0,00"*.

## Importar catálogo e fornecedores

Até aqui, **só o orçamento tinha porta**. O formulário de material tem 10 campos e o de
fornecedor tem 9: uma construtora com 400 materiais e 80 fornecedores digitava quase
**5.000 campos** para sair da planilha — que é o que o sistema inteiro existe para fazer.

As duas importações novas seguem a forma da de orçamento, e o painel virou **uma peça
só** para as três: copiá-lo três vezes garantiria três redações diferentes na primeira
correção, que é a história dos 29 cartões que deram origem ao `Cartao`.

| | |
|---|---|
| Materiais | `familia;codigo;descricao;unidade;marca;norma;gtin;ponto_pedido;linha_orcamento` |
| Fornecedores | `cnpj;razao_social;nome_fantasia;email;whatsapp;cidade;uf;familias` |

A família vai **pelo código** (`ELE/HID`), não pelo nome: nome muda, código é o que a
empresa já usa na planilha dela. Linha torta não derruba o arquivo — vira um problema com
o **número da linha**, e o resto entra. Reimportar não duplica.

---

# 42.20. Criar funções: a metade que faltava

A primeira página do fluxo de compras da Porto Inc. traz, como **regra confirmada**:

> *"Um usuário pode acumular mais de uma função, **e as funções devem ser criáveis dentro
> do sistema**."*

A metade de cima existia desde a Etapa 1 — o Bras acumula Gestor de obra e Solicitante, e
o que ele enxerga é a soma dos dois. A de baixo não: havia nove funções vindas de migração
e nenhuma forma de criar a décima. A permissão `funcoes.gerenciar` existia no banco e só
servia para **ler** a lista.

Achado na análise de coerência de 09/10/2026, e construído em 10/10.

## Onde fica

**Administração → Usuários**, na aba **Funções** — e só quem tem `funcoes.gerenciar` enxerga a aba. Hoje, só o
Administrador. Quem não tem nem vê o item na barra.

## O que a tela faz

Criar função sem escolher o que ela pode seria um nome sem conteúdo, então é tudo numa
coisa só: o nome, o código e as caixas do que ela faz. **Pelo menos uma caixa**, senão o
botão espera.

As 27 permissões vêm repartidas em sete grupos — Almoxarifado, Cadastros, Compras,
Financeiro, Locação, Relatórios, Sistema —, porque 27 caixas soltas numa coluna ninguém lê.

| | Nome e código | Permissões | Apagar |
|---|---|---|---|
| **As oito do fluxo de compras** | travados | ajustáveis | não |
| **As que a empresa criar** | ajustáveis | ajustáveis | sim, enquanto ninguém usa |

O nome e o código das oito ficam porque um é citado em documento e o outro em migração.
**A descrição não**: é frase para gente ler, e reescrevê-la com as palavras da Porto Inc.
é justamente o que a empresa deve poder fazer.

## Duas coisas fora de alcance, e por quê

**A permissão "Status do sistema" não é oferecida.** Ela abre a tela de diagnóstico, e o
guia de navegação promete que essa tela *"não aparece para mais ninguém, nem para o
administrador"*. Numa lista de caixas, a promessa se desfaria com um clique e sem ninguém
perceber.

**A função DESENVOLVEDOR não se ajusta pela tela.** Mesmo motivo: ela existe para quem
mantém o sistema.

## E uma trava que vale ouro

O administrador podia, com um clique, tirar `usuarios.gerenciar` da própria função — e a
partir dali ninguém mais criaria conta, ninguém ajustaria função, e a saída seria mexer no
banco por fora.

O sistema recusa:

> *"Tirar "Criar e editar usuários" daqui deixaria o sistema sem NINGUÉM capaz disso. Dê
> esta permissão a outra função — e a alguém — antes."*

A conta pergunta por **gente**, não por função: uma função com a permissão e sem ninguém
dentro é uma chave trancada na gaveta.

## O Fornecedor saiu

Ele estava na lista de papéis do BPMN e virou função na migração 0001. Mas o fornecedor
**não entra no sistema**: responde cotação pelo portal, por link com prazo de validade.
A função nunca foi dada a ninguém, nunca teve permissão, e não é citada em uma linha de
código.

Com a tela nova no ar, ela passou a ocupar um cartão dizendo *"Ninguém com esta função ·
Não faz nada"*. Saiu na migração `0026`. Cadastro que não serve para nada ensina quem usa
a ignorar a tela.

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
| **13 — Páginas nas listas** | As dez listas que crescem passaram a dizer o total de verdade e a ter barra de páginas. Antes cortavam em 200 e diziam que era tudo |
| **14 — Contas da tela inicial** | Os cartões do Início passaram a contar no banco. O de aprovações parava em 500 e mostrava um número menor que o certo, sem avisar |
| **15 — Peso dos relatórios** | Estoque parado deixou de carregar o extrato inteiro; Fornecedores deixou de trazer quem nunca foi convidado. Nenhum número mudou |
| **16 — Data no desempenho** | O relatório de Fornecedores ganhou a data da última entrega e o período que a história cobre. Era o único dos seis sem noção de tempo |
| **17 — Cartão sem vazio** | A grade dos painéis parou de esticar os cartões. Abrir um "?" crescia a fileira inteira, e os gráficos tinham até 180px de nada dentro |
| **18 — Blocos que pareiam** | Os gráficos lado a lado passaram a nascer do mesmo tamanho: teto de 4 barras e o mesmo ritmo de linha nos dois |

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

Uma pergunta ficou em aberto, e é de produto, não de código:

- **O comprador precisa ver algo sobre o fornecedor na hora de convidar?** Hoje ele
  escolhe sem nenhuma informação de desempenho, e a tela marca todos por padrão. O
  relatório existe, mas fica a dois cliques de distância do momento da decisão.

Fora essa, o módulo 1 está fechado e o esqueleto está pronto para receber o módulo 2.

## Finalização (sem data)

Ligar as integrações de verdade e instalar num servidor **não é etapa**: não espera
código que falte aqui, espera uma decisão da direção — e não há data marcada.

- WhatsApp, nota fiscal e banco ligados de verdade
- Sistema instalado no servidor definitivo — é aqui que entra a decisão de **nuvem ou
  servidor na construtora**
- Treinamento da equipe

> Até lá **nada sai do sistema para fora**, e vale ser exato sobre como isso é garantido:
> nota fiscal, pagamento e e-mail estão em `mock` — nem tentam falar com fora. O WhatsApp
> é o único ligado num adaptador real (`baileys`), e quem o segura é outra trava:
> `WHATSAPP_MODO_TESTE=true` com a **lista de autorizados vazia**, então toda mensagem
> para numa porta só, antes de sair.
