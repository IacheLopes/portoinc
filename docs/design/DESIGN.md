<!-- versao: 0.19.0 -->

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

---

# Parte 3 — A lista de desalinhamentos

Apontados pelo dono do sistema em 2026-09-23, olhando telas de verdade. Cada um tem
destino: a etapa em que será corrigido. A lista some quando zerar.

| # | O que está errado | Onde aparece | Conserta em |
|---|---|---|---|
| D1 | **A seta do campo de escolha é do navegador, não nossa.** O `appearance` está em `auto`, então o Chromium desenha a seta onde quer — medido: 34px para dentro da borda direita, num campo de 212px. Parece solta no meio do campo | Toda tela com filtro | **Design 2** — controles de formulário viram peça |
| D2 | **Grupo de botões de ação com larguras irregulares.** Na tabela de Pedidos uma linha tem 4 botões e as outras 3; como cada um tem a largura do próprio texto, as colunas não se formam e a borda direita fica serrilhada | Pedidos, e toda tabela com ações | **Design 5** — telas de fluxo |
| D3 | **A dica flutuante cobre o cartão vizinho.** No Financeiro, a explicação de "Vencem em 7 dias" abre por cima do cartão ao lado e esconde o número dele | Financeiro | **Design 4** — telas de número |
| D4 | **Campo de busca largo demais.** No Recebimento o campo do número do pedido ocupa quase a tela inteira para receber 8 caracteres. Campo deve ter a largura do que ele recebe | Recebimento | **Design 5** |

## O que já foi medido e está certo

Vale registrar para não "consertar" o que não está quebrado:

- **A base dos controles da barra de filtros alinha.** Medido na tela de Solicitações: os
  quatro controles terminam todos em 247px. O rótulo "Situação" faz o primeiro bloco ser
  mais alto, mas eles são alinhados pela BASE, que é o que o olho usa
- **Os cartões de KPI da mesma fileira têm a mesma altura**, nas duas larguras medidas

## Por que a régua não pegou isso sozinha

Ela mede rolagem lateral, alvo pequeno, texto estourando a caixa, cartões de alturas
diferentes e base de controles na mesma linha. Ela **não** media:

- seta de campo de escolha fora de lugar — é desenho do navegador, não do nosso CSS
- grupo de botões com larguras irregulares
- dica flutuante cobrindo conteúdo

Os três entram na régua junto com a etapa que os corrige. Assim o que foi apontado uma
vez não volta.
