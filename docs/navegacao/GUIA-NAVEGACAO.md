<!-- versao: 0.28.3 -->

# Guia Prático de Navegação

> Guia curto, para aprender a mexer e para apresentar. Quem quiser o detalhe de cada
> campo tem o `Tutorial-PortoInc.pdf`.

---

# ⚠️ Antes de qualquer coisa: os dados são de mentira

**Tudo que aparece na tela foi inventado para a demonstração.** Obras, materiais,
fornecedores, notas fiscais, valores — nada disso existe. Serve só para o sistema ter o
que mostrar.

| O que é **real** | O que é **inventado** |
|---|---|
| As pessoas: Bras, Gilson, Neilma, Andre, Washington — nomes citados na reunião | As três obras, com seus nomes, cidades e clientes |
| Os papéis de cada um e quem pode o quê | Os materiais, fornecedores e famílias do catálogo |
| O fluxo de compra, do pedido ao pagamento | As notas fiscais, parcelas e locações |
| A regra de que a aprovação depende do valor | **Os valores de R$ 2.000 e R$ 15.000** |

**Ao apresentar, diga isso na primeira frase.** Algo como:

> *"Os dados são de exemplo, para o sistema ter o que mostrar. As pessoas são as da
> reunião; o resto é ilustração."*

Sem esse aviso, alguém da Porto Inc. vai dizer *"não temos essa obra"* ou *"nosso limite
não é esse"* — e a demonstração perde a credibilidade por causa de um detalhe que nem era
o assunto.

> **Aproveite a demonstração para perguntar.** Os limites de alçada, as famílias de
> material e os fornecedores são justamente o que **eles** precisam informar. Chegue com
> a pergunta pronta: *"a partir de quanto sobe para o fundador?"*

---

# Para que serve o sistema

A **Porto Inc. é uma construtora**: ela levanta obra.

(No sistema há três obras cadastradas, de tipos diferentes — residencial, predial e
logística. São **exemplos**, para mostrar que o sistema não assume um tipo só de obra.)

**Este sistema não é a construtora — é uma parte dela.** Ele cuida de uma coisa só:
**comprar o material e o equipamento que a obra consome, e controlar o almoxarifado.**

Comprar não é o negócio da Porto Inc.; é o que faz o negócio andar. E era justamente a
parte que vivia em WhatsApp, planilha e papel — ninguém sabia ao certo o que tinha sido
pedido, quanto custou da última vez, nem se o material chegou.

O sistema é **o caminho oficial dessa compra**, do pedido da obra até a nota fiscal paga.

> **Se for apresentar, comece por aqui:** *"a Porto Inc. constrói; este sistema cuida de
> abastecer as obras dela"*. Sem essa frase, quem assiste acha que está vendo um sistema
> de compras genérico — e aí o resto perde o sentido.

## O caminho de uma compra

```
1. SOLICITAÇÃO      a obra pede        →  Bras (gestor) ou Neilma
2. APROVAÇÃO        alguém libera      →  depende do VALOR (alçada)
3. COTAÇÃO          pede preço         →  Andre ou Neilma (compradores)
4. PEDIDO           o escolhido recebe →  sai PDF + WhatsApp/e-mail
5. RECEBIMENTO      confere a entrega  →  Gilson (almoxarife)
6. FINANCEIRO       nota vira parcela  →  Neilma paga
```

**Cada seção do menu é uma dessas etapas.** É por isso que o menu está agrupado assim.

## Quem vê o quê

O menu **muda conforme a pessoa**. O Gilson não vê Administração; a Neilma não vê
Aprovações. Para apresentar o sistema inteiro, entre como **Administrador**.

| Conta (senha `Porto@2026`) | Papel |
|---|---|
| `admin@portoinc.com.br` | Vê tudo |
| `bras@portoinc.com.br` | Pede e aprova |
| `andre@portoinc.com.br` | Compra |
| `gilson@portoinc.com.br` | Recebe e controla estoque |
| `neilma@portoinc.com.br` | Compra e paga |
| `washington@portoinc.com.br` | Fundador — aprova valor alto |

---

# As seções

## 1. Início

- Mostra **o que precisa de você agora**: prazo perdido primeiro, depois o que vence
- Cada número é um **atalho** — clicar leva à tela onde ele mora
- **Passo:** Clique em **Início** → leia "O que precisa de você" → clique num número

---

# Compras

## 2. Solicitações

- Lista tudo que as obras pediram, e em que pé está cada pedido
- Abrir solicitação nova, acompanhar, baixar em PDF
- **Passo:** **Solicitações** → **Nova solicitação** → escolha a obra → adicione itens → **Enviar**

## 3. Aprovações

- Fila do que espera assinatura, **só o que é da sua alçada**
- Liberar ou devolver com motivo
- **Passo:** **Aprovações** → abra uma → **Aprovar** ou **Devolver**

> **A alçada é por valor.** A regra é real; **os valores abaixo são exemplo**, e foram
> escolhidos por mim para a demonstração funcionar:
>
> | Valor da solicitação | Quem assina |
> |---|---|
> | até R$ 2.000 | Gestor de obra, sozinho |
> | R$ 2.000,01 a R$ 15.000 | Gestor de obra **e** Engenheiro |
> | acima de R$ 15.000 | Fundador |
>
> Mudam em **Cadastros → Limites de alçada**, e é lá que os valores de verdade da Porto
> Inc. vão entrar quando eles informarem.

## 4. Cotações

- Pacotes de cotação e o que cada fornecedor respondeu
- Montar pacote, convidar fornecedor, comparar preços e escolher
- **Passo:** **Cotações** → **Nova cotação** → escolha itens → convide fornecedores → **Equalizar e escolher**

> **Equalizar** é a tela que põe os preços lado a lado. Ela sugere o melhor de cada item;
> você pode aceitar tudo de uma vez ou item por item.

## 5. Pedidos

- Os pedidos de compra já emitidos, e se o fornecedor recebeu
- Baixar o PDF, reenviar por WhatsApp ou e-mail
- **Passo:** **Pedidos** → escolha um → **⋮** → **Baixar PDF**

---

# Almoxarifado

## 6. Recebimento

- O que está a caminho, e o que já foi conferido
- Conferir a entrega contra o pedido — inclusive entrega parcial
- **Passo:** **Recebimento** → escolha o pedido → **Conferir** → marque as quantidades → **Registrar**

## 7. Estoque

- Saldo por material e por almoxarifado, e o que está abaixo do mínimo
- Retirar para a obra, dar entrada, ajustar, transferir entre obras
- **Passo:** **Estoque** → ache o material → **Retirar** → informe quantidade e obra

## 8. Locação

- Equipamento alugado, quanto já custou e o que passou do prazo
- Registrar locação nova, devolver, cancelar
- **Passo:** **Locação** → **Nova locação**, ou **Devolver** numa linha existente

> Esta tela mostra **o dinheiro correndo**: equipamento parado continua contando diária.

---

# Gestão

## 9. Financeiro

- Números da carteira, fluxo de caixa dos próximos meses e as parcelas a pagar
- Lançar nota fiscal, gerar parcelas, dar baixa no pagamento, baixar contas
- **Passo:** **Financeiro** → role até **Parcelas** → **Dar baixa** na que foi paga

**No gráfico de fluxo de caixa:**
- **‹** e **›** andam um mês; o campo do meio salta para qualquer mês; **Hoje** volta
- Não dá para avançar além do mês atual
- Toque numa barra para ver os valores daquele mês

**Notas fiscais** fica em: **Financeiro** → **Notas fiscais**

## 10. Relatórios

- Cinco abas, cada uma responde **uma pergunta**
- Filtrar por obra e período, baixar em PDF ou Word
- **Passo:** **Relatórios** → escolha a aba → filtre → **Baixar**

| Aba | Responde |
|---|---|
| Orçamento | A obra está estourando o orçamento? |
| Economia | A cotação valeu a pena? |
| Fornecedores | Em quem dá para confiar? |
| Tempos | Onde o processo trava? |
| Consumo | O que a empresa mais compra? |

---

# Administração

## 11. Cadastros

- A porta para os cinco cadastros de base
- Cadastrar e editar o que o resto do sistema usa
- **Passo:** **Cadastros** → escolha um dos cinco

| Cadastro | Para quê |
|---|---|
| Famílias | Agrupa material (cimento, elétrica, EPI) |
| Materiais e serviços | O catálogo que a solicitação usa |
| Fornecedores | Quem recebe cotação, por família |
| Obras | Onde o material é usado; cria o almoxarifado |
| Limites de alçada | Quem assina até quanto |

> **Comece por aqui numa instalação nova.** Sem família e material, não há o que solicitar.

## 12. Usuários

- Todas as pessoas e as funções de cada uma
- Cadastrar, trocar função, desativar
- **Passo:** **Usuários** → **Novo usuário** → marque as funções

> Uma pessoa pode ter **mais de uma função** — a Neilma compra e paga. As permissões somam.

## 13. Avisos ao fornecedor

- Se WhatsApp e e-mail estão ligados, e tudo que o sistema já mandou
- Conectar as integrações, autorizar números, mandar teste
- **Passo:** **Avisos** → aba **WhatsApp** ou **E-mail** → veja o histórico

> ⚠️ **Hoje tudo roda em modo de teste.** Nada sai para fornecedor de verdade. A tela
> avisa isso no topo.

## 14. Status do sistema

- Se banco, API e integrações estão no ar
- Conferir antes de culpar o sistema
- **Passo:** **Status do sistema** → tudo verde = tudo certo

---

# No rodapé do menu

| Item | O que faz |
|---|---|
| **Tema escuro / claro** | Troca o visual; ele lembra a escolha |
| **Trocar minha senha** | Só a sua |

---

# Roteiro de 20 minutos para apresentar

Segue **uma compra inteira**, do pedido ao pagamento. É a melhor forma de mostrar o
sistema, porque conta uma história em vez de listar telas.

> Você vai criar uma solicitação de verdade no banco de demonstração. Pode fazer à
> vontade: nada sai para fornecedor nenhum (as integrações estão em modo de teste), e o
> banco pode ser recarregado do zero quando quiser.

| # | Entre como | Faça |
|---|---|---|
| 1 | `bras@` | **Solicitações** → Nova → peça cimento para a OB-001 |
| 2 | `bras@` | **Aprovações** → aprove a que você acabou de criar |
| 3 | `andre@` | **Cotações** → Nova → convide 3 fornecedores |
| 4 | `andre@` | **Equalizar** → aceite os melhores preços → **Gerar pedidos** |
| 5 | `andre@` | **Pedidos** → baixe o PDF do pedido |
| 6 | `gilson@` | **Recebimento** → confira a entrega |
| 7 | `neilma@` | **Financeiro** → **Notas fiscais** → lance a nota → gere parcelas |
| 8 | `neilma@` | **Financeiro** → **Dar baixa** numa parcela |
| 9 | `admin@` | **Relatórios** → aba **Economia** → mostre quanto a cotação economizou |

**Feche com a tela de Início**: ela resume tudo isso em números, e cada número leva de
volta à tela de origem.

---

# Se travar

| Aconteceu | O que fazer |
|---|---|
| A tela não abre | **Status do sistema** — veja se está tudo verde |
| Não achei um item no menu | A conta não tem a função; entre como `admin@` |
| "Muitas requisições" | Espere 1 minuto — é a proteção contra excesso de acessos |
| Quero recomeçar do zero | Peça para recarregar os dados de teste |
