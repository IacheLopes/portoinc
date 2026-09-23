<!-- versao: 0.21.0 -->

# Design do sistema — Porto Inc.

> Este documento é para quem **mexe** no sistema, não para quem o usa.
> Quem usa tem o `Tutorial-PortoInc.pdf`.
>
> Aqui ficam as decisões visuais e o porquê de cada uma: escalas, cores, anatomia das
> peças, e o registro do que mudou em cada etapa. O tutorial recebe o que a pessoa
> **faz**; este documento recebe o que o sistema **é**.

---

# Parte 1 — O padrão

## 1.1 De onde ele veio

Quatro telas de painel foram dadas como referência, em tema claro e escuro. Delas foi
tirada a **linguagem visual**, não o conteúdo — a referência é um painel de gestão de
projetos; este é um sistema de compras e almoxarifado. Copiar a disposição daria telas
bonitas que não batem com o trabalho.

O que foi aproveitado:

1. **Anatomia igual em todo cartão** — título à esquerda, ação à direita, corpo embaixo
2. **KPI é número grande com gráfico pequeno ao lado**, não número solto
3. **Muito respiro** — canto arredondado, borda suave, fundo do cartão quase da cor da página
4. **Cor com significado**, não decoração
5. **Lista dentro de cartão** — ícone, duas linhas de texto, números alinhados à direita
6. **No celular** os cartões viram largura cheia e as ações sobem para o topo

O que foi **recusado**, e por quê:

| O que | Por que não |
|---|---|
| Menu "⋮" em todo cartão | Na maioria não faria nada. Menu vazio é ruído |
| O contraste baixo do texto secundário no escuro | Nas referências ele está no limite da leitura. A regra de contraste do sistema continua valendo |
| O layout literal | É outro domínio. A forma se copia, a disposição não |

## 1.2 Cor

Toda cor sai de `frontend/src/estilos/tokens.css`. **Nenhuma tela escreve cor solta** — o
conferidor de padrão acusa quem escrever.

Os tokens são divididos em três camadas:

- **Marca** — `--marinho-*`, `--azul-*`. Não mudam com o tema
- **Neutros** — `--neutro-0` a `--neutro-900`. A matéria-prima
- **Papéis** — `--fundo`, `--texto`, `--borda`, `--menu-*`. **São estes que trocam com o tema**

Uma tela que usa papéis funciona nos dois temas sem saber que eles existem. Uma tela que
usa neutros direto quebra no escuro.

### Cor nunca informa sozinha

Verde, amarelo e vermelho sempre vêm acompanhados de ícone ou texto. Cerca de 8% dos
homens não distingue verde de vermelho; para eles um selo colorido sem palavra não diz
nada.

Para texto sobre fundo colorido existe um token separado (`--sucesso-texto`,
`--erro-texto`...), mais escuro no tema claro e mais claro no escuro. A cor cheia serve
para botão e borda; para texto pequeno ela não alcança o contraste mínimo de 4,5:1.

## 1.3 Espaçamento

Escala de 4px. **Só ela.**

| Token | Valor | Onde se usa |
|---|---|---|
| `--esp-1` | 4px | Entre rótulo e campo |
| `--esp-2` | 8px | Entre itens de uma mesma linha |
| `--esp-3` | 12px | Dentro de um item |
| `--esp-4` | 16px | Dentro do cartão |
| `--esp-5` | 24px | Entre cartões |
| `--esp-6` | 32px | Entre seções |
| `--esp-7` | 48px | Respiro grande |
| `--esp-8` | 64px | Separação de bloco |

O que a escala resolve é **proximidade**: o que é do mesmo assunto fica mais perto do que
o que não é. Valor solto é o que faz uma tela respirar diferente da outra sem ninguém
saber explicar por quê.

## 1.4 Tipografia

| Token | Valor | Para quê |
|---|---|---|
| `--txt-xs` | 12px | Rótulo de coluna, legenda |
| `--txt-sm` | 14px | Texto de tabela, item de menu |
| `--txt-md` | 16px | Texto corrido |
| `--txt-lg` | 18px | Subtítulo |
| `--txt-xl` | 24px | Título de seção |
| `--txt-2xl` | 32px | Título de tela |
| `--txt-3xl` | 40px | Número grande de KPI |

Altura de linha: `--linha-apertada` (1,25) para título, `--linha-normal` (1,55) para
texto, `--linha-solta` (1,7) para leitura longa. Título com entrelinha de texto parece
solto; texto com entrelinha de título cansa.

**Largura de leitura:** `--largura-leitura`, 70 caracteres. Linha mais longa faz o olho
perder a volta ao trocar de linha.

**Regras de hierarquia:**

- Um `<h1>` por tela, sempre. É por ele que o leitor de tela anuncia onde a pessoa chegou
- Nunca pular nível — de `h1` para `h3` deixa buraco na estrutura
- Maiúsculas só em rótulo de coluna e título de cartão, nunca em texto corrido

**Números:** dígitos de largura fixa (`font-variant-numeric: tabular-nums`) em tabela e
em KPI. Sem isso a coluna dança a cada atualização.

## 1.5 Alinhamento

- Número à **direita**, texto à **esquerda**. Sempre, sem exceção
- Rótulo e campo no mesmo eixo vertical
- Cartões da mesma fileira alinhados pelo **topo**, não pelo centro — centralizados, uma
  descrição de duas linhas empurra o título para fora da linha dos vizinhos

## 1.6 Alvo e foco

- **44px** de altura mínima para qualquer coisa que se toca com o dedo
- No computador, item de menu pode ter 40px: ali o alvo é o ponteiro. No celular volta a 44
- Contorno de foco visível em **tudo** que recebe teclado. Nunca remover sem pôr algo no lugar

## 1.7 Os dois temas

**O claro é o padrão. O escuro é escolha**, feita no botão do rodapé do menu e lembrada
pelo navegador.

Antes o sistema seguia a preferência do Windows: quem tinha o computador no escuro
recebia o sistema escuro sem nunca ter pedido, e sem ter como voltar.

Detalhes que importam:

- O tema entra **antes de a página desenhar**, por um script no `index.html`. Sem isso a
  página pinta clara e só depois vira escura — um flash branco a cada carregamento
- O claro é a **ausência** de marca no HTML; só o escuro marca. Um estado a menos para
  manter sincronizado
- A barra do navegador no celular (`theme-color`) acompanha
- Armazenamento bloqueado (janela anônima, política da empresa) não quebra nada: abre no claro

### A moldura de navegação acompanha o tema

A barra do topo e o menu lateral usam os mesmos tokens (`--menu-*`) e trocam juntos.

Os tons deles **não são** os mesmos do conteúdo: uma navegação que se confunde com a área
de trabalho faz a pessoa perder a referência de onde está. No claro a moldura é mais clara
que o conteúdo; no escuro, mais escura.

O cinza do texto secundário é **diferente em cada tema**. Sobre fundo quase preto, o cinza
que funciona no claro vira mancha ilegível.

## 1.8 Hierarquia de botão

| Tipo | Quando |
|---|---|
| **Principal** | **Um por tela.** A ação que a pessoa veio fazer |
| Secundário | Ações de apoio |
| Discreto | Ação de linha de tabela, ação de baixo risco |

Quando o olho vê três botões "principais", nenhum é principal.

## 1.9 Modal

**Modal serve para interromper. Se não há motivo para interromper, ele atrapalha.**

**Entra em:**

- Confirmação de coisa irreversível — cancelar nota, cancelar locação, devolver
  equipamento, reprovar solicitação, remover arquivo
- Formulário **curto**, até uns 6 campos
- Download de relatório, onde há escolha real (obra, período, o que incluir)

**Não entra em:**

- Formulário longo com lista de itens — no celular vira caixa dentro de caixa, com duas
  barras de rolagem
- Qualquer coisa que precise de endereço próprio. Modal não tem link
- Download simples de tabela, com duas opções. O menu suspenso basta
- **Modal dentro de modal: nunca.** Se precisou, o fluxo está errado e é o fluxo que se conserta

**O contrato** — é a peça que mais se faz errado:

- `<dialog>` nativo, não uma `div` fingindo ser janela
- O foco **entra** ao abrir e **volta para o botão** que o abriu ao fechar
- Foco preso dentro enquanto está aberto
- **Esc** fecha; com campo preenchido e não salvo, pergunta antes
- O fundo não rola atrás
- No celular ocupa a tela inteira

## 1.10 O conferidor de padrão

```
cd scripts
npm run padrao
```

Lê o código-fonte e acusa o que foge do combinado. É o que faz o padrão durar depois que
esta fase acabar.

**A dívida conhecida.** O sistema foi construído antes do padrão existir, então já nasce
com violações. Um conferidor que reprova desde o primeiro dia é um conferidor que todo
mundo aprende a ignorar. Por isso ele compara com `scripts/padrao-divida.json`: **reprova
quando um número sobe**, e avisa quando cai. A dívida encolhe a cada etapa.

**Exceção declarada.** Quando uma regra não se aplica, o próprio arquivo diz por quê:

```
// padrao-ignora: sem-titulo — é conteúdo de aba; o <h1> é do invólucro
```

Sem essa saída a ferramenta obrigaria a inventar um título errado só para calar a boca —
que é como um conferidor piora o sistema em vez de melhorar.

---

# Parte 2 — O diário das etapas

## Design 0 — Fundação

**O que entrou**

| | |
|---|---|
| Tema | O claro virou o padrão de verdade. O escuro deixou de ser automático e virou escolha, com botão no rodapé do menu e memória no navegador |
| Moldura de navegação | Barra do topo e menu lateral passaram a usar os mesmos tokens e a trocar com o tema |
| Escalas | `--esp-8`, `--txt-3xl`, `--raio-xl`, alturas de linha e largura de leitura |
| Padrão | Este documento |
| Conferidor | `npm run padrao`, com a dívida atual registrada como linha de base |

**Duas coisas que só apareceram ao abrir o código**

1. **A barra lateral já acompanhava o tema.** Quem estava preso no azul-marinho era a
   barra do **topo**. A impressão de que a lateral era fixa vinha de o sistema seguir o
   Windows: com o computador no escuro, tudo ficava escuro. As duas passaram a usar os
   mesmos tokens de qualquer forma — para quem usa, elas são a mesma moldura.

2. **Os atalhos da tela de Início estavam desalinhados.** Numa mesma fileira, o título de
   um cartão ficava 9px abaixo do vizinho. A causa era `align-items: center`: com uma
   descrição de uma linha e outra de duas, os títulos paravam em alturas diferentes.
   Alinhados pelo topo, a fileira inteira volta à mesma linha.

**A dívida registrada**

| Regra | Dívida |
|---|---|
| Telas com mais de um botão principal | 13 |
| Cartões escritos à mão | 29 |
| Dinheiro ou data formatados fora das funções oficiais | 5 |
| Telas de lista sem os três estados | 5 |
| Cor escrita direto no CSS | 2 |
| Espaçamento em px fora da escala | 4 |
| Telas sem título | 0 |

Cada etapa seguinte derruba parte disso. O Design 2 (peças) zera as duas maiores.

**Conferido**

- Abre no claro mesmo com o Windows no escuro
- O botão troca, e a escolha sobrevive ao recarregamento
- 60 provas de tela verdes
- Alinhamento medido nas duas larguras, sem achados

## Design 1 — Cabeçalho e navegação

**A situação antes.** Das 34 telas, 9 mostravam onde a pessoa estava e 2 tinham algum
"Voltar" — e nessas duas ele ficava no rodapé do formulário, não no topo. Nas outras 25,
quem entrava só saía pelo menu ou pelo botão do navegador.

**A estrutura**, agora igual em 30 telas:

```
Início › Cotações › Pacote de cotação        ← Voltar para Cotações
────────────────────────────────────────────────────────────────────
Pacote de cotação BID-00002   [Em aberto]         [Baixar] [Convidar]
Material elétrico — 2º pavimento
```

### Três decisões, e o porquê

**O Voltar leva à tela-mãe, não à anterior.** Voltar "para a anterior" parece igual mas
não é: se a pessoa chegou por outro caminho, ou acabou de salvar um formulário, o botão a
joga num lugar inesperado ou numa tela desatualizada. A tela-mãe é sempre o mesmo lugar.

**O rótulo diz o destino** — "Voltar para Cotações", não uma seta solta. Quem usa leitor
de tela ouve para onde vai; quem enxerga também.

**O último degrau da migalha não é link.** É onde a pessoa está. Link que não leva a lugar
nenhum engana quem navega por teclado: aperta Enter e nada acontece.

### Onde a hierarquia mora

Em `navegacao.ts`, junto da lista que monta o menu. Mesmo motivo de antes: quando menu e
migalhas liam listas separadas, elas divergiram e a tela de Início passou meses anunciando
coisa que não era mais verdade.

Os coringas da rota são trocados pelos valores do endereço atual — numa equalização, o
Voltar leva **àquela** cotação, não à lista.

### As quatro telas de fora

Cada uma com o motivo escrito no próprio arquivo:

| Tela | Por quê |
|---|---|
| Entrar | Não há sistema atrás dela para onde voltar |
| Portal do fornecedor | É de quem não tem conta nem menu no sistema |
| Abas de WhatsApp e E-mail | O cabeçalho é do invólucro; dois títulos na mesma tela quebram a hierarquia |

### Virou medição

O conferidor ganhou a regra **"telas sem o cabeçalho padrão"**. Tela nova sem Voltar
reprova. "Voltar em todas as páginas" deixou de ser promessa e virou fato conferido.

### Três erros do script de conversão

Trinta telas convertidas por script, e ele errou três vezes. Vale registrar porque são
erros que qualquer conversão em massa comete:

1. **Apagou a descrição de 27 das 30 telas.** O padrão de busca exigia que a descrição
   fosse o fim do bloco, e o bloco termina noutra tag. A pasta das telas foi devolvida ao
   marco anterior e o trabalho refeito.
2. **Jogou fora os selos de situação** de 5 telas de detalhe. Apareceu porque o compilador
   passou a acusar `Selo` importado e não usado — import sobrando é sintoma, não sujeira.
   O cabeçalho ganhou um lugar próprio para eles, porque "SOL-00018, aguardando aprovação"
   é uma coisa só.
3. **Transformou um título em texto literal.** Apareceria com as chaves na tela.

**A lição:** conversão em massa precisa de conferência do RESULTADO, não só do compilador.
Os três passaram pela compilação; dois só apareceram ao olhar a tela e o aviso de import.

### Conferido

- 769 provas verdes (355 unidade, 325 integração, 89 tela)
- Alinhamento sem achados em 1440px e 420px
- Conferidor aprovado, com a regra do cabeçalho em ok

## Design 2 — As peças

### A seta do campo de escolha (D1 da lista)

Estava com `appearance: auto`: quem desenhava era o navegador, e ele a punha onde queria
— medido, 34px para dentro da borda direita num campo de 212px. E ela não trocava de cor
com o tema.

Agora é desenho nosso, embutido no CSS, a 12px da borda e na cor do texto secundário, com
versão própria para o tema escuro. Conferido nos dois, ampliado.

### Cartão e indicador, dois nomes para duas coisas

O que se chamava `Cartao` era um **indicador**: rótulo, número e uma linha de contexto,
usado em 36 lugares. O nome passou a ser `Indicador`.

`Cartao` ficou sendo a **caixa** que embrulha qualquer conteúdo, com anatomia única:
cabeçalho com título e ações em cima, corpo embaixo. Um número solto dentro de uma caixa
não é a mesma coisa que a caixa, e chamar os dois de cartão obrigava a decidir, em cada
tela, de qual dos dois se estava falando.

O canto ficou mais arredondado (`--raio-xl`), que é o que dá o ar mais leve da referência.

### Modal

É um `<dialog>` de verdade. O navegador já dá o foco preso, o bloqueio do que está atrás,
o Esc e o fundo escurecido — reimplementar isso à mão é de onde vem a maioria dos modais
quebrados.

O que o navegador não faz, e está no componente: devolver o foco ao botão que abriu,
travar a rolagem de trás, e perguntar antes de descartar o que foi preenchido.

**Primeiro uso:** cancelar nota fiscal, que até então executava **na hora, sem perguntar**.

**Sobre as provas.** O navegador de mentira dos testes (jsdom) não implementa `<dialog>`.
Há um substituto mínimo no preparo dos testes, e está escrito lá o que ele prova (a lógica
do componente) e o que não prova (o que é do navegador). As partes do navegador foram
conferidas num navegador de verdade: 9 de 9.

### O menu "⋮" — e por que ele mudou de status

Na Parte 1 está escrito que o menu "⋮" das telas de referência **não** seria copiado:
na maioria dos cartões ele não faria nada, e menu vazio é ruído. Isso continua valendo.

Só que aqui ele ganhou trabalho de verdade, e a necessidade **apareceu medindo**:

1. A linha da tabela de Pedidos tinha até quatro botões
2. Com o texto podendo quebrar, a coluna ficava serrilhada — foi o **D2** da lista
3. Impedindo a quebra, os últimos botões saíam da tela — troquei um defeito por outro
4. A saída não era espremer, era **escolher**: a ação que faz o pedido andar fica à vista,
   e o apoio entra no menu

Resultado medido: a tabela passou a caber inteira, e as colunas de texto ganharam espaço
— "Origem" saiu de quatro linhas para duas.

### A dívida caiu

| Regra | Antes | Agora |
|---|---|---|
| Cartões escritos à mão | 29 arquivos | **21** |
| Telas sem cabeçalho padrão | 25 | **0** |

### Duplicação achada no caminho

`.migalhas` estava definida em **dois** arquivos de estilo — a nova em `painel.css` e a
antiga em `cadastros.css`, que carrega depois e vencia em silêncio. É exatamente o que o
conferidor de padrão existe para evitar. A antiga saiu.

### A régua estava cega no celular

Ao juntar as duas medições numa volta só, pus uma conferência boba: *pedi 420px, a página
mediu 420px?* Ela acusou **18 telas**. Zero achados vira um resultado bonito, e é também
exatamente o que sai quando o redimensionamento não pega — a conferência existe para
separar os dois casos.

Medido em `/pedidos`, com emulação de celular ligada e a janela pedida em 420px:

| | caixa de layout | janela | conteúdo |
|---|---|---|---|
| celular ligado | 420px | **830px** | 830px |
| celular desligado | 420px | 420px | 829px |

A janela **cresce até engolir o transbordo**. Isso não é defeito do navegador: é o "afasta
o zoom para caber" de um telefone de verdade. Só que a regra de rolagem horizontal compara
*conteúdo* com *janela* — e se a janela cresce junto, a conta nunca acusa nada.

A régua passava em todas as telas de celular porque era **incapaz de reprovar**. Agora ela
compara com a caixa de layout, que fica parada em 420px.

O que apareceu quando ela passou a enxergar: **18 das 34 telas transbordam no celular**. A
tabela de Pedidos mede 1068px dentro de uma caixa de 420px. Isso é o **D5** da lista, e é o
trabalho do Design 6 — não do Design 2.

> É a terceira vez nesta obra que o "defeito" era a medição. Vale a regra: quando o número
> vier bonito, desconfie dele antes de comemorar.

### A volta ficou uma só

Eram duas execuções — uma de computador, outra de celular — cada uma abrindo navegador,
fazendo login e percorrendo as 34 telas do zero. Agora é uma volta: chega na tela, mede em
1440px, encolhe, mede em 420px, e segue. Medido: **96s → 74s**, e cada achado passou a
dizer em qual largura apareceu.

O print de página inteira mudou de lugar junto. Ele ficava depois do laço, quando a janela
já estava na última largura — toda foto sairia de celular. Foi para dentro, e agora cada
largura tira a sua.

## Design 2.1 — Os painéis que abriam onde ninguém via

Apontado de fora, no Financeiro: clicar em **Dar baixa** não fazia nada visível.

Fazia. O formulário abria **acima da tabela**, e quem clicou estava lá embaixo, na última
linha. A página não se mexia, então o clique parecia morto.

Medindo o resto do sistema, o mesmo desenho aparecia em mais quatro lugares — e nem sempre
para o mesmo lado:

| Tela | Botão | Onde o formulário nascia |
|---|---|---|
| Financeiro | Dar baixa | **acima** da tabela |
| Locação | Devolver | **acima** da tabela |
| Locação | Cancelar | **acima** da tabela |
| Estoque | Retirar | **abaixo** da tabela |
| Estoque | Contar | **abaixo** da tabela |

### Por que modal, e não rolar a página

Rolar até o formulário conserta o sintoma. Mas os cinco são formulário curto que interrompe
uma decisão — exatamente a lista do que **entra** em modal na Parte 1, onde "devolver
equipamento" e "cancelar locação" já estavam escritos pelo nome.

E a página rolada continua com dois donos da atenção: o formulário e a tabela atrás dele. O
modal resolve os dois de uma vez — vem até a pessoa, o foco entra nele, e o que está atrás
para de rolar.

### O que a medição pegou no caminho

A sonda travou ao apertar Esc em "Contar". Motivo: o modal pergunta antes de descartar o que
foi preenchido, e a conta de "foi preenchido" era **o campo tem texto**.

Só que vários campos já nascem escritos pelo sistema — a quantidade no ajuste de inventário,
o preço médio na entrada. O modal perguntava *"descartar o que você digitou?"* para quem não
tinha digitado nada. Foi duas vezes na mesma tela: consertei a quantidade e o preço médio
caiu no mesmo buraco.

A correção não foi reescrever a lista de padrões — regra escrita duas vezes diverge. O
formulário **guarda o que o sistema pôs nele** ao abrir, e compara com isso.

Provado nos dois sentidos, com mouse e teclado de verdade:

| | Esc sem digitar nada | Esc depois de digitar |
|---|---|---|
| Financeiro · Dar baixa | fecha direto | — |
| Estoque · Retirar | fecha direto | **pergunta**, e o "não" mantém o texto |
| Estoque · Contar | fecha direto | — |
| Locação · Devolver | fecha direto | — |
| Locação · Cancelar | fecha direto | — |

Nos cinco: janela dentro da tela mesmo com a página rolada até o fim, foco dentro, rolagem
de trás travada, e o foco de volta no botão de origem ao fechar.

> A sonda travar foi sorte. Ela ficou esperando uma resposta que ninguém ia dar. Agora ela
> responde sozinha e **anota que a pergunta apareceu** — que é o defeito que eu queria ver.

## Design 2.2 — A régua ficou barata

Reclamação de fora, e justa: as etapas demoram demais. Antes de mexer, cronometrei a régua
por dentro. O resultado explica tudo:

| | |
|---|---|
| dormindo de propósito | **68s** |
| medindo de fato | menos de 1s, nas 34 telas |
| trocando de rota | menos de 1s |

Ela media em menos de um segundo e dormia 68. As esperas existiam por um motivo real —
medir cedo demais deu alarme falso três vezes — mas eram **esperas fixas**, e espera fixa
paga o pior caso em toda tela, inclusive nas que ficam prontas em 200ms.

### Corte 1 — perguntar em vez de contar

Cada espera contada virou uma espera medida:

| Onde | Era | Virou |
|---|---|---|
| depois de trocar de tela | dormir 500ms | perguntar de 40 em 40ms se o título mudou |
| depois de mudar a largura | dormir 400ms, duas vezes | perguntar se a caixa de layout já é a largura pedida e se a geometria parou |
| dentro do "acalmar" | passo de 180ms | passo de 70ms |

A segunda linha é a que mais rendeu: metade daquele tempo era gasto na **primeira** largura,
que nem muda — ela já estava posta antes de navegar.

### Corte 2 — medir só o que mudou

Percorrer as 34 telas para conferir 3 que mudaram não descobre nada: descobre 31 vezes o
que já se sabia. A tabela de telas passou a dizer **qual arquivo desenha cada uma**, e a
régua pergunta ao git o que mexeu.

A regra é conservadora de propósito — errar para menos aqui deixa defeito passar, errar
para mais custa segundos:

| O que mudou | Quantas telas ela mede |
|---|---|
| uma página | só a dela |
| estilo, componente, navegação, tema | **as 34** |
| só o número da versão | nenhuma |
| nada no frontend | nenhuma — nem abre o navegador |
| o git não respondeu | **as 34** |
| página que não sei de quem é | **as 34** |

Os seis casos foram testados um a um.

### O resultado

| | Antes | Agora |
|---|---|---|
| Régua, 34 telas | 73s | **24s** |
| Régua, uma tela mexida | 73s | **9s** |
| Fechar etapa (sem backend) | 2min06 | **51s** |

### E o que apareceu no meio do caminho

Rodando a régua três vezes seguidas para conferir se ela era estável, uma delas acusou
**SEM_H1** numa tela que tem título. Duas causas, empilhadas.

**A primeira: a régua media mesmo quando desistia de esperar.** A resposta do "esperar
acalmar" era jogada fora. Quando a tela não acalmava no prazo, ela media assim mesmo — e o
que media era o "Carregando", que não tem título. O defeito não era a tela; era a régua
dizer que mediu quando não mediu. Agora ela **diz que não conseguiu**, e isso reprova o
fechamento. Verde sem ter medido é pior que vermelho.

**A segunda: a API estava barrando a régua.** O retrato da tela no instante da desistência
trouxe a frase inteira:

> "Muitas requisições em pouco tempo. Aguarde um instante."

O limite é 200 chamadas por minuto. Uma volta inteira gasta **105** — medido nos registros
da API. Uma volta cabe com folga; duas coladas estouram. E foi exatamente o que eu fiz ao
rodar três de enfiada para testar estabilidade: **o meu teste é que criava a condição.**

Vale registrar a parte desconfortável: ao ficar 3× mais rápida, a régua triplicou o ritmo de
chamadas. O corte de tempo **foi** a causa disso. Eu havia dito o contrário antes de olhar o
retrato.

A régua agora reconhece a frase, espera a janela do limite virar e refaz a tela. O limite da
API ficou como estava — mexer nele para a medição passar seria fazer a medição mentir.

Depois disso, três voltas coladas deram o **mesmo veredito**, inclusive a que foi barrada
(95s, com o minuto de espera dentro).

> Quarta vez nesta obra que o "defeito" era a medição. A regra se mantém: quando o número
> vier bonito, desconfie dele antes de comemorar.

## Design 3 — Início e barra lateral

### A tela inicial era um muro de atalhos

Treze caixas iguais, todas dizendo "clique aqui", nenhuma dizendo se havia algo para fazer.
Quem chegava de manhã abria tela por tela para descobrir que uma parcela venceu ontem.

Ela passou a responder **uma pergunta**, e a página é a ordem da resposta:

1. **O que precisa de você** — prazo perdido primeiro, depois o que vence se ninguém agir
2. **Como estão as coisas** — acompanhamento, sem cobrança
3. **Ir para** — os atalhos, que viraram o rodapé da página em vez do corpo dela

Duas regras decidem o que aparece, e as duas são do servidor:

- **Sem a permissão, o cartão nem existe.** Mostrar "Contas vencidas: 3" para quem não abre
  o financeiro é dar uma notícia que a pessoa não pode resolver
- **Urgente é o que tem peso E tem número.** Um "Contas vencidas: 0" em vermelho no alto da
  tela ensina a ignorar vermelho

O peso vem pronto do servidor. Se a tela decidisse sozinha, ela e a fila de aprovação
poderiam discordar sobre o mesmo número.

O aviso de andamento do projeto foi para o fim, em letra menor. Ele fala do projeto, não do
trabalho de quem abriu a tela — e ocupava o lugar mais valioso da página.

### A régua passou a medir COR

Até aqui ela media espaço, tamanho e transbordo. Nunca cor — e cor errada não *parece*
errada num print.

A regra nova calcula o contraste de cada texto contra o fundo real (subindo pelos pais até
achar um opaco) e compara com a WCAG AA: 4,5:1, ou 3:1 para texto grande. E roda nos **dois
temas**, porque contraste não muda com a largura da janela, mas muda inteiro com o tema.

O que ela achou na primeira volta:

| Onde | Medido | Por quê |
|---|---|---|
| "1 função(ões)", no cabeçalho | **1,66:1** | cor cravada à mão (`#b9cbe0`), de quando a barra era azul-marinho escuro |
| Item ativo do menu, tema claro | **3,85:1** | o azul da marca é claro demais para texto pequeno |
| "← Voltar para X", em 33 telas | **4,31:1** | o mesmo azul, sobre o fundo da página |
| Todo `<a>` sem classe, tema escuro | **1,83:1** | o sistema não tinha regra nenhuma para link: caía no azul do navegador |
| Botão "Cancelar" da locação, tema escuro | **2,12:1** | o `.botao` não definia fundo, e o navegador pintava o cinza dele |

Os dois últimos são de fundação, e valiam para o sistema inteiro. O ponto da marca ("Porto
Inc**.**") também entrou, em 3,62:1.

A correção quase sempre foi **usar o token que já existia**: `--info-texto` é a versão
escurecida do azul para texto sobre fundo claro, criada no Design 0 exatamente para isto.
Onde o azul continua cheio é em borda e controle, onde o mínimo é 3:1 e ele cumpre.

Depois: **34 telas, dois temas, nenhum contraste fraco.**

### Duas peças diferentes com o mesmo nome

O achado mais desconfortável. `Indicador` e `CartaoIndicador` (o número com gráfico ao lado)
emitiam a **mesma classe** `.indicador`, com definições diferentes em arquivos diferentes.
`graficos.css` carrega depois, então vencia em silêncio.

Resultado: **todo indicador do sistema estava sendo desenhado pelas regras do
cartão-com-gráfico** — com `cursor: help` e uma grade de três linhas fixas. O bloco em
`global.css` era quase todo letra morta.

Descobri porque meus tons novos não apareciam. Medido: a faixa lateral saía `1px solid
#dde4ec` onde eu tinha escrito `4px solid vermelho`.

O cartão-com-gráfico ganhou nome próprio: `.indicador-grafico`. É a mesma lição do
`.migalhas` no Design 2, um nível abaixo — duas peças, dois nomes.

### Um vocabulário, não cinco

Eu havia inventado `perigo` para o tom mais grave. O sistema já dizia **`erro`** — no selo,
no aviso e no cartão-com-gráfico. Voltou para `erro`. Uma palavra por ideia.

### O que foi conferido e está certo, não mexer

- **O item do menu tem 40px no computador e 44px no celular.** Não é descuido: a régua dos
  44px vale para o dedo, e na gaveta do celular ele volta aos 44. É o que permite os 16
  itens e os quatro rótulos de grupo caberem sem rolar
- **Os atalhos de alturas diferentes** são de **fileiras** diferentes, não da mesma. A regra
  é sobre a mesma fileira

### E uma quinta vez

A primeira medição de contraste acusou 20 telas no tema escuro, com o *mesmo* seletor dando
2,39, 3,39 e 4,23 em telas diferentes. Valor que muda sem o CSS mudar é medição, não
defeito: a troca de tema anima 160ms, e a régua fotografava no meio da animação.

Agora ela desliga toda transição antes de medir cor. Das 20 telas sobraram 3 — e as 3 eram
reais. **Contraste se mede parado.**

---

# Parte 3 — A lista de desalinhamentos

Apontados pelo dono do sistema em 2026-09-23, olhando telas de verdade. Cada um tem
destino: a etapa em que será corrigido. A lista some quando zerar.

| # | O que está errado | Onde aparece | Conserta em |
|---|---|---|---|
| ~~D1~~ | ✅ **RESOLVIDO no Design 2.** A seta do campo de escolha era do navegador, não nossa. O `appearance` está em `auto`, então o Chromium desenha a seta onde quer — medido: 34px para dentro da borda direita, num campo de 212px. Parece solta no meio do campo | Toda tela com filtro | **Design 2** — controles de formulário viram peça |
| ~~D2~~ | ✅ **RESOLVIDO no Design 2**, com o menu "⋮". Grupo de botões de ação com larguras irregulares. Na tabela de Pedidos uma linha tem 4 botões e as outras 3; como cada um tem a largura do próprio texto, as colunas não se formam e a borda direita fica serrilhada | Pedidos, e toda tabela com ações | **Design 5** — telas de fluxo |
| D3 | **A dica flutuante cobre o cartão vizinho.** No Financeiro, a explicação de "Vencem em 7 dias" abre por cima do cartão ao lado e esconde o número dele | Financeiro | **Design 4** — telas de número |
| D4 | **Campo de busca largo demais.** No Recebimento o campo do número do pedido ocupa quase a tela inteira para receber 8 caracteres. Campo deve ter a largura do que ele recebe | Recebimento | **Design 5** |
| D5 | **18 telas transbordam a largura do celular.** A 420px o conteúdo passa da caixa e o telefone afasta o zoom para caber. Em Pedidos a tabela mede 1068px numa caixa de 420px | Solicitações, Cotações, Pedidos, Recebimento, Estoque, Financeiro, Relatórios, Cadastros/obras, Admin | **Design 7** — celular |

## O que já foi medido e está certo

Vale registrar para não "consertar" o que não está quebrado:

- **A base dos controles da barra de filtros alinha.** Medido na tela de Solicitações: os
  quatro controles terminam todos em 247px. O rótulo "Situação" faz o primeiro bloco ser
  mais alto, mas eles são alinhados pela BASE, que é o que o olho usa
- **Os cartões de KPI da mesma fileira têm a mesma altura**, nas duas larguras medidas

## Por que a régua não pegou isso sozinha

Ela mede rolagem lateral, alvo pequeno, texto estourando a caixa, cartões de alturas
diferentes e base de controles na mesma linha. Ela **não** media:

- rolagem lateral no celular: ela media, mas comparava com a janela esticada, e a conta se
  anulava sozinha. Corrigido no Design 2 — passou a comparar com a caixa de layout
- seta de campo de escolha fora de lugar — é desenho do navegador, não do nosso CSS
- grupo de botões com larguras irregulares
- dica flutuante cobrindo conteúdo

Os três entram na régua junto com a etapa que os corrige. Assim o que foi apontado uma
vez não volta.
