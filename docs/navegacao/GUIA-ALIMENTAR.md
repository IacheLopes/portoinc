<!-- versao: 0.44.5 -->

# Como encher o sistema

Sistema novo chega vazio. Este guia diz **o que cadastrar, nesta ordem**, até conseguir
fazer a primeira compra do começo ao fim.

---

# 1 · Por que a ordem importa

Cada cadastro precisa do anterior. Não dá para pular.

```
Família  ->  Material  ->  Solicitação
                   Fornecedor  ->  Cotação
                   Obra        ->  (nasce com almoxarifado)
                   Alçada      ->  Aprovação
```

Se você começar pela tela de Solicitações, vai encontrar uma lista vazia e nada para
escolher. **Não está quebrado: é que ainda não existe material.**

> **Entre com `porto@dev.com` / `admin123`.** Essa conta tem os sete papéis, então nenhuma
> tela fica escondida enquanto você monta o sistema.

## O caminho inteiro, em seis paradas

| | Onde | Quantos |
|---|---|---|
| 1º | Cadastros → **Famílias** | 1 basta |
| 2º | Cadastros → **Materiais e serviços** | 2 ou 3 |
| 3º | Cadastros → **Fornecedores** | **2, no mínimo** |
| 4º | Cadastros → **Obras** | 1 basta |
| 5º | Cadastros → **Limites de alçada** | 1 faixa |
| 6º | A obra → **Orçamento** | **antes da 1ª compra** |

Depois disso o sistema está pronto para uma compra de verdade.

> **Todo botão azul de criar abre uma janela por cima da tela.** Para fechar: o **X**, a
> tecla **Esc**, um clique fora, ou **Cancelar**.

---

# 2 · Os seis cadastros

## 1º · Famílias

**Para que serve:** separar o material por tipo. É a gaveta onde o material mora.

**Caminho:** Cadastros → Famílias → **+ Nova família**

| Campo | Obrigatório | Exemplo |
|---|---|---|
| **Código** | sim | `CIM` |
| **Nome** | sim | `Cimento e argamassas` |
| Descrição | não | `Cimento, cal, argamassa e rejunte` |

> **Comece com uma só.** Você cria outras quando precisar. Famílias servem também para
> dizer o que cada fornecedor vende.

---

## 2º · Materiais e serviços

**Para que serve:** a lista de tudo que dá para pedir. Sem isto, não há o que solicitar.

**Caminho:** Cadastros → Materiais e serviços → **+ Novo item**

> **O botão diz "item", não "material".** É de propósito: a mesma tela cadastra material e
> serviço, e o campo **Tipo** é que separa os dois.

| Campo | Obrigatório | Exemplo |
|---|---|---|
| **Tipo** | sim | `Material` (ou `Serviço`) |
| **Família** | sim | a que você criou |
| **Código Porto** | sim | `00001` |
| **Unidade de medida** | sim | `SC` |
| **Descrição** | sim | `Cimento Portland CP-II-Z-32 saco 50kg` |
| Marca | não | `Votoran` |
| Norma técnica (NBR) | não | `NBR 16697` |
| Código de barras (GTIN) | não | deixe em branco por enquanto |
| Ponto de pedido | não | avisa quando o estoque baixa disso |

**As unidades que o sistema conhece:**

| Grupo | Opções |
|---|---|
| Peça | UN · PC · CX · SC · FD · PAR · JG · RL · GL · LT · BD |
| Peso | KG · TON · G |
| Comprimento e área | M · M2 · M3 · CM · KM |
| Volume | L · ML |
| Tempo e serviço | H · DIA · MES · VB |

> **Cadastre 2 ou 3.** Com um só, a cotação fica pobre demais para você enxergar a
> comparação funcionando.

> **`VB` quer dizer "verba".** Use em serviço que se cobra por valor fechado, não por
> quantidade.

---

## 3º · Fornecedores

**Para que serve:** quem vende. A cotação convida estes nomes.

**Caminho:** Cadastros → Fornecedores → **+ Novo fornecedor**

| Campo | Obrigatório | Exemplo |
|---|---|---|
| **Razão social** | sim | `Marquilip Comércio e Representação Ltda` |
| **CNPJ** | sim | `19.131.243/0001-97` |
| Nome fantasia | não | `Marquilip` |
| E-mail | não | `vendas@exemplo.com.br` |
| WhatsApp | não | `11 91234-5678` |
| Cidade / UF | não | `São Paulo` / `SP` |
| **Família atendida** | não, mas **use** | `Cimento e argamassas` |

> **Cadastre pelo menos dois.** Cotação com um fornecedor só não tem disputa, e é
> justamente a disputa que o sistema existe para mostrar.

> **A família atendida é o que faz o sistema sugerir fornecedor sozinho** na hora de
> montar a cotação. Sem ela, você escolhe tudo na mão.

> **O CNPJ é conferido de verdade.** Número inventado é recusado — o sistema checa os
> dígitos finais. Se estiver só treinando, use um CNPJ real de empresa conhecida, ou peça
> um gerador de CNPJ válido na internet.

---

## 4º · Obras

**Para que serve:** onde o material vai ser usado. Toda compra pertence a uma obra.

**Caminho:** Cadastros → Obras → **+ Nova obra**

| Campo | Obrigatório | Exemplo |
|---|---|---|
| **Código** | sim | `OB-001` |
| **Nome da obra** | sim | `Residencial Porto Belo` |
| **Cliente** | sim | `Porto Inc. Incorporações` |
| **Situação** | sim | `Em andamento` |
| Cidade / UF | não | `Santos` / `SP` |
| Data de início | não | hoje |

> **A obra nasce com o próprio almoxarifado.** O sistema cria sozinho, com o código
> `OB-001-ALM`. Você não precisa cadastrar estoque em lugar nenhum — e não existe tela
> para isso porque não é preciso.

> **Escolha `Em andamento`.** Obra em `Planejamento` também funciona, mas `Em andamento` é
> o estado normal de quem está comprando.

---

## 5º · Limites de alçada

**Para que serve:** dizer **quem assina** cada compra, conforme o valor. Sem faixa
nenhuma, a solicitação é criada mas **ninguém consegue aprovar**.

**Caminho:** Cadastros → Limites de alçada → **+ Nova faixa**

| Campo | Obrigatório | Exemplo |
|---|---|---|
| **Descrição** | sim | `Compra do dia a dia` |
| **Valor mínimo (R$)** | sim | `0` |
| Valor máximo (R$) | não | deixe **vazio** = sem teto |
| **Funções que assinam** | marque | `Gestor de obra` |
| Exigir todas | não | deixe desmarcado |

> **Para começar, uma faixa só resolve:** de `0` até sem teto, assinada pelo
> **Gestor de obra**. Depois você cria faixas maiores para valores altos.

> **Faixa é por FUNÇÃO, não por pessoa.** Quem assina é quem tem aquele papel. A conta
> `porto@dev.com` tem os sete, então ela assina qualquer faixa que você criar.

> **A tela tem um simulador.** Digite um valor de compra e ela mostra na hora quem
> precisaria assinar. Use para conferir antes de sair criando solicitação.

---

## 6º · Orçamento da obra

**Para que serve:** dizer quanto a obra tinha previsto gastar em cada coisa. É o que
alimenta o relatório **Orçado × realizado**.

**Caminho:** Cadastros → Obras → clique na obra → aba **Orçamento**

| Campo | Exemplo |
|---|---|
| **Código** | `03.01.001` |
| **Descrição** | `Cimento Portland` |
| **Unidade** | `SC` |
| **Quantidade prevista** | `800` |
| **Valor unitário (R$)** | `51,00` |

> ⚠️ **Não pule, e faça ANTES da primeira solicitação.**
>
> Este passo já disse "pule se estiver com pressa", e estava errado. O item de uma
> solicitação escolhe a linha do orçamento **na hora em que é criado**. Se a obra não
> tiver orçamento naquele momento, ele nasce **sem vínculo** — e **não dá para amarrar
> depois**, nem criando o orçamento em seguida, nem corrigindo o rascunho.
>
> Aquela compra some do relatório Orçado × realizado para sempre, e quem for ler o
> relatório meses depois não tem como saber que faltou isto.
>
> O modal de solicitação avisa quando a obra está sem orçamento. O aviso existe porque
> o defeito aconteceu de verdade, na validação de 27/09/2026.

---

# 3 · Conferindo se ficou de pé

Depois dos cinco cadastros obrigatórios, faça este teste curto. Ele passa por todo o
caminho de uma compra.

| | O que fazer | O que tem de acontecer |
|---|---|---|
| 1 | **Solicitações → + Nova solicitação** | a obra aparece na lista, e o material também |
| 2 | Adicione 1 item e **Enviar para aprovação** | some da sua lista e aparece em Aprovações |
| 3 | **Aprovações** | a solicitação está lá, dizendo quem precisa assinar |
| 4 | **Aprovar** | vira "Aprovada" e libera a cotação |
| 5 | **Cotações → + Novo pacote** | os fornecedores da família aparecem sugeridos |
| 6 | Convide os 2 e lance um preço para cada | dá para comparar lado a lado |
| 7 | **Equalização → Gerar pedido** | nasce um `PC-00001` |
| 8 | **Recebimento** | o pedido está esperando entrega |
| 9 | **Conferir** e marcar o que chegou | o estoque sobe sozinho |

Se os nove passos correrem, **o sistema está alimentado e funcionando.**

---

# 4 · Perguntas que aparecem

## "Criei o material, mas ele não aparece na solicitação"

Confira se a **obra** está cadastrada e com situação `Em andamento`, e se o material está
**ativo**. Material desativado some das listas de escolha, mas continua no histórico.

## "Aprovei, mas não consigo gerar o pedido"

Pedido nasce da **equalização de uma cotação**, não da solicitação direto. O caminho é:
solicitação aprovada → pacote de cotação → fornecedores respondem → equalização → pedido.

## "Ninguém aparece para assinar"

Falta faixa de alçada, ou a faixa que existe não cobre aquele valor. Vá em
**Cadastros → Limites de alçada** e use o simulador com o valor da compra.

## "O CNPJ é recusado"

O sistema confere os dígitos verificadores. Número batido na mão quase nunca passa.

## "Quero recomeçar do zero"

Peça para quem cuida do sistema restaurar um backup, ou rodar a limpeza de novo. Nunca
apague dado direto no banco: o sistema guarda o histórico de cada passo, e furar isso
deixa telas mostrando coisa que não existe mais.

---

# 5 · Quando for usar de verdade

Este guia serve para montar um **ambiente de teste**. Na hora de valer:

| Antes de usar de verdade | Por quê |
|---|---|
| Troque as senhas das duas contas | `admin123` não é senha |
| Crie uma conta por pessoa | o sistema registra **quem** fez cada coisa |
| Apague a conta `porto@dev.com` | ela tem os sete papéis; ninguém de verdade precisa disso |
| Revise as faixas de alçada | elas decidem quem pode gastar quanto |
| Cadastre os fornecedores reais | com CNPJ, e-mail e WhatsApp certos |

> **A conta DEV existe para explorar sem esbarrar em permissão.** Num sistema em uso, ela
> é uma porta destrancada.
