<!-- versao: 0.60.0 -->

# O que falta para ligar o SEFAZ

Levantamento feito em **10/10/2026** a pedido da AV2 Tech, lendo o sistema como ele está
hoje — não a documentação dele.

A pergunta que este documento responde: **o que a Porto Inc. precisa providenciar, decidir
e pagar** para o sistema conferir sozinho as notas fiscais que os fornecedores emitem
contra o CNPJ da empresa.

---

# 1 · A resposta curta

| | |
|---|---|
| **A empresa precisa providenciar** | 1 certificado digital **A1**, o CNPJ e a UF, e uma decisão sobre manifestação de notas |
| **Custo recorrente** | o certificado A1, renovado **todo ano** (a cotar com a certificadora) |
| **Custo de implantação** | trabalho de desenvolvimento — ver a seção 4 |
| **Está travado em** | **a empresa.** Nada depende de decisão técnica nossa |
| **Desde quando** | a pergunta "quem tem o certificado A1?" está aberta desde a análise do fluxo de compras, e nunca foi respondida |

> **O ponto mais importante deste documento:** o certificado é **necessário mas não
> suficiente**. Há trabalho de construção depois dele, e há uma decisão de processo que é
> do setor fiscal/contábil, não da TI. As duas coisas estão nas seções 4 e 5.

---

# 2 · O que a empresa precisa providenciar

## 2.1 · Certificado digital A1 do CNPJ

**Tem de ser A1, não A3.** A diferença decide se funciona:

| | A1 | A3 |
|---|---|---|
| Formato | **arquivo** (`.pfx`), com senha | cartão ou token USB |
| Serve num servidor? | **Sim** | **Não** — exige alguém plugando o token |
| Validade | 1 ano | 1 a 3 anos |

O sistema roda num servidor que trabalha sozinho, inclusive de madrugada. Um certificado
em token precisa de uma pessoa presente, e por isso **não serve**.

**O que precisa chegar até nós:** o arquivo `.pfx` e a senha dele.

> **Atenção com o caminho.** O arquivo `.pfx` e a senha, juntos, **são a assinatura
> digital da empresa**: quem tem os dois pode assinar documentos fiscais em nome da Porto
> Inc. Não devem trafegar por WhatsApp nem por e-mail comum. O ideal é entrega presencial
> ou por um canal combinado com quem cuida do certificado.

## 2.2 · Três informações do cadastro

| Informação | Para quê |
|---|---|
| **CNPJ** da Porto Inc. | é por ele que o SEFAZ sabe quais notas são da empresa |
| **UF** (estado) | define em qual servidor do SEFAZ o sistema fala |
| **Razão social**, exatamente como na Receita | conferência das notas recebidas |

## 2.3 · Quem é o responsável

Uma pessoa da empresa para ser o ponto de contato: quem renova o certificado quando vencer
(**todo ano**) e quem decide sobre a manifestação de notas (seção 5).

> Certificado vencido **para a integração em silêncio**. Sem alguém responsável pela
> renovação, o sistema volta a depender de digitação manual no dia do vencimento, e
> provavelmente ninguém vai perceber na hora.

---

# 3 · O que já está pronto, e não se paga de novo

Esta seção existe para evitar um mal-entendido comum: *"então o sistema não lê nota
fiscal?"*. Ele lê, e isso é a parte cara.

| Já funciona hoje | Como |
|---|---|
| **Entender a nota inteira** | o sistema lê o XML da NF-e e extrai número, série, chave de 44 dígitos, emitente, data, valor, frete e **todos os itens**, com código de barras quando a nota traz |
| **Conferir contra o pedido** | compara o que a nota diz com o que foi comprado e aponta a diferença |
| **Achar o fornecedor sozinho** | pelo CNPJ da nota, já mostra só os pedidos daquele fornecedor |
| **Gerar as parcelas** | da nota nascem as contas a pagar, com as condições combinadas na cotação |
| **Guardar a nota** | o XML fica arquivado junto do pedido |

**Como o XML entra hoje:** alguém recebe do fornecedor (por e-mail, em geral) e usa o botão
**Importar XML** na tela de Notas fiscais. A nota é lida e conferida na hora.

> Ou seja: **o sistema já funciona sem o SEFAZ.** O que o SEFAZ acrescenta é parar de
> depender do fornecedor mandar o arquivo, e descobrir notas emitidas contra a empresa que
> ninguém avisou.

---

# 4 · O que falta construir

O que existe hoje é o **encaixe** da integração: o lugar certo, com o formato certo, e o
aviso de que falta o certificado. A conversa com o SEFAZ em si **ainda não foi escrita**.

| O que falta | Por que é necessário |
|---|---|
| Conversar com o servidor do SEFAZ usando o certificado | é assim que a Receita confirma que é mesmo a Porto Inc. pedindo |
| Pedir as notas em lote e **não repetir** | o serviço entrega as notas em sequência numerada; o sistema precisa guardar onde parou |
| Descompactar e ler o que vem | as notas chegam compactadas dentro da resposta |
| **Manifestar** as notas | ver a seção 5 — sem isso vem só um resumo, sem os itens |
| Buscar sozinho, de tempos em tempos | de nada adianta se alguém tiver de clicar |
| Uma tela para acompanhar | ver o que entrou, o que ainda não tem pedido e o que deu errado |

**Estimativa de esforço:** da ordem de **uma a duas semanas** de desenvolvimento, contando
testes e o ambiente de homologação da Receita. Não é uma tarde.

> A estimativa supõe o certificado **em mãos**. Sem ele não dá nem para testar: o ambiente
> de homologação do SEFAZ também exige certificado.

---

# 5 · A decisão que não é de TI

Esta é a parte que costuma travar projetos assim, e é melhor decidir antes.

Quando um fornecedor emite uma nota contra a Porto Inc., a empresa pode **manifestar-se**
sobre ela — dizer à Receita que reconhece, desconhece ou não realizou aquela operação.

**O problema prático:** sem manifestação, o serviço da Receita entrega apenas um **resumo**
da nota — chave, emitente, valor e data. **Sem os itens.** E é justamente a conferência
item a item que a Porto Inc. quer: saber se o que veio na nota é o que foi comprado.

Para receber o **XML completo**, a empresa precisa manifestar.

**O que precisa ser decidido, com o contador:**

1. A Porto Inc. vai manifestar as notas que recebe? *(para o sistema servir, a resposta
   precisa ser sim)*
2. Quem decide manifestar — uma pessoa conferindo uma a uma, ou o sistema manifestando
   automaticamente o que bater com um pedido de compra?
3. O que fazer quando aparecer uma nota **sem pedido de compra correspondente** — é
   compra fora do processo, é erro do fornecedor, ou é fraude? Quem é avisado?

> O item 3 é, sozinho, um dos melhores motivos para ligar o SEFAZ: hoje, uma nota emitida
> contra o CNPJ da Porto Inc. que ninguém mandou para a empresa **passa despercebida até o
> contador fechar o mês**.

---

# 6 · Uma correção técnica que vale registrar

Na documentação original do fluxo de compras ficou escrito que a nota fiscal em PDF seria
*"consultada diretamente da Receita Federal"*.

**Isso não existe.** A Receita não guarda nem entrega PDF. O que se obtém é o **XML**. O
documento visual (DANFE) é gerado a partir dele.

Não muda nada do que a empresa precisa providenciar — está aqui só para a expectativa ficar
certa: **o que chega é dado, não um documento pronto para imprimir.**

---

# 7 · A ordem sugerida

| | Passo | De quem é |
|---|---|---|
| 1 | Decidir se a empresa vai manifestar as notas (seção 5) | a Porto Inc. + contador |
| 2 | Contratar ou localizar o certificado **A1** | a Porto Inc. |
| 3 | Entregar o `.pfx`, a senha, o CNPJ e a UF | a Porto Inc. |
| 4 | Construir e testar em homologação | AV2 Tech |
| 5 | Ligar em produção, acompanhando a primeira semana | AV2 Tech |
| 6 | Combinar quem renova o certificado todo ano | a Porto Inc. |

**Os passos 1 a 3 não dependem de nós, e são o que está travando.**

---

# 8 · E se a empresa não fizer agora?

O sistema **continua funcionando**. A diferença:

| | Sem SEFAZ (hoje) | Com SEFAZ |
|---|---|---|
| Como a nota entra | o fornecedor manda o XML, alguém importa | o sistema busca sozinho |
| Nota que o fornecedor não mandou | **ninguém fica sabendo** | aparece na tela |
| Conferência com o pedido | funciona | funciona |
| Contas a pagar | funciona | funciona |

**Não é um bloqueio para usar o sistema.** É a diferença entre depender do fornecedor
lembrar de mandar o arquivo e não depender.

---

## Em uma frase

> Para ligar o SEFAZ, a Porto Inc. precisa de um **certificado digital A1 em arquivo**, de
> **uma decisão sobre manifestação de notas** tomada junto com o contador, e de **uma a
> duas semanas** de desenvolvimento depois disso. O sistema já sabe ler e conferir nota
> fiscal — o que falta é ir buscá-la sozinho.
