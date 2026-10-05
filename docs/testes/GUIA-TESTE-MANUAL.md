<!-- versao: 0.43.0 -->

# 1. Como usar este guia

## Para que serve

Este roteiro serve para conferir **na tela** se o sistema faz o que promete.

O sistema também tem **testes automatizados** — 634 deles, rodando em cerca de 2 minutos. Eles conferem as regras por dentro. Mas há coisas que só uma pessoa percebe:

| O teste automatizado confere | Só o teste manual percebe |
|---|---|
| Se a API recusa um CNPJ inválido | Se a mensagem de erro é compreensível |
| Se a permissão bloqueia a rota | Se o menu ficou confuso sem aquele item |
| Se o total do orçamento está certo | Se o número está difícil de ler na tela |
| Se o cadastro salvou | Se o formulário é cansativo de preencher |

> **Regra de ouro:** se você travou, hesitou ou precisou adivinhar em algum passo, **isso é uma falha**, mesmo que o sistema tenha funcionado. Anote.

## Como marcar

Cada caso tem uma linha de resultado. Marque assim:

| Marca | Quando usar |
|---|---|
| **OK** | Aconteceu exatamente o que estava escrito |
| **FALHOU** | Aconteceu outra coisa |
| **DÚVIDA** | Funcionou, mas ficou confuso ou estranho |

## Como relatar um problema

Anote estas quatro coisas. Sem elas fica difícil consertar:

1. **Qual caso** (ex.: CT-14)
2. **Com qual conta** você estava (ex.: Gilson)
3. **O que você esperava** que acontecesse
4. **O que aconteceu** de verdade

Se der, tire um print da tela.

---

# 2. Antes de começar

## Preparando o ambiente

| Passo | Comando |
|---|---|
| 1. Abrir o Docker Desktop | — |
| 2. Ligar o sistema | `docker compose up -d` |
| 3. Conferir se subiu | `docker compose ps` — as três caixas devem estar **Up** |
| 4. Abrir no navegador | http://localhost:5173 |

## Contas de teste

Todas usam a senha **Porto@2026**

| Pessoa | E-mail | Funções |
|---|---|---|
| Administrador | admin@portoinc.com.br | Administrador |
| Washington | washington@portoinc.com.br | Fundador |
| Andre | andre@portoinc.com.br | Comprador |
| Bras | bras@portoinc.com.br | Gestor de obra + Solicitante |
| Gilson | gilson@portoinc.com.br | Almoxarife |
| Neilma | neilma@portoinc.com.br | Comprador + Solicitante |
| Engenheiro | engenheiro@portoinc.com.br | Engenheiro |

## Voltando o sistema ao estado inicial

Se você bagunçar os dados durante os testes e quiser recomeçar do zero:

```bash
docker compose down -v
docker compose up -d
```

> **Atenção:** isso apaga tudo que foi cadastrado. Espere uns 2 minutos até o sistema recriar os dados de demonstração.

---

# 3. Etapa 1 — Acesso ao sistema

## CT-01 · Entrar com dados corretos

**Conta:** admin@portoinc.com.br

1. Abra http://localhost:5173
2. Digite o e-mail e a senha
3. Clique em **Entrar**

**Esperado:** entra no sistema e cai na tela de Início, com "Bom dia/Boa tarde" e o seu nome.

**Confira também:** o cursor já estava no campo de e-mail quando a tela abriu? Você conseguiu usar **Tab** e **Enter** sem tocar no mouse?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-02 · Senha errada

1. Saia do sistema
2. Digite o e-mail certo e uma senha errada

**Esperado:** mensagem *"E-mail ou senha incorretos."* aparecendo **perto do botão**, não no topo da página.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-03 · E-mail que não existe

1. Digite `naoexiste@portoinc.com.br` com qualquer senha

**Esperado:** **exatamente a mesma mensagem** do caso CT-02.

> **Por que isso importa:** se o sistema dissesse "este e-mail não existe", um invasor descobriria a lista de quem trabalha na empresa testando endereços.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-04 · Bloqueio por tentativas repetidas

1. Erre a senha **11 vezes seguidas**

**Esperado:** a partir da 11ª, aparece uma mensagem diferente dizendo para aguardar.

> Depois deste teste, espere 5 minutos antes de continuar, ou use outra conta.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-05 · Continuar conectado

1. Entre no sistema
2. Feche a aba do navegador
3. Abra http://localhost:5173 de novo
4. Navegue até uma tela de dentro (ex.: **Cotações**) e aperte **F5**
5. Abra o sistema numa **segunda aba**, com a primeira ainda aberta

**Esperado:** em todos os casos entra direto, sem pedir a senha, e continua na mesma tela.

> **Por que o passo 4 e o 5 existem.** O crachá da sessão é de uso único: cada renovação troca ele por outro. Se duas telas pedissem renovação ao mesmo tempo, a segunda chegaria com o crachá já trocado e derrubaria a sessão sem motivo. Este teste é o que pega essa falha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-06 · O menu muda conforme a pessoa

1. Entre como **Gilson** e anote os itens do menu
2. Saia
3. Entre como **Administrador** e anote de novo

**Esperado:**

| Gilson (almoxarife) | Administrador |
|---|---|
| Início, Solicitações, Recebimento, Estoque, Cadastros | Todos os itens, incluindo Usuários e Status do sistema |

Gilson **não** pode ver: Aprovações, Cotações, Financeiro, Usuários, Status do sistema.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-07 · Bloqueio ao forçar o endereço

**Conta:** gilson@portoinc.com.br

1. Entre como Gilson
2. Na barra de endereço do navegador, digite `http://localhost:5173/admin/usuarios`

**Esperado:** uma tela dizendo que ele não tem acesso, e orientando a falar com o administrador. **Não pode** aparecer a lista de usuários.

> Esconder o item do menu é conforto visual. Este caso testa a trava de verdade.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-08 · Uma pessoa com duas funções

**Conta:** neilma@portoinc.com.br

1. Entre como Neilma
2. Olhe a frase abaixo do "Boa tarde"

**Esperado:** diz que ela é **comprador e solicitante**, com o total de permissões somadas. O menu mostra tanto Cotações (de comprador) quanto Solicitações (de solicitante).

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-09 · Cadastrar um usuário novo

**Conta:** admin@portoinc.com.br

1. Vá em **Usuários** → **+ Novo usuário**
2. Preencha: nome "Teste Manual", e-mail `teste.manual@portoinc.com.br`, senha `Teste12345`
3. Marque **duas** funções
4. Clique em **Cadastrar usuário**

**Esperado:** mensagem verde de sucesso e a pessoa aparece na lista com **duas etiquetas de função** e "Nunca entrou".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-10 · Senha fraca é recusada

1. Tente cadastrar outro usuário com a senha `12345678`

**Esperado:** o sistema recusa e explica que falta uma letra.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-11 · E-mail repetido é recusado

1. Tente cadastrar alguém com o e-mail `gilson@portoinc.com.br`

**Esperado:** o sistema avisa que já existe usuário com esse e-mail.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-12 · Desativar alguém derruba a sessão

**Precisa de dois navegadores** (ou uma janela anônima).

1. Na **janela A**, entre como Gilson
2. Na **janela B**, entre como Administrador e desative o Gilson
3. Volte à janela A e clique em qualquer item do menu

**Esperado:** a janela A é levada de volta à tela de entrada.

> Depois do teste, reative o Gilson.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-13 · Administrador não se desativa

**Conta:** admin@portoinc.com.br

1. Em **Usuários**, tente desativar a própria conta de Administrador

**Esperado:** o sistema recusa, dizendo que você não pode desativar a si mesmo.

> Sem essa trava, seria possível ficar sem nenhum administrador e travar o sistema inteiro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-14 · Trocar a própria senha

**Conta:** teste.manual@portoinc.com.br (criada no CT-09)

1. Entre com essa conta
2. Clique em **Trocar minha senha** no rodapé do menu
3. Digite a senha atual e uma nova **diferente nas duas caixas**

**Esperado:** o sistema avisa na hora que as senhas não conferem, **antes** de você clicar no botão.

4. Agora digite iguais e confirme

**Esperado:** mensagem de sucesso e você volta à tela de entrada. A senha nova funciona; a antiga não.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 4. Etapa 2 — Cadastros

## CT-15 · A ordem dos cadastros está clara

**Conta:** admin@portoinc.com.br

1. Vá em **Cadastros**

**Esperado:** cinco cartões **numerados de 1 a 5**, cada um com a contagem do que já existe, e um aviso explicando por que essa ordem.

**Confira também:** lendo só essa tela, você entenderia por onde começar se nunca tivesse visto o sistema?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-16 · Cadastrar uma família

1. **Cadastros → Famílias → + Nova família**
2. Código `TST`, nome "Família de teste"

**Esperado:** o código aparece em **maiúsculas** mesmo se você digitou minúsculo. O cartão mostra "0 itens · 0 fornecedor(es)".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-17 · Código de barras errado é recusado

1. **Cadastros → Materiais e serviços → + Novo item**
2. Preencha os campos obrigatórios
3. No código de barras, digite `7899888400576` (o último dígito está trocado de propósito)
4. Clique fora do campo

**Esperado:** o sistema avisa que o dígito verificador não confere.

> Um código errado no cadastro vira material bipado que "não existe" na hora do recebimento, com o caminhão parado no portão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-18 · Código de barras já usado

1. Cadastre um item com o código de barras `7899888400575`

**Esperado:** o sistema avisa que esse código já está no "Cimento Portland CP-II-Z-32".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-19 · Serviço não tem código de barras

1. **+ Novo item** → em **Tipo**, escolha **Serviço**

**Esperado:** os campos de código de barras e ponto de pedido **somem da tela**, e aparece um aviso explicando que serviço não entra no estoque.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-20 · Os três códigos do material

1. Abra a lista de **Materiais e serviços**
2. Olhe as colunas

**Esperado:** três colunas diferentes e independentes:

| Coluna | Exemplo |
|---|---|
| Cód. Porto | `00119` |
| Cód. de barras | `7899888400575` |
| Norma | `NBR 16697` |

**Confira também:** os números do "Ponto de pedido" estão **alinhados à direita**?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-21 · Filtrar o catálogo

1. Em **Materiais e serviços**, escolha **Só serviço** no filtro de tipo e clique em **Filtrar**

**Esperado:** só aparecem itens com a etiqueta **Serviço**, todos sem código de barras.

2. Volte para "Material e serviço" e filtre pela família **Material elétrico**

**Esperado:** só itens da família ELE.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-22 · CNPJ inválido é recusado

1. **Cadastros → Fornecedores → + Novo fornecedor**
2. Razão social qualquer, CNPJ `11.111.111/1111-11`

**Esperado:** o sistema recusa dizendo que o dígito verificador não confere.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-23 · Fornecedor sem família é sinalizado

1. Cadastre um fornecedor com CNPJ válido (`47.960.950/0001-21`) e **não marque nenhuma família**

**Esperado:** o cartão dele mostra um aviso amarelo: *"Nenhuma família — não será convidado a cotar"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-24 · Filtrar fornecedor por família

1. Em **Fornecedores**, escolha **Atende Material elétrico** e clique em **Filtrar**

**Esperado:** aparece apenas a **Eletrosul**.

> Este é o teste mais importante da tela: é exatamente essa lista que o sistema vai usar na Etapa 5 para decidir quem convidar para cada cotação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-25 · Criar obra cria o almoxarifado junto

1. **Cadastros → Obras → + Nova obra**
2. Código `OB-TESTE`, nome "Obra de Teste"
3. Salve e clique em **Abrir**

**Esperado:** o cartão **Almoxarifados** mostra **1**, com o nome "Almoxarifado Obra de Teste". Ninguém precisou criar à mão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-26 · Orçamento e total

1. Abra a obra **Residencial Porto Belo**

**Esperado:**

- Cartão **Orçamento previsto**: R$ 596.650,00
- 20 linhas na tabela
- O **total no rodapé** da tabela bate com o cartão
- Os valores estão alinhados à direita e com `R$`

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-27 · Importar planilha de orçamento

1. Crie um arquivo `teste.csv` no Bloco de Notas com este conteúdo:

```
codigo;descricao;unidade;quantidade;valor_unitario
90.01.001;Serviço de teste;M2;100;25,50
90.01.002;Outro item;UN;10;1.500,00
```

2. Abra a obra **Obra de Teste** → **📥 Importar planilha**
3. Escolha o arquivo e clique em **Importar**

**Esperado:** mensagem "2 linha(s) importada(s)" e as linhas aparecem na tabela. O valor `1.500,00` virou **R$ 1.500,00** (e não R$ 1,50).

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-28 · Importar planilha com defeito

1. Acrescente estas linhas ao arquivo e importe de novo:

```
;Linha sem codigo;M2;10;10
90.01.003;Valor errado;M2;abc;xyz
```

**Esperado:** o sistema **não desiste do arquivo inteiro**. Ele importa o que está certo e lista os problemas com o **número da linha**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-29 · Reimportar não duplica

1. Importe **o mesmo arquivo** mais uma vez

**Esperado:** "0 importadas, 2 já existiam e foram ignoradas". A tabela **não** ganha linhas repetidas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-30 · Simulador de alçada

**Conta:** admin@portoinc.com.br

1. **Cadastros → Limites de alçada**
2. Teste estes valores no simulador:

| Valor | Resposta esperada |
|---|---|
| 800 | Basta uma: **Gestor de obra** |
| 7.500 | **TODAS**: Gestor de obra **e** Engenheiro |
| 42.000 | Basta uma: **Fundador** |

3. Teste também os botões de atalho R$ 500 / R$ 5.000 / R$ 50.000

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-31 · Aviso de furo nas faixas

1. **+ Nova faixa**: descrição "Faixa com furo", mínimo `50000`, máximo `60000`, marque uma função
2. Salve e recarregue a tela

**Esperado:** aparece um aviso amarelo no topo apontando **sobreposição** com a faixa "Acima de R$ 15.000,01".

> O sistema avisa mas **não impede** de salvar — a empresa pode ter um motivo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-32 · Quem só consulta não vê botões de editar

**Conta:** bras@portoinc.com.br

1. Entre como Bras
2. Vá em **Cadastros → Obras** e abra uma obra

**Esperado:** ele vê a obra e o orçamento, mas **não** aparecem os botões **+ Nova linha**, **Importar planilha** nem **Remover**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 5. Etapa 3 — Solicitação de compra

## CT-40 · Abrir uma solicitação

**Conta:** bras@portoinc.com.br

1. **Solicitações → + Nova solicitação**
2. Obra: **Residencial Porto Belo**
3. Precisa até: uma data daqui a 30 dias
4. Justificativa: *"Concretagem da laje do 3º pavimento"*
5. Item: **Cimento Portland**, quantidade **120**, valor estimado **34**
6. **+ Adicionar item à solicitação** e depois **Salvar como rascunho**

**Esperado:** vai para a tela da solicitação, com número no formato **SOL-00001** e situação **Rascunho**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-41 · A unidade vem preenchida sozinha

1. Numa nova solicitação, escolha **Cimento Portland** no catálogo

**Esperado:** o rótulo do campo de quantidade muda para **"Quantidade em SC"**. Você não digita a unidade.

2. Troque para **Areia média lavada**

**Esperado:** o rótulo passa a **"Quantidade em M3"**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-42 · A linha de orçamento vem sugerida

1. Escolha a obra **Residencial Porto Belo**
2. Escolha **Cimento Portland** no catálogo

**Esperado:** o campo **Linha do orçamento** já vem com `03.01.001 — Cimento Portland` preenchido, e o texto de ajuda diz de onde veio a sugestão.

3. Troque a linha manualmente

**Esperado:** aceita a troca sem reclamar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-43 · O total soma corretamente

1. Adicione **Cimento**: 120 × R$ 34,00
2. Adicione **Areia**: 10 × R$ 130,00

**Esperado:** a tabela mostra R$ 4.080,00 e R$ 1.300,00, e o rodapé mostra **R$ 5.380,00**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-44 · Sem item não salva

1. Preencha só a obra, sem adicionar nenhum item

**Esperado:** aparece um aviso amarelo *"Adicione pelo menos um item"* e o botão **Salvar como rascunho** fica desabilitado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-45 · Primeira compra exige especificação

1. Cadastre um material novo em **Cadastros → Materiais** (ex.: *"Aditivo plastificante"*, unidade LT)
2. Abra uma solicitação pedindo esse item, **sem** preencher a especificação técnica
3. Salve e clique em **Enviar para aprovação**

**Esperado:** o envio é **bloqueado**, com a mensagem explicando que o item nunca foi comprado e que é preciso descrever a especificação técnica.

**Confira também:** a etiqueta **Primeira compra** aparece na linha do item?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-45a · Corrigir o rascunho recusado

> Continua do CT-45, com o envio bloqueado na tela. **Este é o teste mais importante da tela de solicitação**: sem ele, o único caminho era cancelar e refazer tudo.

1. Clique em **✏️ Editar**

**Esperado:** o modal abre com o título **"Corrigir SOL-000xx"** e **tudo já preenchido** — obra, prazo, justificativa, observações e os itens na lista.

2. Confira que os itens não vieram vazios nem perderam a linha de orçamento
3. Preencha a **especificação técnica** que faltava
4. Clique em **Salvar alterações**
5. Clique em **Enviar para aprovação**

**Esperado:** agora o envio passa.

6. Depois de enviada, procure o botão **Editar**

**Esperado:** ele **sumiu**. Documento em aprovação não muda embaixo de quem vai assinar.

7. Entre com outra conta e abra um rascunho que não seja seu

**Esperado:** sem botão **Editar** — só o autor corrige.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-45b · Obra sem orçamento avisa antes

1. Em **Cadastros → Obras**, cadastre uma obra nova e **não** cadastre orçamento nela
2. Abra uma solicitação e escolha essa obra

**Esperado:** aparece um aviso amarelo logo abaixo da obra, dizendo que ela **não tem orçamento cadastrado**, que os itens ficarão **sem vínculo** e que **isso não tem volta**.

3. Confira que o botão **Salvar** continua funcionando

**Esperado:** é aviso, não trava. Obra sem orçamento é problema de cadastro, não desta compra — travar aqui pararia a obra inteira.

4. Volte, escolha a **OB-001** (que tem orçamento)

**Esperado:** o aviso some e a lista de linhas aparece preenchida.

> **Por que esse aviso existe:** na validação de 27/09/2026 a solicitação foi criada antes do orçamento da obra. Os itens ficaram sem vínculo, a compra saiu do relatório de orçado x realizado, e não havia como consertar depois.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-46 · "Quem aprova" aparece antes de enviar

1. Abra uma solicitação com total em torno de **R$ 800**
2. Olhe o cartão **Quem aprova**

**Esperado:** uma linha com **Gestor de obra** e, ao lado, *aguardando*.

3. Abra outra com total em torno de **R$ 7.500**

**Esperado:** **duas** linhas — Gestor de obra e Engenheiro — e a etiqueta *Todas precisam assinar*.

4. E outra acima de **R$ 15.000**

**Esperado:** aparece o **Fundador**.

5. Em todas elas, leia a última linha do cartão

**Esperado:** *"Pelo valor de R$ …, faixa …"* — com o valor e o nome da faixa que pegou. Se o nome da faixa não bater com o valor, a alçada está configurada errada.

6. Confira que **nenhuma palavra do cartão está em CAIXA ALTA**

O sistema não grita com quem usa. Se aparecer "TODAS" em maiúsculas, é resquício de uma versão antiga.

> Isso bate exatamente com o simulador do caso CT-30. Se divergir, uma das duas telas está errada.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-47 · Depois de enviada não muda mais

1. Envie uma solicitação para aprovação
2. Olhe a tela dela

**Esperado:** a situação vira **Aguardando aprovação** e o botão **Enviar para aprovação** some.

3. Tente enviar de novo pelo botão de voltar do navegador

**Esperado:** o sistema recusa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-48 · Cada um vê o que solicitou

1. Como **Bras**, abra uma solicitação e **anote o número**
2. Saia e entre como **Gilson**
3. Vá em **Solicitações**

**Esperado:** a solicitação do Bras **não aparece** na lista do Gilson. No alto da tela, a frase diz que ele vê apenas as próprias.

4. Saia e entre como **Neilma** (compradora)

**Esperado:** ela **vê** a solicitação do Bras, e a frase no alto diz que ela enxerga as de toda a empresa. Aparece também o filtro **Quem pediu**, ao lado do de Situação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-49 · PDF da solicitação

1. Abra uma solicitação e clique em **📄 Baixar PDF**

**Esperado:** baixa um arquivo chamado **SOL-00001.pdf** (ou o número correspondente).

2. Abra o arquivo e confira:

| Deve conter |
|---|
| Marca **Porto Inc.** e o número da solicitação |
| Obra, solicitante e datas |
| Tabela de itens com código, descrição, unidade e quantidade |
| Norma técnica e linha de orçamento embaixo de cada item |
| Total estimado |
| Especificações técnicas, se houver |
| Espaço para assinatura do **solicitante** e do **aprovador** |

**Confira também:** os acentos saíram corretos? Cabe em uma página para uma solicitação pequena?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-50 · O histórico registra tudo

1. Abra uma solicitação que você já enviou
2. Role até **Histórico**

**Esperado:** pelo menos dois registros, do mais recente para o mais antigo:

- *"Enviada para aprovação. Precisa de ... assinatura(s): ..."* — com seu nome e a hora
- *"Solicitação aberta como rascunho."* — com seu nome e a hora

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-51 · Cancelar solicitação

1. Abra um rascunho e clique em **Cancelar solicitação**

**Esperado:** volta para a lista. A solicitação continua lá, com a situação **Cancelada**.

2. Abra a solicitação cancelada

**Esperado:** o histórico está preservado e o botão de cancelar já não aparece.

> Preferimos cancelar a apagar: apagar levaria junto o rastro de quem pediu o quê.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 6. Etapa 4 — Aprovação

> **Preparação:** entre como **Gilson** e abra três solicitações, enviando todas:
> uma com total em torno de **R$ 1.000**, outra de **R$ 7.000** e outra acima de **R$ 20.000**.
> O Gilson é almoxarife, então ele pode pedir mas não aprova — é justamente o que
> queremos para testar.

## CT-52 · A fila mostra só o que é seu

**Conta:** bras@portoinc.com.br (gestor de obra)

1. Entre como Bras e vá em **Aprovações**

**Esperado:** aparecem as solicitações de **R$ 1.000** e **R$ 7.000**. A de **R$ 20.000 não aparece** — aquela faixa é do Fundador.

2. Saia e entre como **Washington** (fundador)

**Esperado:** o inverso. Ele vê só a de R$ 20.000.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-53 · Os três números do topo

1. Na tela de Aprovações do Bras, olhe os cartões

**Esperado:**

| Cartão | Confira |
|---|---|
| **Esperando você** | Bate com a quantidade de linhas da tabela |
| **Valor acumulado** | É a soma dos valores da coluna |
| **Prazo apertado** | Conta as que vencem em até 7 dias |

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-54 · Aviso de prazo

1. Abra uma solicitação como Gilson e coloque **Precisa até** para **daqui a 3 dias**
2. Envie e volte à fila do Bras

**Esperado:** a coluna **Precisa até** mostra uma etiqueta amarela **"Faltam 3 dia(s)"**, em vez da data simples.

3. Repita com uma data **no passado**

**Esperado:** etiqueta vermelha **"Atrasada há X dia(s)"**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-55 · Aprovação com uma assinatura

**Conta:** bras@portoinc.com.br

1. Clique em **Analisar** na solicitação de ~R$ 1.000
2. No painel **Sua decisão**, escolha **Aprovar**
3. Confirme

**Esperado:** mensagem verde dizendo que a solicitação foi **aprovada e liberada para cotação**. A etiqueta no topo vira **Aprovada**.

4. Volte para **Aprovações**

**Esperado:** ela **sumiu da fila**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-56 · Aprovação com DUAS assinaturas

**Contas:** bras (gestor) e engenheiro@portoinc.com.br

1. Como **Bras**, analise a solicitação de ~R$ 7.000
2. Repare no painel: diz **"0 de 2 assinaturas"**
3. Aprove

**Esperado:** a situação **continua Aguardando aprovação**, e a mensagem diz *"1 de 2 assinaturas. Falta: Engenheiro."*

4. Volte à fila do Bras

**Esperado:** ela **sumiu** da fila dele — já assinou.

5. Saia e entre como **Engenheiro**, vá em **Aprovações**

**Esperado:** a mesma solicitação **está lá**, mostrando **1 de 2**.

6. Aprove

**Esperado:** agora sim vira **Aprovada**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-57 · Ninguém aprova o próprio pedido

**Conta:** bras@portoinc.com.br

1. Como Bras, abra uma solicitação de ~R$ 1.000 e envie
2. Vá em **Aprovações**

**Esperado:** a solicitação que **ele mesmo** abriu **não aparece** na fila.

3. Abra a solicitação por **Solicitações → Abrir**

**Esperado:** o painel **Sua decisão** **não aparece**, mesmo ele sendo gestor de obra.

> Esta é a trava mais importante da etapa: é o controle contra alguém comprar para si mesmo sem ninguém olhar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-58 · Devolver exige explicar o motivo

1. Analise qualquer solicitação da sua fila
2. Escolha **Devolver para revisão**
3. Deixe a observação **em branco** e tente confirmar

**Esperado:** o botão fica desabilitado e aparece a mensagem *"Sem explicar o motivo, o solicitante não sabe o que corrigir."*

4. Escreva um motivo e confirme

**Esperado:** a situação vira **Em revisão**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-59 · O solicitante corrige e reenvia

1. Entre como **Gilson** (autor da solicitação devolvida)
2. Abra a solicitação

**Esperado:** a situação é **Em revisão** e o botão **Enviar para aprovação** voltou a aparecer. O histórico mostra a observação do aprovador.

3. Clique em **Enviar para aprovação**

**Esperado:** volta para **Aguardando aprovação** e reaparece na fila do aprovador.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-60 · Reenviar zera as assinaturas antigas

1. Abra uma solicitação de ~R$ 7.000 (das que exigem duas assinaturas)
2. Como **Bras**, aprove (fica 1 de 2)
3. Como **Engenheiro**, **devolva** com um motivo
4. Como **Gilson**, reenvie
5. Olhe a tabela **Assinaturas**

**Esperado:** ela está **vazia**. A aprovação anterior do Bras não vale mais.

> **Por quê:** ele aprovou um conteúdo que pode ter mudado na correção.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-61 · O aviso ao reprovar

1. Analise uma solicitação e escolha **Reprovar**

**Esperado:** aparece um aviso vermelho dizendo que reprovar **encerra o pedido definitivamente** e sugerindo devolver, se o problema for corrigível. O botão de confirmar fica vermelho.

2. Confirme

**Esperado:** a situação vira **Reprovada** e não há mais nenhuma ação disponível.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-62 · Uma reprovação derruba a aprovação existente

1. Abra uma solicitação de ~R$ 7.000 e envie
2. Como **Bras**, aprove (fica 1 de 2)
3. Como **Engenheiro**, **reprove**

**Esperado:** a solicitação fica **Reprovada**, mesmo já tendo uma aprovação registrada.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-63 · As assinaturas ficam registradas

1. Abra uma solicitação já decidida
2. Role até a tabela **Assinaturas**

**Esperado:** uma linha por decisão, com **quem**, **qual função**, **qual decisão**, **a observação** e **quando**.

3. Role até **Histórico**

**Esperado:** o mesmo aparece na linha do tempo, com um texto explicativo — por exemplo *"Aprovada por Gestor de obra. 1 de 2 assinaturas. Falta: Engenheiro."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-64 · Nomes de função legíveis

1. Olhe as mensagens do painel de decisão e da fila

**Esperado:** aparece **"Gestor de obra"**, e nunca `GESTOR_OBRA` com sublinhado.

> Código interno não deve vazar para a tela do usuário.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-65 · Quem não aprova não vê a tela

**Conta:** gilson@portoinc.com.br

1. Entre como Gilson
2. Procure **Aprovações** no menu

**Esperado:** o item **não existe** para ele.

3. Digite `http://localhost:5173/aprovacoes` na barra de endereço

**Esperado:** tela de acesso negado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 7. Etapa 5 — Cotação e portal do fornecedor

> **Preparação:** garanta que existam solicitações **aprovadas**. Se não houver,
> refaça os casos CT-55 e CT-56 aprovando o que estiver na fila.

## CT-66 · Só entra o que foi aprovado

**Conta:** neilma@portoinc.com.br (compradora)

1. **Cotações → + Novo pacote de cotação**
2. Olhe a lista de itens

**Esperado:** aparecem **só** itens de solicitações aprovadas. Um item de solicitação em rascunho ou aguardando aprovação **não** aparece.

3. Confira a coluna **Origem**

**Esperado:** mostra o número da solicitação (SOL-000xx) e o código da obra.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-67 · Filtrar por família

1. Use o seletor **Todas as famílias**

**Esperado:** cada opção mostra quantos itens tem, e ao escolher uma a lista reduz.

2. Clique em **Marcar/desmarcar visíveis**

**Esperado:** marca todos os que estão na tela. Clicando de novo, desmarca.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-68 · Aviso ao misturar famílias

1. Marque itens de **três famílias diferentes**
2. Olhe o quadro **Resumo do pacote**

**Esperado:** aparece um aviso amarelo explicando que alguns fornecedores vão receber itens que não atendem, e sugerindo um pacote por família.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-69 · Criar o pacote

1. Preencha título e prazo, marque alguns itens
2. Clique em **Criar pacote e escolher fornecedores**

**Esperado:** vai para a tela do pacote, com número **BID-000xx** e situação **Rascunho**.

**Confira também:** antes de criar, o selo ao lado do botão dizia *"Nada é enviado a fornecedor ainda"*?

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-70 · O mesmo item não entra em dois pacotes

1. Crie um pacote com um item
2. Crie outro pacote e procure o mesmo item na lista

**Esperado:** ele **não aparece mais**. Já está no primeiro pacote.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-71 · Fornecedores sugeridos pela família

1. Na tela do pacote em rascunho, olhe **Fornecedores sugeridos**

**Esperado:** aparecem só os fornecedores que atendem as **famílias dos itens** do pacote. Cada linha mostra as famílias dele e o WhatsApp.

2. Monte um pacote **só de material elétrico** e repita

**Esperado:** aparece apenas a **Eletrosul**.

> Este é o coração da Etapa 2: é por isso que marcar as famílias no cadastro do fornecedor importava.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-72 · Não dá para abrir sem convidar antes

1. Num pacote em rascunho **sem nenhum convidado**, olhe o botão **🔒 Abrir cotação**

**Esperado:** ele está **desligado**, com a frase *"Convide pelo menos um fornecedor abaixo para poder abrir"* ao lado.

> Antes ele ficava ligado, em azul, no topo — e recusava depois do clique. O dono do sistema marcou dois fornecedores, clicou nele e levou *"Convide pelo menos um fornecedor"*, o que parecia mentira. Recusar depois do clique é pior que não deixar clicar.

2. Confira os nomes dos botões

**Esperado:** o verbo **convidar** aparece num lugar só — no botão azul embaixo da tabela. O botão do topo diz apenas **Abrir cotação**, sem prometer convidar ninguém.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-73 · Abrir a cotação

1. Confira que os sugeridos já vêm **pré-marcados** e que o botão diz **📨 Convidar 2 fornecedores**
2. Clique nele — eles passam para `Já convidado` e aparece a seção **Convidados**
3. Agora clique em **🔒 Abrir cotação**, no topo

**Esperado:**

- A situação vira **Aberto para cotação**
- Aparece a tabela **Convidados**, com um botão **🔗 Copiar link** por fornecedor
- Aparece o aviso explicando que o link vence e não expõe concorrentes

3. Vá em **Solicitações** e filtre por **Em cotação**

**Esperado:** as solicitações de origem mudaram para essa situação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-74 · Não dá para mexer depois de aberto

1. No pacote já aberto, procure os fornecedores sugeridos e o botão de remover

**Esperado:** **sumiram**. Só restam "Encerrar cotação" e "Atualizar".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-75 · O portal do fornecedor

1. Clique em **🔗 Copiar link** de um fornecedor
2. Abra uma **janela anônima** do navegador e cole o link

**Esperado:** abre a cotação **sem pedir login**, com:

| Deve aparecer |
|---|
| Marca Porto Inc. e o número BID-000xx |
| O nome **do fornecedor destinatário** |
| Quantos dias faltam, em destaque |
| Cada item com código, quantidade, norma e especificação |
| Um **campo grande de preço**, com o `R$` fixo dentro dele |
| Marca, modelo e prazo, **menores**, marcados como opcionais |
| A barra presa no pé da tela, com o total e o botão de enviar |

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-75a · A máscara de dinheiro do portal

1. No campo de preço de um item, digite `510000` sem pontuação

**Esperado:** o campo escreve **510.000** enquanto você digita.

2. Saia do campo (Tab)

**Esperado:** vira **510.000,00** — os centavos se completam sozinhos.

3. Apague e digite `26,5`, depois saia

**Esperado:** **26,50**. A vírgula abre centavos; o ponto é sempre milhar.

4. Olhe a linha logo abaixo do preço

**Esperado:** a conta em português — *"60 SC × R$ 26,50 = R$ 1.590,00"* — e ela muda a cada tecla.

5. Olhe a barra no pé da tela

**Esperado:** o **total da proposta** acompanha a digitação, somando itens + frete + outros custos.

> **Por que isto importa:** o campo era um `type="number"` cru. Quem digitava 5100 via "5100" e não tinha como perceber se queria dizer R$ 51,00 ou R$ 5.100,00. Numa proposta comercial, isso é a diferença entre ganhar e perder dinheiro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-75b · O envio fica travado até faltar preço

1. Deixe pelo menos um item sem preço

**Esperado:** na barra do pé, *"Falta o preço de 1 item"*, e o botão de enviar **desligado**.

2. Marque **"Não trabalho com este item"** nesse item

**Esperado:** o aviso some e o botão liga. Quem não trabalha com um item não pode ficar preso na tela.

3. Clique em **Voltar a cotar**

**Esperado:** os campos voltam, e o aviso também.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-76 · O fornecedor NÃO vê os concorrentes

1. Na janela anônima com o portal aberto, aperte **Ctrl+F**
2. Procure pelo nome de **outro** fornecedor convidado

**Esperado:** **não encontra nada**. Não há lista de convidados, nem preço de ninguém, nem contagem de quantos estão cotando.

> Este é o caso mais importante da etapa. Se aqui falhar, a cotação inteira perde a credibilidade com o mercado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-77 · Responder a cotação

1. Preencha preço, marca e prazo de cada item

**Esperado:** o **Total deste item** aparece embaixo de cada um, e o **Total da proposta** atualiza no fim.

2. Preencha frete, entrada e parcelas
3. Clique em **Enviar cotação**

**Esperado:** tela verde de confirmação com o total enviado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-78 · "Não tenho este item"

1. Reabra o link e marque **Não tenho este item** num dos itens

**Esperado:** os campos de preço **somem** e o item fica visualmente apagado.

2. Envie

**Esperado:** aceita, e o resumo conta o item como indisponível.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-79 · Item sem preço é bloqueado

1. Deixe um item marcado como disponível, mas **sem preço**

**Esperado:** aparece um aviso amarelo dizendo quantos itens estão sem preço, e o botão **Enviar** fica desabilitado. O aviso sugere marcar "Não tenho este item".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-80 · Revisar a resposta

1. Depois de enviar, clique em **Revisar minha resposta**

**Esperado:** o formulário volta **com os valores preenchidos** e uma faixa azul avisando que você já respondeu e que vale a última resposta.

2. Mude um preço e envie de novo

**Esperado:** aceita, e o total muda.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-81 · Link inválido

1. Na barra de endereço, troque alguns caracteres do link e recarregue

**Esperado:** mensagem clara dizendo que o link não é válido e orientando a falar com o comprador. **Nenhum erro técnico na tela.**

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-82 · O comprador acompanha

**Conta:** neilma@portoinc.com.br

1. Volte ao pacote e clique em **Atualizar**

**Esperado:** a tabela **Convidados** mostra agora:

- **Abriu o link** com data e hora
- **Respondeu** com selo verde
- **Total cotado** de cada um
- **Pagamento** proposto

2. Olhe o cartão **Respostas** no topo

**Esperado:** mostra, por exemplo, **2 de 3**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-83 · Encerrar derruba os links

1. Clique em **Encerrar cotação**
2. Volte à janela anônima e recarregue o portal

**Esperado:** mensagem dizendo que a cotação não está mais aberta para respostas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-84 · O portal no celular

1. Abra o link do portal no celular (ou com **F12** em modo celular)

**Esperado:** os campos ficam um abaixo do outro, tudo legível, **nada rola para os lados**.

2. Role até o meio do formulário

**Esperado:** a barra do total continua **presa no pé da tela**, com o botão de enviar em largura cheia.

3. Toque no campo de preço

**Esperado:** abre o **teclado numérico** do celular, não o teclado de letras.

> **Este é o caso mais importante do portal.** O fornecedor responde do telefone, no meio do expediente. Em 27/09/2026 a página tinha 470px de conteúdo numa tela de 393 e rolava para os lados — um `<fieldset>` se recusa a encolher por padrão do navegador, e o portal é tela pública, fora da lista da régua automática. Só apareceu medindo à mão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 8. Etapa 6 — Equalização e pedido de compra

> **Antes de começar:** você precisa de uma cotação **aberta** com pelo menos **dois fornecedores que já responderam** (CT-77). Se não tiver, faça primeiro os casos CT-73 a CT-77.

Entre como **Comprador** (`neilma@portoinc.com.br`).

## CT-85 · Chegar na equalização

1. Menu **Cotações** → abra a cotação
2. Clique em **📊 Equalizar e escolher**

**Esperado:** abre a tela **Equalização** com o número da cotação, o título e *"X de Y fornecedores responderam"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-86 · O mapa comparativo

1. Olhe a tabela do meio da tela

**Esperado:**
- Uma linha por item, uma coluna por fornecedor
- O **melhor preço** de cada linha vem destacado, com a etiqueta *melhor preço*
- Os outros mostram quanto estão acima (ex.: **+100%**)
- O cabeçalho de cada coluna diz quantos itens aquele fornecedor está vencendo
- No pé da tabela vêm **frete e outros custos** e o **total fechando tudo com um só**

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-87 · O frete entra na conta da mistura

1. Olhe o cartão **Escolhendo item a item**
2. Olhe o texto pequeno embaixo do valor

**Esperado:** aparece *"N fornecedor(es) · frete somado R$ X"*. O valor do cartão **inclui** o frete de cada fornecedor vencedor.

> É o ponto mais fácil de errar numa planilha: dividir a compra entre três fornecedores significa pagar três fretes. Se o cartão mostrasse só a soma dos itens, a comparação seria injusta.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-88 · Escolher item a item

1. Clique na célula de um fornecedor, num item
2. Clique na célula de **outro** fornecedor, em outro item
3. Olhe o rodapé da tela

**Esperado:** as células ficam marcadas e o rodapé mostra o total escolhido, o frete da combinação e quantos itens ainda faltam. Clicar de novo na mesma célula **desmarca**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-89 · Aceitar todos os melhores preços

1. Clique em **Aceitar todos os melhores preços**

**Esperado:** todas as linhas ficam marcadas no vencedor, e o rodapé mostra *"0 itens faltando"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-90 · As escolhas ficam salvas

1. Clique em **Salvar escolhas**
2. Saia da tela (menu **Cotações**) e volte pela equalização

**Esperado:** as mesmas células continuam marcadas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-91 · Última chamada NÃO revela preço do concorrente

**Este é o caso mais importante desta etapa.**

1. Clique em **📣 Última chamada**
2. Informe um novo prazo e confirme
3. Leia com atenção a mensagem que o sistema mostra

**Esperado:** a mensagem lista **só os códigos e nomes dos itens** em que o fornecedor não está ganhando. Ela **não** traz:

- ❌ o preço do concorrente
- ❌ o nome do concorrente
- ❌ quanto ele precisa baixar

> Se qualquer valor de concorrente aparecer, **pare e avise**. Isso ensina o mercado a alinhar preço e vira problema de lei de concorrência.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-92 · A última chamada reabre a cotação

1. Depois do CT-91, olhe o topo da tela

**Esperado:** a situação volta para **Aberto**, aparece a etiqueta **Rodada 2** e o novo prazo. O link que o fornecedor já tinha continua funcionando (confira reabrindo o link do CT-75).

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-93 · Bloqueio com item sem escolha

1. Desmarque a escolha de um item (clique na célula marcada)
2. Clique em **✅ Gerar pedidos de compra**

**Esperado:** o sistema **recusa** e lista exatamente qual item está sem vencedor. Nenhum pedido é criado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-94 · Gerar os pedidos

1. Marque de novo todos os vencedores e salve
2. Clique em **✅ Gerar pedidos de compra**

**Esperado:** aparece um aviso verde com os números gerados (ex.: **PC-00001 (Marquilip)**). A cotação passa para **Pedidos gerados**.

> Se você dividiu entre dois fornecedores, devem sair **dois** pedidos — um para cada.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-95 · Não gera duas vezes

1. Na mesma tela, tente gerar de novo

**Esperado:** o sistema recusa dizendo que a cotação já foi concluída. Não existe pedido repetido.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-96 · A tela de Pedidos e o PDF

1. Menu **Pedidos**
2. Confira número, fornecedor, origem, itens, total, pagamento e situação
3. Clique em **📄 PDF**

**Esperado:** o arquivo baixa com o nome do pedido. Dentro dele:

- Dados da Porto Inc. e do fornecedor
- Itens com preço, marca e prazo
- Totais com frete
- Condição de pagamento e local de entrega
- Em destaque: **"IMPORTANTE: informe o número PC-xxxxx na nota fiscal e na entrega"**

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-96a · Abrir o pedido

> Esta tela não existia. Havia a lista e o PDF, e mais nada: para ver o que tinha dentro de um pedido era preciso baixar o arquivo. O dono reparou em 27/09/2026.

1. Na linha do pedido, clique em **Abrir**

**Esperado:** a tela do pedido, com o caminho **Início › Pedidos › Pedido de compra** e o **← Voltar para Pedidos** no canto.

2. Olhe os três cartões do topo

**Esperado:** total do pedido, condição de pagamento e prazo de entrega.

3. Olhe o bloco **De onde veio**

**Esperado:** a corrente da compra — *Alguém pediu* **SOL-xxxxx** → *O mercado respondeu* **BID-xxxxx** → *Fechamos com* o fornecedor, este último destacado em azul.

4. Clique no número da solicitação, volte, clique no da cotação

**Esperado:** os dois abrem as telas certas. É a única tela do sistema que fecha esse caminho inteiro.

5. Compare o **total da tela** com o **total do PDF**

**Esperado:** iguais. Os dois saem da mesma função no servidor — se divergirem, é defeito grave: é o mesmo documento, e o fornecedor recebe uma cópia dele.

6. Confira o CNPJ e o WhatsApp em **Para quem vai**

**Esperado:** com máscara — `19.131.243/0001-97` e `(11) 91234-5678`, não os dígitos corridos.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-96b · O menu de ações não fica cortado

1. Na lista de Pedidos, clique no botão **⋮** da linha

**Esperado:** o menu abre **inteiro**, com as três opções legíveis, mesmo passando por cima da borda do cartão.

2. Role a página com o menu aberto

**Esperado:** ele fecha. Está preso à janela; se ficasse aberto, pararia no ar enquanto a linha dele some.

3. Repita com a janela baixa, de modo que o botão fique perto do rodapé

**Esperado:** o menu abre **para cima**, e não para baixo cortado.

> **Por que isto quebrou:** a caixa da tabela tem `overflow-x: auto` para a tabela rolar de lado no celular, e o navegador converte o eixo vertical junto — não existe rolar num eixo e transbordar no outro. O menu saía cortado pela borda do cartão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-97 · Quem não é comprador não entra

1. Saia e entre como **Almoxarife** (`gilson@portoinc.com.br`)
2. Olhe o menu da esquerda
3. Tente abrir `/cotacoes`, `/pedidos` e a equalização digitando no endereço

**Esperado:** o menu dele não mostra **Cotações** nem **Pedidos**, e digitar o endereço na mão dá *"Você não tem acesso a esta tela"*.

> Hoje só **Comprador** e **Administrador** enxergam pedido de compra. Na Etapa 7 o almoxarife vai precisar ver o pedido para conferir o recebimento — ele ganhará acesso **de leitura** por ali, pela tela de recebimento, e não a esta tela de gestão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 9. Etapa 7 — Recebimento no almoxarifado

> **Antes de começar:** você precisa de pelo menos um **pedido de compra** gerado (CT-94). Entre como **Almoxarife** (`gilson@portoinc.com.br`), menos onde estiver indicado outra conta.

## CT-98 · O almoxarife vê a tela certa

1. Entre como Almoxarife
2. Olhe o menu da esquerda

**Esperado:** aparece **Recebimento**. **Não** aparecem Cotações nem Pedidos.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-99 · Achar o pedido digitando só o número

1. Menu **Recebimento**
2. No campo grande, digite apenas `1`
3. Clique em **Abrir conferência**

**Esperado:** abre a conferência de **PC-00001**. Repita com `PC-00001` e `00001` — os três têm que funcionar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-100 · Número que não existe

1. Digite `PC-99999` e confirme

**Esperado:** mensagem clara — *"Não existe pedido com o número PC-99999"*. Nada de tela branca ou erro técnico.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-101 · Texto que não é número

1. Digite `abacaxi` e confirme

**Esperado:** *"Não entendi esse número. Use o formato PC-00001, como está no pedido."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-102 · A lista de pedidos esperando entrega

1. Volte para **Recebimento**
2. Olhe a tabela **Esperando entrega**

**Esperado:** cada linha mostra pedido, fornecedor, obra, quantos itens ainda faltam chegar e a situação. O botão **Conferir** abre a mesma tela do CT-99.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-103 · Bipar o material

1. Abra a conferência de um pedido
2. Copie o código que aparece em negrito na primeira linha (ex.: `00068`)
3. Cole no campo **Bipar ou digitar o código do material** e confirme

**Esperado:** a linha daquele item fica **destacada** e a quantidade **Recebido agora** vem preenchida com o saldo.

> Se você tiver um leitor de código de barras USB, teste com ele: o leitor digita e dá Enter sozinho.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-104 · Bipar material de outro pedido

1. No mesmo campo, digite um código qualquer que não esteja na tabela

**Esperado:** *"Esse código não está neste pedido."* Nada é preenchido.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-105 · Não recebe mais do que o saldo

1. Numa linha com saldo 40, escreva **45** em **Recebido agora**
2. Clique em **Registrar recebimento**

**Esperado:** recusa dizendo *"o saldo é de 40 ..., e você informou 45"*. Nada é gravado.

> Receber a mais significa pagar mais do que foi aprovado. Quem resolve isso é o comprador.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-106 · Ressalva sem motivo é recusada

1. Numa linha, escreva uma quantidade
2. Em **Como chegou**, escolha **Aceito com ressalva**
3. Deixe o motivo em branco e registre

**Esperado:** recusa pedindo o motivo. Preencha o motivo e registre de novo: agora vai.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-107 · Entrega parcial

1. Numa linha com saldo 40, escreva **10**
2. Deixe as outras linhas em branco
3. Registre

**Esperado:**
- Aviso verde com o número **REC-xxxxx** e uma frase do tipo *"1 item conforme. Ainda faltam chegar N itens."*
- A situação do pedido passa para **Recebido em parte**
- Ao reabrir, **Já recebido** = 10 e **Saldo** = 30

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-108 · Devolução não baixa o saldo

**Este é o caso mais importante da etapa.**

1. Numa linha com saldo 30, escreva **Recebido agora = 7** e **Devolvido = 3**
2. Marque **Aceito com ressalva** e escreva o motivo
3. Registre e reabra o pedido

**Esperado:** **Já recebido** subiu 7 (não 10) e o **Saldo** caiu só 7.

> Os 3 devolvidos continuam sendo dívida do fornecedor. Se o saldo tivesse caído 10, o almoxarifado ficaria com 3 unidades a menos e ninguém perceberia.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-109 · Preencher com o saldo

1. Abra um pedido com saldo em vários itens
2. Clique em **Preencher com o saldo**

**Esperado:** todas as linhas com saldo ficam preenchidas de uma vez. **Limpar** desfaz.

3. Leia a frase abaixo dos dois botões

**Esperado:** *"Só preenche os campos acima. Você confere e registra no fim da página."*

4. Olhe a contagem no canto esquerdo do mesmo rodapé

**Esperado:** com item marcado, ela avisa que **nada foi registrado ainda** e manda descer até "Registrar recebimento".

5. Confira que **nada** foi gravado: saia da tela sem registrar e volte

**Esperado:** o saldo continua o mesmo. O botão só preenche.

> **Por que mudou de nome:** chamava-se *"Recebi tudo que falta"* — frase na primeira pessoa e no passado, que soa como declaração. O dono digitou 10 num item cujo saldo era 10, clicou, e nada mudou na tela (o campo já tinha 10). Ele perguntou para que servia o botão. Botão tem de dizer o que faz.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-110 · O pedido fecha quando tudo chega

1. Termine de receber todo o saldo de um pedido
2. Registre

**Esperado:**
- Frase *"Pedido recebido por inteiro."*
- Situação **Recebido**
- Ao reabrir: *"Este pedido já foi recebido por inteiro"*, com os campos desligados e o formulário da entrega escondido

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-111 · Nada marcado

1. Abra um pedido e clique em **Registrar recebimento** sem preencher nada

**Esperado:** *"Informe o que chegou em pelo menos um item."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-112 · Histórico da entrega

1. Volte para **Recebimento**
2. Olhe **Últimas entregas conferidas**

**Esperado:** a entrega do CT-108 aparece com o número REC, o pedido, a nota fiscal, quem conferiu, o almoxarifado e o selo **Com ressalva**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-113 · Marcar o pedido como enviado

**Conta:** neilma@portoinc.com.br (compradora)

1. Menu **Pedidos**
2. Num pedido em **Rascunho**, clique em **Marcar como enviado**

**Esperado:** aviso verde e a situação muda para **Enviado**. O botão some. Clicar de novo não é possível.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-114 · Pedido em rascunho não trava a entrega

1. Como Almoxarife, abra um pedido que ainda esteja em **Rascunho**
2. Receba normalmente

**Esperado:** recebe sem reclamar.

> Travar a entrega porque o comprador esqueceu de clicar um botão faria o caminhão esperar no portão — e o almoxarife não tem como resolver isso.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-115 · A conferência no celular

1. Abra a conferência com **F12** em modo celular (ou no telefone de verdade)

**Esperado:** a tabela rola para o lado sem quebrar a página, os campos de quantidade continuam clicáveis e o botão **Registrar recebimento** fica alcançável.

> É a tela com maior chance de ser usada no celular, em pé, no portão da obra.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 10. Etapa 8 — Estoque

> **Antes de começar:** você precisa de pelo menos uma entrega conferida (CT-107 ou CT-110). Entre como **Almoxarife** (`gilson@portoinc.com.br`), menos onde estiver indicada outra conta.

## CT-116 · O recebimento virou saldo sozinho

1. Menu **Estoque**
2. Escolha o almoxarifado da obra onde você recebeu material

**Esperado:** o material conferido aparece com saldo igual ao que você recebeu, e o **custo médio** é o preço que estava no pedido de compra. Ninguém precisou lançar nada à mão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-117 · O que foi devolvido não entrou

1. Olhe um material que você devolveu no CT-108
2. Compare o saldo com o que foi **aceito** (não com o que chegou no caminhão)

**Esperado:** só o que foi aceito virou saldo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-118 · Os quatro cartões

1. Olhe o alto da tela

**Esperado:** itens em estoque, valor parado (pelo custo médio), abaixo do mínimo e zerados. Os números batem com a tabela abaixo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-119 · Retirar material

1. Numa linha com saldo, clique em **Retirar**
2. Quantidade: metade do saldo
3. Para quem: `Equipe da laje do 3º pavimento`
4. **Registrar**

**Esperado:** aviso verde com o número **MOV-xxxxx** e a frase *"Saíram N ... Saldo agora: M"*. A tabela atualiza sozinha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-120 · Retirada sem destino é recusada

1. Repita o CT-119 deixando o destino em branco

**Esperado:** *"Informe para quem ou para qual frente de serviço o material está saindo."*

> Material que sai sem dono vira buraco no estoque.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-121 · Não dá para tirar o que não existe

1. Tente retirar uma quantidade maior que o saldo

**Esperado:** *"o almoxarifado tem N e você pediu M"*. Nada é gravado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-122 · A retirada não mexe no custo médio

1. Anote o custo médio antes da retirada do CT-119
2. Compare depois

**Esperado:** o mesmo valor. Sai material, não muda o preço do que ficou.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-123 · Contagem de inventário

1. Numa linha, clique em **Contar**
2. Escreva **o que você contou** (ex.: saldo menos 2)
3. Explique: `Contagem do mês: dois itens danificados, descartados`
4. **Registrar**

**Esperado:** mensagem *"Ajuste de 2 ... a menos. Saldo agora: N"*, e o saldo vira exatamente o que você contou.

> Você informa a contagem, não a diferença. A conta é do sistema.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-124 · Ajuste sem explicação é recusado

1. Repita o CT-123 sem escrever o motivo

**Esperado:** *"Explique o que a contagem encontrou. Ajuste sem motivo não se sustenta."*

> É o único lugar em que o saldo muda sem material entrar ou sair. Sem motivo escrito, vira porta dos fundos.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-125 · Contagem que bate não vira movimento

1. Em **Contar**, escreva exatamente o saldo atual e registre

**Esperado:** *"A contagem bateu com o saldo: não há ajuste a fazer."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-126 · Transferir entre almoxarifados

1. Clique em **Retirar** e mude a opção para **Transferir para outro almoxarifado**
2. Escolha o destino e uma quantidade
3. **Registrar**
4. Troque o filtro **Almoxarifado** para o de destino

**Esperado:** a quantidade saiu de um e entrou no outro, **com o mesmo custo médio**.

> Mudar de prateleira não deixa o material mais caro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-127 · Aviso de ponto de pedido

1. Retire material até o saldo ficar abaixo do mínimo do cadastro
2. Volte para o **Estoque**

**Esperado:** quadro amarelo no alto — *"1 material chegou no ponto de pedido"* — com a frase *"Restam N ..., mínimo é M"*. A linha da tabela ganha o selo **Repor**.

> Se o material não tiver ponto de pedido cadastrado, ele nunca alerta. Cadastre em **Cadastros → Materiais**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-128 · Montar a reposição

1. Clique em **Montar reposição**

**Esperado:** tabela com *tem / mínimo / comprar*. A quantidade sugerida repõe até o **dobro do mínimo**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-129 · Abrir a solicitação de reposição

1. Clique em **Abrir solicitação com N itens**

**Esperado:** o sistema cria a solicitação já preenchida, na obra daquele almoxarifado, e abre a tela dela. A justificativa menciona o ponto de pedido.

> A partir daqui é o caminho de sempre: enviar → aprovar → cotar → pedido → recebimento → de volta para o estoque.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-130 · O extrato conta a história

1. Clique em **Ver extrato**

**Esperado:** todos os movimentos do mais recente para o mais antigo, cada um com número **MOV-xxxxx**, sinal (**+** ou **−**), **saldo depois** e quem fez. As entradas antigas aparecem como *"Saldo inicial"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-131 · Nada é apagado

1. Procure no sistema um botão para apagar ou editar um movimento

**Esperado:** **não existe**. O conserto de um erro é sempre um movimento novo.

> É isso que permite explicar qualquer saldo meses depois.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-132 · Quem vê e quem mexe

1. Entre como **Engenheiro** (`engenheiro@portoinc.com.br`) e abra o **Estoque**
2. Olhe as linhas da tabela

**Esperado:** ele **vê** o saldo, mas **não aparecem** os botões *Retirar* e *Contar*.

3. Entre como **Comprador** (`neilma@portoinc.com.br`) e abra o **Estoque**

**Esperado:** também vê — precisa saber o que já existe antes de comprar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-133 · O estoque no celular

1. Abra a tela de estoque em modo celular (**F12** → ícone de celular)

**Esperado:** a tabela rola para o lado sem quebrar a página; o painel de retirada fica utilizável.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 11. Etapa 9 — Fiscal e contas a pagar

> **Antes de começar:** você precisa de pelo menos um **pedido de compra** (CT-94). Entre como **Compradora** (`neilma@portoinc.com.br`), menos onde estiver indicada outra conta.

## CT-134 · A tela de notas fiscais

1. Menu **Financeiro** → **Notas fiscais**

**Esperado:** aparecem os botões **Lançar nota**, **Importar XML** e **Ver contas a pagar**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-135 · Lançar uma nota que bate com o pedido

1. **Lançar nota**
2. Escolha um pedido na lista — repare que ela mostra *"falta R$ x"*
3. Número: `1001` · Série: `1` · Emitida em: hoje
4. Valor total: **exatamente o valor que falta no pedido**
5. **Lançar nota**

**Esperado:** *"Nota conferida: bate com o pedido. Já pode gerar as parcelas."* e o selo **Conferida**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-136 · Nota acima do pedido vira pendência

1. Repita o CT-135 com número `1002` e valor **R$ 500 acima** do que falta

**Esperado:** selo **Com pendência** e a frase *"A nota está R$ 500,00 acima do que falta no pedido PC-xxxxx"*.

> O sistema não impede de lançar — às vezes a diferença tem explicação. Ele só não deixa passar despercebido.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-136a · Corrigir o valor errado, sem cancelar

> Continua do CT-136, com a nota pendente na tela.

1. Na linha da nota, clique em **✏️ Corrigir**

**Esperado:** o mesmo formulário abre com o título **"Corrigir a nota 1002"** e **tudo preenchido** — número, série, data, valor e frete.

2. Troque o valor total para o que bate com o pedido e salve

**Esperado:** *"Nota corrigida: agora bate com o pedido. Já pode gerar as parcelas."* e o selo vira **Conferida**. A pendência **sumiu**.

3. Gere as parcelas e tente **Corrigir** de novo

**Esperado:** o botão **não aparece mais**. Nota que virou conta a pagar não se edita — mudar o valor por baixo de uma parcela em aberto faria a conta divergir da nota em silêncio. Aí o caminho é cancelar e relançar, que deixa registro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-136b · Nota cancelada devolve o número

> **Este era um beco sem saída.** Em 27/09/2026 o dono lançou uma nota com o valor errado, cancelou para corrigir, e descobriu que não dava para fazer mais nada: relançar o número era recusado, editar não existia, e nota fiscal ninguém apaga. O número tinha morrido por causa de um erro de digitação.

1. Lance uma nota com número `2001` e um valor qualquer
2. **Cancele** essa nota
3. Lance **outra** nota com o **mesmo número `2001`** e série `1`, no mesmo fornecedor

**Esperado:** entra normalmente. Cancelada não segura mais o número.

4. Agora tente lançar uma **terceira** com o mesmo `2001`, sem cancelar a segunda

**Esperado:** **recusada**. Duas notas *vivas* com o mesmo número continuam proibidas — essa é a regra fiscal de verdade, e ela não foi afrouxada.

5. Olhe a lista

**Esperado:** a cancelada **não aparece**, e o filtro **Situação** na barra está em *"Em aberto"*. Troque para **Cancelada**: ela aparece.

> Nota fiscal **não é apagada** — mesmo errada, o registro de que existiu e foi cancelada vale numa auditoria. Ela só sai da frente.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-137 · Nota abaixo é entrega parcial

1. Lance uma nota com valor bem menor que o pedido

**Esperado:** *"A nota está R$ x abaixo do pedido. É entrega parcial? Se for, está certo."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-138 · A mesma nota não entra duas vezes

1. Tente lançar de novo o mesmo número e série do CT-135, no mesmo fornecedor

**Esperado:** *"Este fornecedor já tem a nota 1001 série 1 lançada."*

> Vale para notas **vivas**. Se a de número 1001 estivesse cancelada, o número voltaria a valer — ver CT-136b.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-139 · A chave de acesso se confere sozinha

1. Lance uma nota informando uma **chave de 44 dígitos inventada** (ex.: 44 vezes o dígito 1)

**Esperado:** pendência *"A chave de acesso não passa na conferência dos 44 dígitos"*.

> A chave tem um dígito verificador no fim. O sistema recalcula e compara — sem consultar a SEFAZ.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-140 · Importar o XML da nota

**Este é o caso mais importante da etapa.**

1. Peça ao fornecedor (ou gere) um arquivo **XML de NF-e**
2. Clique em **Importar XML** e escolha o arquivo

**Esperado:**
- O formulário abre preenchido: número, série, data, valor, frete e **chave de 44 dígitos**
- Os **itens da nota** aparecem numa tabela abaixo
- A lista de pedidos mostra **só os do fornecedor daquela nota**
- Aviso: *"XML lido: confira os dados e escolha o pedido antes de lançar."*

> O XML **não grava nada sozinho**. Ele preenche; quem lança é você.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-141 · Arquivo que não é nota

1. **Importar XML** escolhendo qualquer arquivo que não seja NF-e

**Esperado:** *"Este arquivo não parece ser o XML de uma nota fiscal."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-142 · Gerar as parcelas

1. Na linha de uma nota, clique em **Gerar parcelas**

**Esperado:** mensagem com a condição vinda da cotação, ex.: *"4 parcelas geradas: 30% de entrada + 3x a cada 30 dias."* A coluna **Parcelas** passa a mostrar `4x`.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-143 · A soma das parcelas bate com a nota

1. Vá em **Contas a pagar** e some os valores das parcelas daquela nota

**Esperado:** a soma dá **exatamente** o valor da nota. A última parcela costuma ter um centavo de diferença das outras — é ela que fecha a conta.

> Sem isso sobra ou falta centavo, e é sempre o financeiro que descobre.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-144 · Não gera parcelas duas vezes

1. Clique em **Gerar parcelas** de novo na mesma nota

**Esperado:** *"As parcelas desta nota já foram geradas."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-145 · Os quatro cartões do financeiro

1. Menu **Financeiro**

**Esperado:** Vencidas, Vencem em 7 dias, Total em aberto e Pago no mês. Os valores batem com a tabela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-146 · Cada parcela diz em que pé está

1. Olhe a coluna **Vencimento**

**Esperado:** abaixo da data, uma frase em português: *vence hoje*, *vence em 30 dias*, *venceu há 3 dias*. A entrada vence **no dia da nota**.

2. **Depois das 21h**, abra a tela de novo e confira uma parcela que vence **amanhã**

**Esperado:** continua dizendo *vence amanhã*.

> **Por que testar à noite:** o servidor roda em UTC, que às 21h de Brasília já virou o dia seguinte. A conta que vencia amanhã aparecia como *vence hoje* — alarme falso toda noite, justamente na tela que existe para avisar prazo. Corrigido em 27/09/2026; a contagem agora usa o calendário de Brasília, dito em voz alta no código.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-147 · Dar baixa

1. Clique em **Dar baixa** numa parcela
2. Confirme a data, o valor e a forma de pagamento (ex.: PIX)

**Esperado:** aviso *"CP-xxxxx baixada: R$ x"*, selo **Paga** e o cartão **Pago no mês** sobe.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-148 · Não paga duas vezes

1. Tente dar baixa de novo na mesma parcela

**Esperado:** o botão **Dar baixa** nem aparece mais para parcelas pagas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-149 · Filtros

1. Troque **Mostrar** para **Vencidas** e depois para **Vencem em 7 dias**
2. Troque **Situação** para **Pagas**

**Esperado:** a tabela responde a cada filtro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-150 · Baixar as contas em PDF e em Word

1. Clique em **↓ Baixar contas**
2. Escolha **PDF** e abra o arquivo
3. Clique de novo e escolha **Word (.docx)**; abra no Word

**Esperado:** nos dois, a tabela traz título, fornecedor, CNPJ, nota, pedido, parcela, valor, vencimento, situação e pagamento. Os acentos aparecem certos e os valores vêm como `R$ 1.234,56`. No alto, o total em aberto.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-151 · Cancelar nota com parcela paga

1. Numa nota que já teve parcela paga, clique em **Cancelar**

**Esperado:** *"Esta nota tem parcela já paga. Cancelar apagaria um pagamento real."*

> Se o pagamento foi errado, o conserto é no banco, não no sistema.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-152 · Cancelar nota sem pagamento

1. Numa nota com parcelas **todas em aberto**, clique em **Cancelar**

**Esperado:** *"Nota cancelada e parcelas em aberto canceladas junto."* A nota fica com o selo **Cancelada**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-153 · Quem entra no financeiro

1. Entre como **Almoxarife** (`gilson@portoinc.com.br`) e tente abrir `/financeiro`
2. Entre como **Fundador** (`washington@portoinc.com.br`) e abra o **Financeiro**

**Esperado:** o almoxarife é barrado; o fundador **vê** as contas, mas **não tem** os botões de lançar nota nem de dar baixa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-154 · O financeiro no celular

1. Abra as duas telas em modo celular

**Esperado:** as tabelas rolam para o lado sem quebrar a página; os botões continuam alcançáveis.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 12. Painel financeiro — indicadores e gráficos

> **Entre como Administrador** (`admin@portoinc.com.br`) ou outra pessoa com acesso ao Financeiro.

## CT-172 · Os quatro indicadores de gestão

1. Menu **Financeiro**
2. Olhe a linha abaixo dos quatro cartões grandes

**Esperado:** prazo médio negociado (em dias), maior parcela em aberto, parcela média e notas lançadas no mês.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-173 · A frase do próximo vencimento

1. Olhe embaixo do cartão **Vencem em 7 dias**

**Esperado:** uma frase em português, conforme o caso: *A próxima vence hoje*, *A próxima vence amanhã*, *A próxima vence em N dias* ou *A mais antiga venceu há N dias*.

> Nunca deve aparecer número negativo, como "vence em -15 dias".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-174 · O gráfico de fluxo de caixa

1. Olhe o gráfico **Fluxo de caixa**

**Esperado:**
- 12 colunas: 3 meses para trás e 8 para frente
- O mês atual aparece destacado
- As colunas empilham verde (pago), vermelho (vencido) e amarelo (a vencer)
- Abaixo de cada mês, o total abreviado (R$ 1,4k)
- As colunas **crescem de baixo para cima** ao abrir a tela

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-175 · O pago conta no mês em que saiu

1. Dê baixa numa parcela informando uma data de **mês passado**
2. Volte ao painel

**Esperado:** o valor aparece na coluna do **mês do pagamento**, não na do vencimento.

> É isso que faz o gráfico ser fluxo de caixa e não agenda de vencimentos.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-176 · A rosca da carteira

1. Olhe **Composição da carteira**

**Esperado:** rosca dividida em vencidas, vencem em 7 dias, a vencer depois e já pagas. Ao lado, a lista com valor e percentual de cada faixa. Os percentuais somam 100%.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-177 · O medidor de pontualidade

1. Olhe **Pontualidade**

**Esperado:** meia-lua preenchida com o percentual no meio. Verde acima de 90%, amarelo entre 70% e 89%, vermelho abaixo de 70%.

2. Dê baixa numa parcela com data **depois** do vencimento e volte

**Esperado:** o percentual cai.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-178 · Os rankings

1. Olhe **Para quem a Porto Inc. mais deve** e **Custo por obra**

**Esperado:** nome em cima, barra embaixo com duas cores (em aberto e já pago) e o total à direita. Ordenado do maior para o menor.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-179 · Os filtros não mexem nos gráficos

1. Mude **Mostrar** para **Vencidas**

**Esperado:** a tabela de parcelas filtra, mas os gráficos continuam mostrando o quadro completo.

> Filtro é para procurar uma parcela. Gráfico é para entender o todo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-183 · Dados ao passar o mouse (PC)

1. No computador, passe o mouse por uma **coluna do fluxo de caixa**

**Esperado:** aparece uma caixinha acima do ponteiro com o mês, o valor **pago**, o **vencido**, o **a vencer** e o total — cada um com o quadradinho da sua cor.

2. Repita nos **indicadores**, nas **fatias da rosca**, nas **barras dos rankings** e no **medidor**

**Esperado:** todos mostram os números por trás. Nos indicadores, a caixinha traz também a explicação do que o número significa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-184 · A dica some ao tirar o mouse

1. Passe o mouse por um gráfico e tire

**Esperado:** a caixinha some na hora. Ela **não** deve piscar nem ficar presa na tela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-185 · Dados ao tocar (celular)

1. No celular (ou com **F12** em modo celular), **toque** numa barra do fluxo

**Esperado:** a caixinha aparece com os mesmos números do computador.

2. Toque em qualquer outro lugar da tela

**Esperado:** a caixinha some.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-186 · Dados pelo teclado

1. Aperte **Tab** até chegar num gráfico

**Esperado:** a caixinha aparece sozinha ao elemento receber o foco, e some ao sair.

> Quem não usa mouse também precisa dos números.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-187 · Tudo alinhado

1. Olhe os oito cartões do alto da tela

**Esperado:** todos com a **mesma altura**, e os valores (R$ 798,00, 45 dias...) na **mesma linha**, mesmo quando um rótulo ocupa duas linhas e outro só uma.

2. Olhe o gráfico de fluxo: cada barra tem que ficar **exatamente em cima** do seu mês.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-180 · Movimento reduzido

1. No Windows: **Configurações → Acessibilidade → Efeitos visuais → Efeitos de animação: Desativado**
2. Recarregue o painel

**Esperado:** os gráficos aparecem **prontos**, sem animação nenhuma.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-181 · Os gráficos no leitor de tela

1. Com o leitor de tela ligado (Narrador: **Ctrl+Win+Enter**), navegue pelo painel

**Esperado:** cada gráfico é lido como uma **tabela** com os mesmos números — mês a mês, faixa a faixa, fornecedor a fornecedor.

> Gráfico bonito que exclui gente não serve.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-182 · O painel sem dado nenhum

1. Num sistema recém-instalado, sem notas lançadas, abra o **Financeiro**

**Esperado:** em vez de gráficos vazios, a mensagem *"Ainda não há parcelas para analisar"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 13. Etapa 10 — WhatsApp

> **Entre como Administrador** (`admin@portoinc.com.br`). Só ele tem acesso a esta tela.

## CT-155 · A trava aparece antes de tudo

1. Menu **WhatsApp**

**Esperado:** o primeiro bloco da tela é o aviso amarelo — *"Modo de teste ligado: só sai mensagem para número autorizado"* — **acima** dos botões de conectar.

> A ordem é proposital: entender a trava vem antes de poder usar o botão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-156 · Bloqueio de número fora da lista

**Este é o caso mais importante da etapa.**

1. Clique em **Conectar** (no modo simulado conecta na hora)
2. Em **Enviar uma mensagem de teste**, use um número **que não esteja na lista**
3. **Enviar teste**

**Esperado:** recusa com *"O número 55••••••••21 não está na lista de autorizados"*. **Nada sai.**

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-157 · O bloqueio fica registrado

1. Role até **Histórico de envios**

**Esperado:** a tentativa do CT-156 aparece com o selo **Bloqueada** e o número mascarado.

> Se alguém tentou mandar para fora da lista, isso precisa ficar registrado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-158 · Liberar o seu número

1. Em **Números autorizados**, informe **o seu celular** (com DDI e DDD) e um nome
2. **Liberar número**

**Esperado:** aparece na tabela com o número **mascarado**. O cartão **Autorizados** sobe para 1.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-159 · Agora o envio passa

1. Repita o CT-156 com o número que você acabou de liberar

**Esperado:** *"Mensagem enviada para 55••••••••21."* e o selo **Enviada** no histórico.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-160 · Tirar da lista bloqueia de novo

1. **Tirar da lista** no número
2. Tente enviar outra vez

**Esperado:** volta a ser bloqueado imediatamente.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-161 · O número nunca aparece inteiro

1. Olhe a tabela de autorizados e o histórico

**Esperado:** sempre mascarado (`5511•••••••21`). Em nenhum lugar da tela aparece o número completo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-162 · Número repetido e número inválido

1. Tente liberar o mesmo número duas vezes
2. Tente liberar `123`

**Esperado:** *"Este número já está na lista."* e *"Número com 3 dígitos não parece válido."*

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-163 · Só o administrador entra

1. Entre como **Compradora** (`neilma@portoinc.com.br`)
2. Olhe o menu e tente abrir `/admin/whatsapp`

**Esperado:** o menu não mostra **WhatsApp** e o endereço dá *"Você não tem acesso a esta tela"*.

> Ela **pode** enviar convite e pedido pelas telas de Cotação e Pedidos — o que ela não pode é mexer na conexão e na lista.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-164 · Convites de cotação

**Conta:** neilma@portoinc.com.br

1. Abra uma cotação **aberta**
2. Clique em **💬 Enviar convites pelo WhatsApp**

**Esperado:** mensagem do tipo *"2 de 2 convite(s) enviado(s)"*, ou o aviso de quantos foram bloqueados. No histórico (visto pelo administrador) cada envio aparece com o contexto **cotacao** e a referência **BID-xxxxx**.

> Com os fornecedores de demonstração, o esperado é **bloqueado** — os telefones deles são fictícios e não estão na lista.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-165 · Pedido de compra com PDF

1. Menu **Pedidos** → botão **💬 WhatsApp** num pedido

**Esperado:** o histórico registra o envio com o selo **anexo** e a referência **PC-xxxxx**. Se o envio der certo e o pedido estiver em rascunho, ele passa para **Enviado** sozinho.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-166 · Conexão de verdade (com o Baileys)

> **Precisa de um celular e de um chip de testes.** Não use o número da empresa.

1. No arquivo `.env`, mude para `WHATSAPP_ADAPTER=baileys`
2. `docker compose up -d api` e espere subir
3. Menu **WhatsApp** → **Conectar**
4. Espere o **QR Code** aparecer (alguns segundos)
5. No celular: **WhatsApp › Aparelhos conectados › Conectar um aparelho** e escaneie

**Esperado:** a situação passa por *QR Code pronto* → *Autenticando* → **Conectado**, e o número aparece mascarado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-167 · Mensagem de verdade no seu celular

1. Com o WhatsApp conectado, libere **o seu número** na lista
2. Envie uma mensagem de teste para ele

**Esperado:** a mensagem chega no seu celular.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-168 · Reiniciar não pede QR de novo

1. Com o WhatsApp conectado: `docker compose restart api`
2. Espere e abra a tela de novo

**Esperado:** volta **Conectado** sozinho, **sem** pedir QR. A sessão ficou guardada.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-169 · Desconectar apaga a sessão

1. Clique em **Desconectar**
2. Clique em **Conectar** de novo

**Esperado:** aparece um **QR Code novo** — a sessão anterior foi apagada de propósito.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-170 · O QR nunca aparece no log

1. Com o QR na tela, rode `docker compose logs api | grep -i qr`

**Esperado:** **nada**. O QR é credencial e fica só na memória.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-171 · Voltar para o modo simulado

1. No `.env`, volte para `WHATSAPP_ADAPTER=mock`
2. `docker compose up -d api`

**Esperado:** a tela volta a mostrar **Simulado** e nada mais sai para fora.

> Faça isso ao terminar os testes. É a regra combinada: o sistema fica em modo simulado por padrão.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 14. Etapa 11 — Relatórios

> **Entre como Administrador** (`admin@portoinc.com.br`), **Comprador** (`andre@portoinc.com.br`) ou **Gestor de obra** (`bras@portoinc.com.br`). O **Almoxarife** (`gilson@`) **não** deve ver esta tela.

> **Antes de começar:** o relatório só mostra alguma coisa se houver histórico. Se o sistema estiver recém-instalado, rode `docker compose exec api npx tsx prisma/seed-historico.ts` para criar 13 compras espalhadas nos últimos 10 meses.

## CT-188 · Quem pode entrar

1. Entre como **Almoxarife** (`gilson@portoinc.com.br`)
2. Olhe o menu da esquerda
3. Digite `/relatorios` direto na barra de endereço

**Esperado:** **Relatórios** não aparece no menu, e forçar o endereço mostra a tela de "sem permissão" — não os números.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-189 · As cinco abas

1. Entre como **Administrador** e abra **Relatórios**
2. Clique em cada aba

**Esperado:** cinco abas — Orçamento, Economia, Fornecedores, Tempos, Consumo. Cada uma mostra, logo abaixo, **a pergunta que responde**. A aba ativa fica com o texto e o traço azuis.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-190 · A aba fica no endereço

1. Abra a aba **Fornecedores**
2. Olhe a barra de endereço
3. Copie o endereço, abra uma aba nova do navegador e cole

**Esperado:** o endereço vira `/relatorios?ver=fornecedores`, e colar em outra aba abre **direto em Fornecedores** — não no Orçamento.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-191 · O orçamento bate com a obra escolhida

1. Aba **Orçamento**
2. Troque a obra no seletor de cima

**Esperado:** os quatro números e a tabela mudam junto. O nome da obra escolhida é o que está no seletor.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-192 · Previsto, comprado e saldo fecham

1. Aba **Orçamento**, obra **OB-001**
2. Pegue uma linha da tabela e faça a conta na calculadora: `previsto − comprado`

**Esperado:** o resultado é exatamente o **saldo** mostrado. E `consumo` é `comprado ÷ previsto`.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-193 · O alerta começa em 80%, não no estouro

1. Aba **Orçamento**
2. Procure uma linha com consumo entre **80% e 100%**

**Esperado:** ela aparece como **⚠ Atenção**, com fundo amarelado — **antes** de estourar. Linha acima de 100% aparece como **✕ Estourou**, em vermelho, e o saldo fica negativo.

> Se todas as linhas estiverem folgadas, a obra OB-001 do histórico de demonstração tem uma linha estourada (Arame recozido) e uma em atenção (Cal hidratada).

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-194 · Compra sem apontamento aparece, não some

1. Aba **Orçamento**, obra **OB-001**
2. Olhe o aviso amarelo acima da tabela e a **última linha** da tabela

**Esperado:** o aviso diz quanto foi comprado **sem apontamento no orçamento**, e a última linha — `(sem linha)` — repete esse valor. Somando a coluna "Comprado" da tabela inteira, dá o mesmo que o cartão **Já comprado**.

> Se o aviso não aparecer, é porque toda compra dessa obra foi apontada. É o cenário desejado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-195 · Economia e ganho na disputa são coisas diferentes

1. Aba **Economia**
2. Compare os cartões **Economia** e **Ganho na disputa**

**Esperado:** são números diferentes. Economia compara com o **estimado** pelo solicitante; ganho na disputa compara com a **proposta mais cara** da mesma cotação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-196 · Cotação que fechou acima do estimado

1. Aba **Economia**
2. Procure uma linha com economia negativa (o histórico de demonstração tem algumas)

**Esperado:** o valor aparece com **sinal de menos e em vermelho**. A porcentagem abaixo dele também é negativa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-197 · Quem não respondeu derruba a taxa

1. Aba **Economia**
2. Olhe a coluna **Respostas** de cada cotação

**Esperado:** mostra "X de Y" e a porcentagem embaixo. Cotação com 1 resposta de 2 convidados aparece como 50%.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-198 · O fornecedor é medido pelo prazo que ELE prometeu

1. Aba **Fornecedores**
2. Ache um fornecedor com pontualidade abaixo de 100% (no histórico de demonstração, a Hidromax)
3. Vá em **Pedidos**, abra um pedido dele e veja o prazo de entrega combinado
4. Vá em **Recebimento** e veja a data em que a carga foi conferida

**Esperado:** a diferença entre a saída do pedido e o recebimento é maior que o prazo prometido — e é por isso que a pontualidade caiu.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-199 · Com poucas entregas não há veredito

1. Aba **Fornecedores**
2. Ache um fornecedor com **1 ou 2** entregas
3. Leia a coluna **Leitura**

**Esperado:** a frase é *"Só N entrega(s) até agora — pouco para concluir"* — **não** um elogio nem uma acusação. As colunas de pontualidade e qualidade continuam mostrando os números.

> Esse é o ponto do teste: uma ressalva isolada não pode virar *"chega com problema com frequência"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-199a · Entrega é CAMINHÃO, não item

> **Este defeito passou por todo mundo até 28/09/2026**, quando o dono leu o PDF e desconfiou do número.

1. Escolha um pedido com **dois ou mais itens**
2. Receba tudo de uma vez, num recebimento só
3. Aba **Fornecedores**, coluna **Entregas**

**Esperado:** **1**. Um caminhão chegou, ainda que com vários itens dentro.

4. Faça outro pedido, receba **metade** de um item, e depois o saldo em outro recebimento

**Esperado:** **2** entregas — não 3, mesmo tendo 3 linhas de material conferidas.

5. Leia a coluna **Leitura** desse fornecedor

**Esperado:** *"Só 2 entregas até agora — pouco para concluir."*

> **Por que importa:** o relatório contava linhas de item. Um pedido entregue em dois caminhões dava "3 entregas" — e 3 é justamente o limiar a partir do qual o sistema se permite opinar. A trava que existe para ele não julgar com pouco dado foi furada por um número que não era de entrega, e o relatório escreveu *"Cumpre prazo e entrega certo"* sobre uma compra única. Um comprador leria isso como histórico.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-199b · O frete aparece no dinheiro

> Nenhum relatório enxergava o frete: o PC-00001 custou R$ 3.000 e todos diziam R$ 2.900.

1. Aba **Orçado × realizado**

**Esperado:** uma linha **(frete)** no fim da tabela, com o frete e os outros custos dos pedidos da obra, e o **Já comprado** incluindo esse valor.

2. Aba **Fornecedores**, coluna **Comprado**

**Esperado:** o valor inclui o frete. É dinheiro que foi para aquele fornecedor.

3. Aba **Economia**, campo **Fechado**

**Esperado:** o desembolso real, com frete. E o **Ganho na disputa** compara com a proposta mais cara **incluindo o frete dela** — era ali que a diferença estava na BID-00001, com R$ 1,00 contra R$ 100,00.

4. Aba **Consumo**

**Esperado:** o rótulo diz **Total em materiais**, e não "Total comprado" — esta tabela é por família, e frete não tem família. O número é menor que o do orçado × realizado, de propósito.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-200 · Fornecedor convidado que nunca entregou

1. Aba **Fornecedores**
2. Ache um fornecedor com pedidos = 0

**Esperado:** pontualidade e qualidade aparecem como **—** (traço), não como 100%. A leitura diz *"Convidado, mas ainda não entregou nada"*.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-201 · O gargalo é apontado

1. Aba **Tempos**
2. Olhe o cartão **Etapa mais demorada** e a lista abaixo

**Esperado:** a etapa nomeada no cartão é a mesma que aparece com a **barra laranja** na lista — a mais comprida.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-202 · Só conta quem já passou

1. Aba **Tempos**
2. Compare a amostra de cada etapa (o texto "média de N solicitações")

**Esperado:** as etapas do começo têm amostra **maior ou igual** às do fim. Entrega tem a menor amostra, porque nem toda compra já chegou.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-203 · Filtrar por obra muda os tempos

1. Aba **Tempos**
2. Troque de "Todas as obras" para uma obra específica

**Esperado:** o número de solicitações no período cai, e as médias podem mudar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-204 · A rosca fecha 100%

1. Aba **Consumo**
2. Some as porcentagens da lista ao lado do anel

**Esperado:** dá 100% (ou 99,9/100,1 por arredondamento). Quando há mais de quatro famílias, a última fatia é **"Outros (N)"**, em **cinza** — cor diferente de todas as outras.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-205 · Preço médio confere

1. Aba **Consumo**, tabela **Os itens mais comprados**
2. Pegue uma linha e divida `valor ÷ quantidade`

**Esperado:** o resultado é o **preço médio** mostrado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-206 · O mesmo material comprado duas vezes é uma linha só

1. Aba **Consumo**
2. Procure um material que aparece em mais de uma compra (no histórico, o Cimento Portland)

**Esperado:** aparece **uma vez só**, com a quantidade somada das compras.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-207 · O menu pergunta o formato

1. Em qualquer aba, clique em **↓ Baixar**
2. Olhe o que aparece

**Esperado:** um menu com **duas** opções — **PDF** e **Word (.docx)** — e, embaixo de cada uma, uma frase dizendo para que serve. O menu fecha ao clicar fora, ao apertar **Esc** e depois de escolher.

> O sistema **não** baixa em CSV. Se algum botão baixar um `.csv`, é defeito.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-208 · Cada aba baixa o seu arquivo

1. Baixe em **PDF** nas cinco abas

**Esperado:** cinco arquivos com nomes diferentes (`orcado-x-realizado`, `economia-nas-cotacoes`, `desempenho-dos-fornecedores`, `tempo-do-processo`, `consumo-de-materiais`), cada um com o conteúdo da sua aba.

Abra um deles e confira: cabeçalho da Porto Inc., título, o contexto (obra e período), a tabela com os valores formatados, a nota no pé e "Gerado pelo sistema em..." com o número da página.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-209 · O arquivo respeita o filtro

1. Aba **Consumo**, escolha uma obra específica
2. Baixe em PDF

**Esperado:** o arquivo traz **só** os itens daquela obra — os mesmos da tela. O nome da obra aparece no cabeçalho do arquivo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-210 · Ver os números por trás (PC)

1. Passe o mouse sobre um cartão, sobre uma barra do ranking e sobre uma fatia da rosca

**Esperado:** aparece uma caixinha com os números e uma frase explicando de onde saiu aquele valor. Ela some ao tirar o mouse.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-211 · Ver os números por trás (celular)

1. Abra no celular (ou aperte F12 e escolha um aparelho)
2. **Toque** num cartão e numa barra

**Esperado:** a mesma caixinha aparece. Tocar fora fecha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-212 · As abas pelo teclado

1. Sem usar o mouse, use **Tab** até chegar nas abas
2. Ande entre elas com Tab e abra com **Enter** ou **Espaço**

**Esperado:** cada aba recebe um contorno de foco visível e abre ao apertar Enter.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-213 · A tela no celular

1. Abra **Relatórios** no celular, em todas as cinco abas

**Esperado:** as abas quebram em duas linhas sem cortar; os cartões ficam um embaixo do outro; as tabelas largas **rolam para o lado** sem esticar a página inteira; nada fica escondido atrás da borda.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-214 · A cor não informa sozinha

1. Aba **Orçamento**, coluna **Situação**

**Esperado:** cada situação tem **ícone e texto** além da cor: ✓ Folgado, ⚠ Atenção, ✕ Estourou. Dá para entender a tabela impressa em preto e branco.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-215 · Relatório sem dado nenhum

1. Num sistema recém-instalado, sem nenhuma compra, abra **Relatórios**

**Esperado:** em vez de tabelas vazias e gráficos em branco, uma mensagem dizendo o que fazer para os números aparecerem.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-216 · O relatório não inventa gargalo

1. Faça uma compra inteira **hoje**, do começo ao fim, num sistema limpo
2. Abra a aba **Tempos**

**Esperado:** todas as etapas mostram 0 dias e o cartão **Etapa mais demorada** mostra **—**, não o nome de uma etapa.

> Apontar uma etapa quando nada demorou mandaria alguém arrumar o que não está quebrado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-217 · Os números batem com as outras telas

1. Aba **Consumo**, anote o **total**
2. Vá em **Pedidos** e some o valor dos pedidos não cancelados do mesmo período

**Esperado:** os dois valores são iguais. O relatório não tem números próprios: ele lê o que o resto do sistema gravou.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 15. Etapa 12 — Locação de equipamentos

> **Entre como Administrador** (`admin@portoinc.com.br`) ou **Comprador** (`andre@portoinc.com.br`) para contratar e devolver. O **Gestor de obra** (`bras@`) e o **Almoxarife** (`gilson@`) só veem.

> **Antes de começar:** se não houver locação nenhuma, rode `docker compose exec api npx tsx prisma/seed-historico.ts`. Ele cria 4 contratos, sendo um já atrasado — que é o caso que a tela existe para mostrar.

## CT-218 · Quem entra e quem contrata

1. Entre como **Almoxarife** (`gilson@`) e abra **Locação**
2. Olhe se existe o botão **+ Nova locação**
3. Repita como **Gestor de obra** (`bras@`)
4. Repita como **Comprador** (`andre@`)

**Esperado:** almoxarife e gestor **veem** a tela, mas **não** têm o botão de nova locação. O comprador tem. Quem não tem acesso nenhum (um solicitante puro) recebe a tela de "sem permissão".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-219 · O alerta aparece em cima de tudo

1. Entre como Administrador e abra **Locação**

**Esperado:** havendo equipamento atrasado, um aviso **vermelho** no alto diz quantos são e **quanto o atraso já custou**, antes de qualquer tabela. Não havendo, o aviso não aparece.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-220 · Os quatro cartões

1. Olhe a linha de cartões

**Esperado:** Atrasadas, Custo do atraso, Vencendo e Em andamento. O **Custo do atraso** fica vermelho quando é maior que zero, e verde quando é zero. Passe o mouse em cada um: aparece a explicação do que aquele número significa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-221 · A conta da diária confere

1. Na tabela, pegue um contrato cobrado **por dia**
2. Conte os dias entre o início e hoje (ou a devolução), **incluindo o primeiro dia**
3. Multiplique pelo valor da diária e pela quantidade

**Esperado:** o resultado é o que está na coluna **Já custou**.

> O primeiro dia conta de propósito: pegar de manhã e devolver à tarde é uma diária, não zero.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-222 · Período começado é período cobrado

1. Pegue um contrato cobrado **por semana** ou **por mês**
2. Veja a coluna **Já custou** e o "N período(s)" embaixo

**Esperado:** 8 dias num contrato semanal contam **2 semanas**, não 1,14. O sistema arredonda para cima, que é como o fornecedor cobra.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-223 · O custo do atraso é só a diferença

1. Pegue um contrato **atrasado**
2. Some: quantos dias além da data prevista × o valor do período × a quantidade

**Esperado:** bate com a coluna **Atraso**. Esse valor é **menor** que o "Já custou" — ele é só a parte que se pagou a mais, não o total.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-224 · O aviso vem antes de vencer

1. Registre uma locação que vence **em 2 dias**
2. Registre outra que vence **em 30 dias**

**Esperado:** a de 2 dias aparece como **⚠ Vence em breve**; a de 30 como **✓ Em dia**. O aviso começa a 3 dias do vencimento.

> Avisar só no dia não ajuda: entre pedir a retirada e o fornecedor aparecer passam dias, e cada um é mais uma diária.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-225 · "O que fazer agora" só lista o que precisa de ação

1. Desça até o fim da tela

**Esperado:** a lista traz **só** os contratos atrasados, vencendo hoje ou vencendo em breve — em frases de português, com o valor do prejuízo. Contrato em dia e devolvido **não** aparecem ali.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-226 · Registrar uma locação avulsa

1. **+ Nova locação**
2. Deixe "Veio de um pedido?" em **Não — locação avulsa**
3. Preencha fornecedor, obra, equipamento, quantidade, cobrança, valor, início e devolução prevista
4. **Registrar locação**

**Esperado:** a locação aparece na tabela com número **LOC-000XX**, situação de acordo com as datas, e o custo já calculado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-227 · Locação vinda de um pedido preenche sozinha

1. Compre um item de locação pelo fluxo normal (solicitação → aprovação → cotação → pedido) usando um item da família **LOC**
2. Vá em **Locação → + Nova locação**
3. Escolha o pedido no campo **"Veio de um pedido?"**

**Esperado:** fornecedor, obra, equipamento, quantidade, unidade e valor vêm preenchidos. Você só informa a data prevista de devolução.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-228 · Um pedido vira um contrato só

1. Registre a locação vinda de um pedido (CT-227)
2. Tente **+ Nova locação** de novo e procure o mesmo pedido na lista

**Esperado:** ele **não aparece mais** na lista de itens disponíveis.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-229 · Devolução antes do início é recusada

1. **+ Nova locação**
2. Ponha a **devolução prevista antes** da data de início
3. Tente registrar

**Esperado:** o sistema recusa com *"A devolução não pode ser antes do início da locação."* — não grava.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-230 · Devolver para o relógio

1. Numa locação ativa, clique em **Devolver**
2. Informe a data em que o equipamento voltou
3. Confirme

**Esperado:** a mensagem diz se foi **no prazo** ou com **quantos dias de atraso**. A situação vira **Devolvida**, e o valor de "Já custou" **para de subir** — confira voltando à tela no dia seguinte.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-231 · Não devolve duas vezes

1. Numa locação já devolvida, procure o botão **Devolver**

**Esperado:** os botões de ação **somem** para contratos devolvidos e cancelados. A coluna mostra apenas um traço.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-232 · O que já aconteceu não se cancela

1. Numa locação **ativa**, clique em **Cancelar**, escreva o motivo e confirme
2. Verifique que o custo dela foi a **zero** e que ela saiu do "Em andamento"
3. Agora pegue uma locação **já devolvida** e tente cancelá-la

**Esperado:** o contrato ativo é cancelado e passa a custar **R$ 0,00**. A locação já devolvida **não** pode ser cancelada — apagar um custo que existiu faria o relatório mentir.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-233 · Cancelar exige motivo

1. Clique em **Cancelar** numa locação ativa e deixe o motivo em branco

**Esperado:** o botão de confirmar fica **desabilitado**. Sem motivo não cancela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-234 · Os filtros

1. Troque o filtro de **Obra**
2. Troque o filtro de **Situação** para "Atrasadas"

**Esperado:** a tabela reduz de acordo. Os **cartões do topo continuam mostrando o total da obra escolhida** — eles respondem "como está a obra", não "o que sobrou no filtro".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-235 · Baixar em PDF e em Word

1. **↓ Baixar** → **PDF**
2. **↓ Baixar** → **Word (.docx)**

**Esperado:** os dois trazem o resumo no cabeçalho (ativas, atrasadas, custo do atraso) e a tabela com equipamento, obra, fornecedor, cobrança, devolução, quanto custou e o atraso. O arquivo **respeita os filtros** que estavam na tela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-236 · A tela no celular

1. Abra **Locação** no celular

**Esperado:** os cartões ficam um embaixo do outro, a tabela rola para o lado sem esticar a página, e os botões **Devolver** e **Cancelar** ficam um sobre o outro em vez de empurrar a coluna para fora.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-237 · A cor não informa sozinha

1. Olhe a coluna **Situação**

**Esperado:** cada situação tem **ícone e texto** além da cor: ✓ Em dia, ⚠ Vence em breve, ✕ Atrasada, ℹ Devolvida. Dá para entender impresso em preto e branco.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-238 · Locação sem nada registrado

1. Num sistema recém-instalado, abra **Locação**

**Esperado:** em vez de tabela vazia, uma mensagem dizendo o que fazer — e, para quem pode contratar, apontando o botão de nova locação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 16. Testes de aparência e usabilidade

Estes valem para **todas** as telas. Faça uma vez por etapa.

## CT-239 · A tela de Início acompanha o sistema

1. Entre como **Administrador** e olhe a tela de **Início**
2. Compare os cartões de "O que você pode fazer" com os itens do **menu da esquerda**
3. Entre como **Gilson** (almoxarife) e repita

**Esperado:** os cartões são **exatamente** os mesmos itens do menu, sem faltar nem sobrar (o item "Início" não vira cartão). O Gilson vê menos cartões que o administrador, e nenhum deles é de Relatórios.

O aviso do topo diz **"Módulo 1 completo — 12 etapas entregues"**, cita relatórios e locação entre o que já existe, e avisa que as integrações rodam em modo de teste.

> Os dois saem da mesma lista dentro do sistema. Se algum dia um módulo aparecer no menu e não na tela de Início, é defeito.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-240 · A barra de filtros é igual em toda tela

1. Abra, uma depois da outra: **Solicitações**, **Cotações**, **Materiais**, **Fornecedores**, **Obras**, **Usuários**, **Estoque**, **Locação**, **Relatórios**
2. Olhe a barra no alto de cada uma

**Esperado:** o mesmo desenho em todas — **rótulo acima** de cada filtro (Buscar, Situação, Família, Obra...), filtros à esquerda, botões à direita, tudo com a mesma altura e a mesma base.

> Nenhum filtro pode ter **só** o texto de dentro (placeholder) no lugar do rótulo: esse texto some quando a pessoa começa a digitar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-241 · Enter busca

1. Em **Materiais**, clique no campo **Buscar**, digite `cimento` e aperte **Enter** (sem clicar no botão)
2. Repita em **Fornecedores**, **Obras** e **Usuários**

**Esperado:** a lista filtra nas quatro telas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-242 · Todo botão cabe no dedo

1. Abra qualquer tela no celular
2. Toque nos botões discretos — **Cancelar**, **Sair**, **Ver extrato**, **Editar**

**Esperado:** todos têm pelo menos **44 pixels** de altura. Nenhum exige mira.

> Esta é a régua que o sistema usa inteiro. Para conferir sem olhar tela por tela: `cd scripts && npm run auditoria:celular`.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-246 · Excesso de requisição não vira "erro do servidor"

1. Atualize a mesma tela muitas vezes seguidas, bem rápido (umas 200 vezes)

**Esperado:** em algum momento aparece **"Muitas requisições em pouco tempo. Aguarde um instante."** — e não "Erro interno do servidor". Esperar um minuto resolve.

> Este caso existe porque o defeito estava lá: o sistema respondia como se tivesse quebrado quando na verdade era só excesso de pedido. E não aparecia nos testes porque o limitador fica desligado neles.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-243 · Tudo que é clicável reage ao mouse

1. Numa tela cheia, como **Financeiro** ou **Locação**, passe o mouse devagar por cima de: cada botão, os links dentro dos avisos, as abas dos Relatórios, as linhas da legenda da rosca, as fatias da rosca e as barras do fluxo de caixa
2. Inclua o botão **Cancelar** da tela de Locação e a barra do **mês atual** no fluxo de caixa

**Esperado:** **todos** mudam de aparência — fundo, cor, sublinhado mais grosso ou traço mais espesso. Nenhum fica parado.

> Os dois últimos são de propósito na lista: eram justamente os que não reagiam.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-244 · O cursor diz o que a coisa faz

1. Passe o mouse sobre um **botão** e sobre um **cartão de indicador** (os números grandes do Financeiro, Relatórios e Locação)

**Esperado:** no botão o cursor vira **mão**; no cartão de indicador vira **interrogação**. É proposital: o cartão explica um número, não leva a outra tela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-245 · O teclado enxerga onde está

1. Sem usar o mouse, aperte **Tab** repetidamente numa tela cheia

**Esperado:** cada parada mostra um **contorno azul** bem visível. Nenhum item recebe o foco sem aparecer.

> Para conferir as três coisas sem olhar item por item: `cd scripts && npm run auditoria:hover`.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-247 · O menu fica parado ao rolar

1. Abra o **Financeiro**, que é uma tela comprida
2. Role a página até o fim

**Esperado:** o menu da esquerda **não se move**. Ele fica colado logo abaixo da barra de cima, e o item "Status do sistema" continua clicável sem precisar rolar.

> Antes o menu esticava até a altura da página (2.575 px no Financeiro) e sumia junto ao rolar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-248 · O menu está dividido em blocos

1. Entre como **Administrador** e olhe o menu

**Esperado:** quatro títulos pequenos e cinzas — **COMPRAS**, **ALMOXARIFADO**, **GESTÃO**, **ADMINISTRAÇÃO** — com uma linha fina separando cada bloco. O **Início** fica solto no alto, antes de todos.

Tudo cabe na tela: nenhum item exige rolar o menu.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-249 · Bloco vazio some junto com o título

1. Entre como **Gilson** (`gilson@portoinc.com.br`) e olhe o menu

**Esperado:** ele vê **Compras** (só Solicitações), **Almoxarifado** (três itens) e **Administração** (só Cadastros). O título **GESTÃO não aparece** — ele não tem nenhum item ali dentro.

> Um rótulo sozinho, sem nada embaixo, seria pior que a lista solta.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-250 · No celular o menu continua confortável para o dedo

1. Abra no celular e toque em **☰**
2. Toque nos itens do menu

**Esperado:** a gaveta abre com os mesmos quatro blocos, e cada item tem **44 px** de altura — maior que no computador, porque ali quem toca é o dedo, não o ponteiro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---
## CT-251 · A barra de rolagem do menu combina com o sistema

1. Diminua a **altura** da janela do navegador até o menu não caber (uma janela de uns 800 px de altura basta)
2. Olhe a barra de rolagem que aparece dentro do menu

**Esperado:** uma barrinha **fina e arredondada, no azul do tema**, sem as setinhas cinzas nas pontas. Não pode parecer a barra cinza do Windows colada ali.

3. Volte a janela para a altura normal

**Esperado:** o menu cabe inteiro e a barra some.

> Numa janela de 900 px de altura tudo cabe. A barra só aparece abaixo disso.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-252 · Instalação nova deixa alguém entrar

> Este caso mexe em um banco **separado**. Não toca no que você está usando.

1. Crie um banco vazio e aplique as migrations:

```bash
docker compose exec db psql -U portoink -d postgres -c "CREATE DATABASE portoink_ensaio;"
docker compose exec -e DATABASE_URL="postgresql://portoink:SUA_SENHA@db:5432/portoink_ensaio?schema=public" api npx prisma migrate deploy
```

2. Crie o primeiro administrador:

```bash
docker compose exec -e DATABASE_URL="postgresql://portoink:SUA_SENHA@db:5432/portoink_ensaio?schema=public" api npm run criar-admin -- --nome "Maria Souza" --email maria@teste.com.br
```

**Esperado:** o comando mostra nome, e-mail e uma **senha sorteada**, avisando que ela não aparece de novo.

3. Rode o mesmo comando outra vez, com outro e-mail

**Esperado:** ele **recusa**, dizendo que o sistema já tem administrador e mandando usar a tela de Administração.

4. Apague o banco de ensaio:

```bash
docker compose exec db psql -U portoink -d postgres -c "DROP DATABASE portoink_ensaio;"
```

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-253 · A cópia de segurança volta inteira

1. Faça uma cópia:

```bash
cd scripts
npm run backup
```

**Esperado:** aparece o caminho do arquivo e o tamanho. Arquivo menor que 1 KB é recusado pelo próprio comando.

2. Tente restaurar **sem** `--confirmo`:

```bash
npm run restaurar -- --arquivo backups/ARQUIVO.dump --banco portoink_conferencia
```

**Esperado:** ele **recusa** e avisa que apagaria o banco, explicando como conferir sem risco.

3. Restaure num banco separado, agora com `--confirmo`:

```bash
npm run restaurar -- --arquivo backups/ARQUIVO.dump --banco portoink_conferencia --confirmo
```

**Esperado:** termina dizendo quantas tabelas ficaram no banco (37, hoje).

4. Compare uma contagem qualquer entre os dois bancos:

```bash
docker compose exec db psql -U portoink -d portoink -tAc "SELECT count(*) FROM solicitacoes;"
docker compose exec db psql -U portoink -d portoink_conferencia -tAc "SELECT count(*) FROM solicitacoes;"
```

**Esperado:** o mesmo número nos dois.

5. Apague o banco de conferência

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-254 · As telas têm prova automática

```bash
docker compose exec web npm test
```

**Esperado:** 35 provas, todas verdes, em menos de meio minuto.

> Elas conferem **comportamento**, não aparência: quem vê o quê no menu, solicitação que não duplica com clique duplo, a alçada na tela de aprovação, o custo do atraso na locação e a escolha entre PDF e Word. Alinhamento e espaçamento continuam sendo medidos por `npm run auditoria`, dentro de `scripts`.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-255 · O e-mail não sai para quem não está na lista

1. Menu **Administração → Avisos**, aba **E-mail**
2. Confira o aviso do alto

**Esperado:** diz **"Modo simulado: nenhum e-mail sai para fora"** e explica que só a lista recebe.

3. Em **Enviar um e-mail de teste**, digite um endereço que **não** esteja na lista e clique em **Enviar teste**

**Esperado:** aparece um aviso dizendo que o endereço **não está na lista de autorizados** e que **nada foi enviado**.

4. Role até **O que o sistema tentou enviar**

**Esperado:** a tentativa aparece como **Bloqueada**, com o motivo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-256 · O e-mail sai depois de liberar

1. Ainda na aba **E-mail**, em **Endereços autorizados**, preencha o seu e-mail e o nome, e clique em **Liberar e-mail**

**Esperado:** o endereço entra na lista **mascarado** (tipo `fu•••••@empresa.com.br`). O endereço inteiro não pode aparecer.

2. Mande o teste para esse mesmo endereço

**Esperado:** passa, e a mensagem diz que **o e-mail foi registrado, mas não saiu para fora** — porque o adaptador está simulado.

3. Digite o mesmo endereço com **outras maiúsculas** (`FULANO@Empresa.com.br`) e mande de novo

**Esperado:** passa igual. E-mail não diferencia maiúscula de minúscula.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-257 · Convite e pedido saem pelos dois canais

1. Abra uma **cotação aberta**

**Esperado:** existem os dois botões — **💬 Convidar pelo WhatsApp** e **✉ Convidar por e-mail**.

2. Clique no de e-mail

**Esperado:** o sistema responde quantos convites saíram e quantos foram bloqueados. Fornecedor sem e-mail cadastrado é **pulado com aviso**, sem travar os outros.

3. Vá em **Pedidos** e clique em **✉ E-mail** num pedido

**Esperado:** o mesmo comportamento do WhatsApp — e, se o pedido estava em rascunho, ele passa para **Enviado** sozinho.

4. Volte em **Avisos → E-mail** e olhe o histórico

**Esperado:** os envios aparecem, com **de onde partiram** (cotação, pedido) e **qual documento**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-258 · O PDF da nota fiscal

1. Menu **Financeiro → Notas fiscais**
2. Na coluna **Arquivo**, clique em **📄 PDF** de qualquer nota

**Esperado:** baixa um PDF de **uma folha só**, com fornecedor, pedido, totais e — se a nota veio do XML — os itens.

3. Olhe o **rodapé** do PDF

**Esperado:** diz que é documento interno e que **NÃO substitui o DANFE**. Isso é obrigatório: sem o certificado digital da empresa, o sistema não emite DANFE.

4. Baixe o PDF de uma nota **digitada à mão** (sem itens)

**Esperado:** em vez de uma tabela vazia, uma frase explicando que a nota foi lançada sem detalhamento de itens.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-259 · Guardar o arquivo que o fornecedor mandou

1. Ainda em **Notas fiscais**, clique em **📎 Arquivos** de uma nota

**Esperado:** abre uma gaveta **embaixo da linha**, sem janela por cima e sem tirar você da lista.

2. Escolha um **PDF** qualquer no campo de subir arquivo

**Esperado:** o arquivo aparece na lista com nome, tamanho e quem guardou.

3. Clique em **Baixar** nesse arquivo

**Esperado:** baixa **o mesmo arquivo**, com o nome original.

4. Tente subir um arquivo que **não** seja PDF nem XML (uma imagem, por exemplo)

**Esperado:** o sistema **recusa**, dizendo que só aceita PDF e XML.

5. Clique em **Remover** e confira a lista

**Esperado:** o arquivo some.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-260 · O tema é escolha sua, e o sistema lembra

1. Entre no sistema

**Esperado:** abre no **tema claro** — mesmo que o seu Windows esteja no modo escuro.

2. No rodapé do menu da esquerda, clique em **🌙 Tema escuro**

**Esperado:** a tela inteira escurece, **inclusive o menu e a barra de cima**. O botão passa a dizer **☀ Tema claro**.

3. Aperte **F5** para recarregar

**Esperado:** continua escuro, e **sem piscar branco** no meio do caminho.

4. Olhe o item do menu onde você está (o destacado)

**Esperado:** dá para ler sem esforço, nos dois temas. Ele também tem uma barrinha à esquerda — quem não distingue as cores se guia por ela.

5. Volte para o tema claro e recarregue

**Esperado:** continua claro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-261 · Toda tela diz onde você está e como voltar

1. Entre como **Administrador** e abra **Cotações**

**Esperado:** no alto, o caminho **"Início › Cotações"** e, à direita, **"← Voltar para Início"**.

2. Abra uma cotação e clique em **Equalizar e escolher**

**Esperado:** o caminho vira **"Início › Cotações › Pacote de cotação › Equalização"**.

3. Clique em **Voltar**

**Esperado:** volta para **aquela cotação** — a mesma que você estava vendo, não a lista.

4. Clique em **Voltar** de novo

**Esperado:** agora sim vai para a lista de Cotações.

5. No caminho do alto, clique direto em **Início**

**Esperado:** pula direto, sem passar pelo meio.

6. Passe por 5 ou 6 telas diferentes

**Esperado:** todas têm o caminho e o Voltar, no mesmo lugar. As únicas sem são a tela de entrar e o portal do fornecedor.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-262 · O menu de ações da tabela

1. Entre como **Administrador** e abra **Pedidos**

**Esperado:** a tabela cabe inteira, **sem cortar nada à direita**. Cada linha tem um botão **⋮** no fim.

2. Clique no **⋮** de qualquer linha

**Esperado:** abre um menu com **Baixar o PDF**, **Mandar pelo WhatsApp** e **Mandar por e-mail** — cada um dizendo o que faz por extenso.

3. Aperte **Esc**

**Esperado:** o menu fecha e o foco volta para o botão ⋮.

4. Abra de novo e escolha **Baixar o PDF**

**Esperado:** o menu fecha e o PDF baixa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-263 · Cancelar uma nota pergunta antes

1. Vá em **Financeiro → Notas fiscais**
2. Clique em **Cancelar** numa nota

**Esperado:** abre uma janela com o **número da nota no título**, o fornecedor, o valor, e o aviso de que cancelar não se desfaz. O fundo escurece.

3. Aperte **Tab** várias vezes

**Esperado:** o foco **circula dentro da janela** — nunca chega no menu da esquerda nem na tabela atrás.

4. Tente rolar a página com a roda do mouse

**Esperado:** o que está atrás **não rola**.

5. Aperte **Esc**

**Esperado:** fecha sem cancelar nada, e o foco volta para o botão **Cancelar** de onde você saiu.

6. Abra de novo e confirme em **"Sim, cancelar a nota"**

**Esperado:** a nota é cancelada e a janela fecha sozinha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-264 · A seta dos campos de escolha

1. Abra **Solicitações** e olhe o campo **Situação**

**Esperado:** a seta fica **encostada na borda direita** do campo, não solta no meio.

2. Troque para o **tema escuro** e olhe de novo

**Esperado:** a seta clareia junto e continua legível. Não pode ficar uma seta cinza de sistema operacional em cima do fundo escuro.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-265 · O formulário vem até você

O defeito que este caso existe para pegar: o formulário abria fora da tela e parecia que o
clique não tinha funcionado.

1. Entre como **Financeiro** (`andre@portoinc.com.br`) e abra **Financeiro**
2. **Role a página até o fim**, onde fica a tabela de parcelas
3. Clique em **Dar baixa** na **última** linha

**Esperado:** abre uma janela **no meio da tela**, com o número da parcela no título. O
fundo escurece. Você **não** precisa procurar o formulário nem rolar atrás dele.

4. Tente rolar a página com a roda do mouse

**Esperado:** o que está atrás **não rola**.

5. Aperte **Esc** sem digitar nada

**Esperado:** fecha na hora, **sem perguntar nada**, e o foco volta para o botão **Dar
baixa** de onde você saiu.

6. Repita em **Estoque → Retirar**, **Estoque → Contar**, **Locação → Devolver** e
   **Locação → Cancelar**

**Esperado:** o mesmo comportamento nos cinco.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-266 · Ele pergunta antes de jogar fora o que você digitou

1. Em **Estoque**, clique em **Contar** em qualquer material

**Esperado:** a quantidade já vem preenchida com o saldo atual.

2. Aperte **Esc** sem mexer em nada

**Esperado:** fecha **direto**. Não pode perguntar "descartar o que você digitou?", porque
quem preencheu foi o sistema, não você.

3. Abra de novo, **troque a quantidade** e aperte **Esc**

**Esperado:** agora **pergunta** se pode fechar mesmo assim.

4. Responda que **não**

**Esperado:** a janela continua aberta, com o que você digitou intacto.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-267 · A tela inicial mostra o que precisa de você

1. Entre como **Financeiro** (`andre@portoinc.com.br`)

**Esperado:** logo abaixo da saudação, a faixa **"O que precisa de você"**. Se houver parcela
vencida, o cartão dela tem **faixa vermelha na lateral esquerda** e o número em vermelho.

2. Confira a ordem dos cartões da faixa

**Esperado:** o que já passou do prazo vem **antes** do que ainda vai vencer.

3. Clique no cartão **Contas vencidas**

**Esperado:** abre o **Financeiro**. O número que estava no cartão bate com o que a tela mostra.

4. Volte ao início e olhe o fim da página

**Esperado:** o aviso sobre etapas e **modo de teste** está lá embaixo, em letra menor — não no topo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-268 · Cada função vê o que pode resolver

1. Entre como **Almoxarife** (`neilma@portoinc.com.br`)

**Esperado:** aparecem números de **estoque** e **recebimento**. **Não** aparece nenhum cartão de
contas a pagar — contar uma parcela vencida para quem não abre o financeiro é dar uma notícia que
a pessoa não pode resolver.

2. Entre como **Gestor de obra** (`gilson@portoinc.com.br`)

**Esperado:** aparece **"Esperando sua assinatura"**, e o número bate com o que a tela de
**Aprovações** mostra.

3. Entre como **Administrador** e confira a faixa "Como estão as coisas"

**Esperado:** os cartões com **zero** ficam nessa faixa, em cinza, dizendo o que está em dia —
nunca em vermelho no alto da tela.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-269 · Os dois temas continuam legíveis

1. Em qualquer tela, clique em **Tema escuro** no fim do menu lateral
2. Olhe o item do menu onde você está (o destacado)

**Esperado:** o texto dele é legível contra o fundo destacado, nos **dois** temas.

3. Olhe o nome de usuário no canto superior direito, e a linha "1 função(ões)" abaixo dele

**Esperado:** a segunda linha é legível. Não pode ser um cinza claro quase invisível.

4. Vá em **Locação** e olhe o botão **Cancelar** de um contrato, no tema escuro

**Esperado:** ele acompanha o tema. Não pode ser um retângulo cinza-claro do sistema operacional.

5. No início, clique em **Status do sistema** no texto do fim da página

**Esperado:** o link é visível nos dois temas e leva à tela de status.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-270 · A explicação do número não cobre o vizinho

O defeito que este caso existe para pegar: a caixinha de explicação abria por cima do cartão
ao lado e escondia o número dele.

1. Entre como **Financeiro** (`andre@portoinc.com.br`) e abra **Financeiro**
2. Clique no **?** do cartão **"Vencem em 7 dias"**

**Esperado:** a explicação abre **dentro do próprio cartão**, abaixo do número. Os cartões
vizinhos continuam legíveis — nenhum número fica escondido.

3. Olhe a altura dos quatro cartões da fileira

**Esperado:** todos crescem juntos. Nenhum fica mais alto que os outros.

4. Clique no **×** do mesmo cartão

**Esperado:** a explicação fecha e a fileira volta à altura de antes.

5. Chegue até o **?** usando só a tecla **Tab** e aperte **Enter**

**Esperado:** funciona igual ao clique.

6. Repita em **Relatórios** e em **Locação**

**Esperado:** o mesmo comportamento.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-271 · Os números concordam com o substantivo

1. Percorra **Financeiro**, **Relatórios**, **Estoque** e **Locação**

**Esperado:** em nenhum lugar aparece **"(s)"** ou **"(ões)"**. Onde houver um item, lê-se
"1 parcela", "1 nota", "1 função"; onde houver vários, "3 parcelas", "2 solicitações".

2. Olhe o canto superior direito, abaixo do seu nome

**Esperado:** "1 função" para quem tem uma, "2 funções" para quem tem duas.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-272 · A dica dos gráficos não fica cortada

O defeito que este caso existe para pegar: o painel flutuante aparecia cortado pela borda do
cartão e por cima do título do gráfico.

1. Entre como **Financeiro** (`andre@portoinc.com.br`) e abra **Financeiro**
2. Passe o mouse pelo **topo da barra mais alta** do gráfico "Fluxo de caixa"

**Esperado:** o painel aparece **inteiro**, sem nenhum lado cortado, e **não** cobre o título
"Fluxo de caixa: o que já saiu e o que vem por aí".

3. Passe o mouse pela **última coluna da direita**

**Esperado:** o painel continua inteiro e dentro da tela — não sai pela borda direita.

4. Passe o mouse pela **rosca** de "Composição da carteira", na parte de cima dela

**Esperado:** o painel aparece inteiro e não cobre o título "Composição da carteira".

5. Repita em **Relatórios**, em todos os gráficos

**Esperado:** o mesmo comportamento.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-273 · O campo tem o tamanho do que recebe

O defeito que este caso existe para pegar: o campo do número do pedido ocupava 969px para
receber oito caracteres.

1. Entre como **Almoxarife** (`neilma@portoinc.com.br`) e abra **Recebimento**

**Esperado:** o campo **Número do pedido** é curto — cabe "PC-00001" com folga e nada mais.
O botão **Abrir conferência** fica ao lado dele, e não no outro canto da tela.

2. Abra **Solicitações → Nova solicitação**

**Esperado:** **Quantidade** e **Precisa até** são campos curtos. **Justificativa** e
**Observações gerais** continuam largos, porque recebem texto livre.

3. Olhe as três caixas do formulário

**Esperado:** cada uma tem um título — "Para qual obra", "Adicionar item", "Antes de salvar".

4. Abra **Cotações → Nova cotação**

**Esperado:** o mesmo: "O pacote" e "Resumo do pacote".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-274 · Alçadas sem faixa configurada

1. Entre como **Administrador** e abra **Cadastros → Alçadas**

**Esperado:** com faixas cadastradas, a tabela aparece normalmente.

2. Olhe os botões da tela

**Esperado:** só **um** botão azul cheio — **"+ Nova faixa"**. O **Simular** é de contorno.
Quando dois botões competem pela mesma atenção, nenhum é o próximo passo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-275 · Os cartões de lista estão alinhados por dentro

1. Abra **Cadastros → Famílias**

**Esperado:** os cartões da mesma fileira têm a mesma altura **e** a linha de contagem
("2 itens · 1 fornecedor") fica na mesma altura em todos, mesmo quando uma descrição ocupa
duas linhas e a outra uma.

2. Confira os números no pé de cada cartão

**Esperado:** "1 item" e não "1 item(s)"; "1 fornecedor" e não "1 fornecedor(es)".

3. Abra **Usuários** e olhe os cartões de função

**Esperado:** o mesmo desenho — título, descrição e a linha de baixo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-276 · No celular, a tabela vira cartão

Use o celular de verdade, ou apenas estreite a janela do navegador até uns 400px de largura.

1. Entre como **Comprador** (`washington@portoinc.com.br`) e abra **Pedidos**

**Esperado:** cada pedido é um **cartão**, com o número em cima e os campos embaixo —
Fornecedor, Origem, Itens, Total, Pagamento, Situação e as Ações. **Nenhum campo fica**
**escondido**, e você não precisa arrastar a tabela para o lado.

2. Tente arrastar a página para o lado

**Esperado:** ela não anda. Nada fica fora da tela.

3. Olhe o rótulo de cada campo

**Esperado:** aparece acima do valor, em letra menor e maiúscula — e é o **mesmo texto** do
cabeçalho da tabela no computador.

4. Abra a mesma tela no computador

**Esperado:** volta a ser tabela, igual a antes.

5. Abra **Cotações → uma cotação → Equalização** no celular

**Esperado:** aqui a tabela **continua** rolando de lado, de propósito: é a tela de comparar
fornecedor com fornecedor.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-277 · Os números no celular

1. Ainda no celular, olhe o topo de **Pedidos**

**Esperado:** os cartões de número aparecem **dois por linha**.

2. Confira o maior valor da tela (por exemplo "R$ 86.796,00")

**Esperado:** ele cabe inteiro dentro do cartão. Nenhum número cortado ou vazando.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-278 · O foco aparece nas opções de escolha

1. Entre como **Almoxarife** (`neilma@portoinc.com.br`) e abra **Estoque**
2. Clique em **Retirar** em qualquer material
3. Sem usar o mouse, aperte **Tab** até chegar nas opções **Retirar / Entrada / Ajuste /**
   **Transferência**

**Esperado:** a opção em que você está ganha um **contorno azul visível** em volta da caixa
inteira — não só um pontinho no radio.

4. Use as setas do teclado para trocar de opção

**Esperado:** o contorno acompanha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-279 · Os ícones são desenhos, não emojis

1. Entre como **Administrador** e olhe o **menu da esquerda**
2. Olhe os ícones ao lado de Início, Solicitações, Cotações, Cadastros, Usuários
3. Role a tela de **Início** até "Ir para" e olhe os ícones dos cartões

**Esperado:** todos são desenhos de **linha, na mesma cor do texto ao lado** — cinza no
item normal, azul no item ativo. Nenhum é colorido, nenhum parece uma figurinha.

**Confira também:** abra a mesma tela **no celular**. Os ícones têm de ser os mesmos.
Emoji muda de desenho entre Windows, iPhone e Android; desenho de linha não muda.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-280 · O filtro de período do fluxo de caixa

**Conta:** andre@portoinc.com.br

1. Abra **Financeiro** e olhe o gráfico **Fluxo de caixa**
2. Confira que o mês atual está **no meio** do gráfico, com faixa azul atrás
3. Clique na seta **‹** uma vez

**Esperado:** anda **um** mês só, não seis. O nome no campo do meio muda junto, e
aparece o botão **Hoje** (que antes não existia).

4. Clique em **Hoje**

**Esperado:** volta ao mês atual e o botão **Hoje** some.

5. Clique no campo com o nome do mês

**Esperado:** abre o calendário do seu aparelho ou navegador. Escolha um mês bem
antigo, como janeiro de 2025: o gráfico salta direto para lá, com janeiro no meio.

> Com os dados de teste você vai ver colunas vazias em quase todo período. Isso é
> esperado: só existem contas entre julho e dezembro de 2026.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-281 · Não dá para avançar para o futuro

**Conta:** andre@portoinc.com.br

1. Abra **Financeiro**, sem mexer em nada ainda
2. Olhe a seta **›** do gráfico de fluxo

**Esperado:** ela está **apagada e não clica**. Você já está no mês atual, e o mês que
vem ainda não aconteceu.

3. Clique em **‹** duas vezes

**Esperado:** agora a seta **›** liga.

4. Clique em **›** até voltar ao mês atual

**Esperado:** ao chegar em hoje, ela apaga de novo — não passa disso.

5. Abra o calendário do campo e tente escolher um mês futuro

**Esperado:** o próprio calendário não deixa escolher mês depois do atual.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-282 · O vencido continua vencido em qualquer período

**Conta:** andre@portoinc.com.br

1. Abra **Financeiro** e anote a cor das colunas do gráfico de fluxo
2. Volte alguns meses com a seta **‹**
3. Olhe de novo a coluna de uma parcela que está atrasada

**Esperado:** ela continua **vermelha**. Mudar o período muda **quais meses aparecem**,
não o que está vencido.

> É a regra mais importante deste filtro. Quem decide o que está vencido é **hoje**. Se
> o vermelho virasse amarelo ao olhar o passado, o gráfico estaria mentindo sobre a
> situação atual da empresa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-283 · O gráfico no celular mostra o mês de três em três

**Conta:** andre@portoinc.com.br · **precisa de celular ou F12 em modo celular**

1. Abra **Financeiro** num telefone, ou com a tela em 393px de largura
2. Olhe os nomes dos meses embaixo do gráfico de fluxo

**Esperado:** aparecem **quatro** nomes, espaçados (algo como jun/26, set/26, dez/26,
mar/27) — e não doze nomes grudados uns nos outros. As **doze barras** continuam lá.

3. Confira que o **mês atual** aparece com o nome escrito, mesmo que não caia na conta
   de três em três
4. **Toque** numa barra sem nome

**Esperado:** aparece uma caixa com o mês, os valores e a situação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-284 · O zoom só aumenta

**Precisa de celular de verdade.**

1. Abra qualquer tela no telefone
2. Com dois dedos, **aproxime** (abra os dedos)

**Esperado:** a página aumenta normalmente. Você consegue ler um número pequeno.

3. Com dois dedos, **afaste** (feche os dedos) o máximo que der

**Esperado:** a página volta ao tamanho da tela e **para ali**. Ela não encolhe além
disso, e **não sobra faixa branca** ao lado do conteúdo.

> Se sobrar faixa branca, avise: quer dizer que alguma coisa da página está mais larga
> que a tela, mesmo sem aparecer.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-285 · Nenhuma tela desliza para o lado

**Precisa de celular, ou F12 em 393px.**

Passe por estas telas, e em cada uma **arraste a página para a esquerda** com o dedo:

1. **Financeiro**
2. **Relatórios** → aba Economia
3. **Relatórios** → aba Tempos
4. **Relatórios** → aba Consumo
5. **Locação**
6. **Pedidos**

**Esperado:** nenhuma delas anda para o lado. A página só rola para cima e para baixo.

> As quatro primeiras tinham esse defeito e foram corrigidas em 24/09/2026. A causa era
> uma tabela invisível, que existe só para leitor de tela e estava mais larga que a
> tela. Vale conferir de vez em quando.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---
## CT-286 · O botão azul fica sempre no mesmo lugar

Passe por estas telas, uma atrás da outra, **sem rolar a página**:

**Solicitações** · **Cotações** · **Locação** · **Usuários** · **Cadastros → Famílias** ·
**Cadastros → Obras**

**Esperado:** em todas, o botão azul de criar está **à direita do título**, na mesma
altura. Ele não deve pular de lugar de uma tela para a outra.

> Antes ele aparecia na barra de filtros em umas, no meio da tela em outras, e em alturas
diferentes conforme o tamanho da descrição. Corrigido em 24/09/2026.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-287 · Criar abre uma janela, e ela fecha de quatro jeitos

1. Abra **Cadastros → Famílias** → **+ Nova família**

**Esperado:** abre uma janela por cima, o fundo escurece, e o foco vai para dentro dela.

2. Aperte **Esc**
3. Abra de novo e clique no **X** do canto
4. Abra de novo e clique **fora** da janela
5. Abra de novo e clique em **Cancelar**

**Esperado:** fecha nos quatro casos.

6. Abra de novo

**Esperado:** os campos estão **vazios** — não guardou o que você digitou antes.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-288 · A janela pergunta antes de jogar fora o que você digitou

1. **Cadastros → Famílias → + Nova família**
2. Digite alguma coisa no **Código**
3. Aperte **Esc**

**Esperado:** pergunta se você quer mesmo descartar. Só fecha se você confirmar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-289 · O filtro vale na hora, sem botão

1. Abra **Solicitações**
2. Troque **Situação** para **Aguardando aprovação**

**Esperado:** a lista muda **assim que você escolhe**. Não existe botão "Filtrar".

3. Repita em **Cotações**, **Estoque**, **Usuários**, **Cadastros → Materiais**,
   **Fornecedores** e **Obras**

**Esperado:** em nenhuma delas existe botão de filtrar ou buscar.

4. Numa tela com campo de digitar (Estoque, por exemplo), digite **cimento** devagar

**Esperado:** a lista só atualiza quando você **para** de digitar, e não a cada letra.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-290 · Vindo de Aprovações, o caminho diz Aprovações

**Conta:** bras@portoinc.com.br

1. Abra **Aprovações** e clique em **Analisar** numa solicitação
2. Olhe o caminho no alto da tela e o link de voltar

**Esperado:** diz **Início › Aprovações › Solicitação**, e o voltar é **Voltar para**
**Aprovações** — não para Solicitações.

3. Clique no voltar

**Esperado:** cai de volta na fila de Aprovações.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-291 · Toda tabela tem nome nas colunas

**No computador**, abra: **Pedidos** · **Financeiro** · **Estoque** ·
**Recebimento → Conferir**

**Esperado:** todas mostram a linha de cabeçalho com o nome de cada coluna.

> Entre o Design 7 e 24/09/2026 esse cabeçalho ficou invisível em 25 telas. Na Conferência
a tela mostrava três números sem dizer o que era cada um.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-292 · A Conferência tem uma navegação, não duas

**No computador**, abra **Recebimento** e clique em **Conferir** num pedido.

**Esperado:** no topo aparece **uma** linha de caminho — `Início › Recebimento ›
Conferência` — e o **← Voltar para Recebimento** à direita dela.

> Até 24/09/2026 havia duas barras empilhadas: a tela escrevia a própria trilha
logo acima da que o sistema já monta sozinho.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-293 · O selo de situação fica ao lado do título

**No computador**, abra estas quatro telas e olhe o topo de cada uma:

- **Recebimento → Conferir** (selo *Recebido em parte* ou *Enviado*)
- **Solicitações →** abra uma
- **Cotações →** abra um pacote
- **Cadastros → Obras →** abra uma obra

**Esperado:** em todas, o selo fica **na mesma linha** do título, logo à direita
dele. Nunca numa linha abaixo.

> `cabecalho__titulo-com-selos` era usada pelo sistema e nunca tinha sido escrita
na folha de estilo. Sem ela o título ocupava a linha inteira e o selo desabava.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-294 · O botão de buscar fica colado no campo

**No computador**, abra **Recebimento**, e depois **Conferir** num pedido.

**Esperado:** nas duas telas, o botão (**Abrir conferência** / **Localizar**) fica
**ao lado do campo**, na mesma altura. O texto de ajuda fica **embaixo dos dois**.
O que está escrito dentro do campo aparece inteiro, sem corte.

> Antes o botão era empurrado para o fim do bloco inteiro — que incluía duas
linhas de ajuda — e ia parar a 380px do campo, uma linha abaixo, como se fosse
botão da explicação.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-295 · O saldo traz a conta inteira

**No computador**, abra **Recebimento → Conferir** num pedido já recebido em parte.

**Esperado:** a tabela tem **cinco** colunas — Item, Saldo, Recebido agora,
Devolvido, Como chegou. Na coluna **Saldo** o número aparece grande, e embaixo
dele, miúdo, `Pedido 40 · Recebido 36`.

**No celular** (F12 → ícone de celular, ou no seu telefone), a mesma tela:

**Esperado:** cada item vira um cartão com **quatro** blocos, e o item inteiro
cabe em cerca de uma tela. Os campos de quantidade ocupam a largura toda e são
grandes o bastante para o dedo.

> Eram sete colunas de peso igual: três só de consulta valiam tanto quanto a
coluna onde se digita. No celular viravam sete blocos, e um único item passava de
uma tela inteira de rolagem.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-296 · Os códigos não parecem riscados

**No computador**, abra **Recebimento** e olhe a coluna **Pedido**; depois abra
**Conferir** e olhe o código na frente de cada material.

**Esperado:** `PC-00001`, `REC-00014`, `00068` — os zeros são zeros, redondos.
Nenhum número parece ter um traço em cima.

> Os códigos usavam Cascadia Code, que é fonte de programador: ela corta o zero de
propósito, para não confundir com a letra O em código-fonte. Em `00068` os três
cortes se emendavam e o número parecia rasurado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-297 · O documento sai com a data de hoje, mesmo à noite

**Depois das 21h** (é a faixa onde o defeito aparecia; antes disso ele some), baixe em
**Pedidos → abra um pedido → Baixar PDF**.

**Esperado:** a data do cabeçalho (**Emitido em**) e a do rodapé (**Gerado pelo sistema em**)
são do **mesmo dia**, e esse dia é hoje.

> O container roda em UTC, três horas à frente de Brasília. Até 25/09/2026 o mesmo papel
trazia 24/09 em cima e 25/09 embaixo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-298 · Nenhum rótulo em CAIXA ALTA nos arquivos

Baixe em **PDF** e abra: **Relatórios → Orçado × realizado**, **Financeiro → Contas a
pagar**, e um **Pedido de compra**.

**Esperado:** todo rótulo e todo cabeçalho de coluna em caixa normal — *Obra*, *Previsto*,
*Fornecedor*, *Total do pedido*, *Código*, *Descrição*. Nada de "OBRA" nem "TOTAL DO PEDIDO".

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-299 · O rodapé diz de quantas folhas o papel é

Baixe **Relatórios → Consumo por família e material** em **PDF** (ele passa de uma folha).

**Esperado:** o rodapé de cada folha diz **"Página 1 de 2"**, **"Página 2 de 2"** — e não só
"Página 1". O cabeçalho da tabela se repete em toda folha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-300 · Contas a pagar: CNPJ e situação legíveis

Baixe **Financeiro → Contas a pagar** em **PDF** e em **Word**.

**Esperado:** o CNPJ sai pontuado (**47.960.950/0001-21**), e a coluna **Situação** diz
*Paga* e *Aberta* — não "PAGA" nem "ABERTA".

> Os dois eram o valor do banco chegando cru ao papel. A tela já traduzia; o arquivo não.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-301 · O espelho da nota avisa que não é a nota

Em **Financeiro → Notas fiscais**, abra uma nota e baixe o **espelho em PDF**.

**Esperado:** logo abaixo do **Total da nota** há uma faixa avisando, em vermelho, que o
documento **não é a nota fiscal, não substitui o DANFE e não tem valor fiscal**.

> Antes esse aviso ficava em letra cinza miúda no pé da folha. É a informação mais
importante do papel.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-302 · O orçamento mostra o dinheiro já prometido

Em **Relatórios → Orçamento**, escolha uma obra. Aprove uma solicitação dessa obra e
**não** a transforme em cotação. Volte ao relatório.

**Esperado:** o cartão **Comprometido** subiu pelo valor estimado da solicitação, e o
**Saldo livre** desceu na mesma medida. O **Já comprado** não mudou.

Agora leve essa solicitação até virar pedido de compra e volte de novo.

**Esperado:** o valor **saiu** do comprometido e **entrou** no comprado. Nunca aparece
nos dois.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-303 · O selo de dependência de fornecedor

Em **Relatórios → Fornecedores**, olhe a coluna **Participação**.

**Esperado:** quem passou de **40%** de tudo que a empresa comprou tem o selo
**Dependência** ao lado do número. Quem está com **0%** não tem selo nenhum — quem não
vendeu nada não é dependência.

Baixe em **PDF**: a coluna Participação está lá, e o fornecedor concentrador vem com um
aviso escrito. No papel não há cor, então a palavra é que avisa.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-304 · Duas cargas do mesmo pedido são duas entregas

Faça um pedido com dois itens. Receba **parte** dele hoje (os dois itens, quantidade
parcial) e o resto depois, num segundo recebimento.

**Esperado:** em **Relatórios → Fornecedores**, a coluna **Entregas** mostra **2**, e não
3 nem 4. A conta é de **caminhões**, não de linhas de item.

> Contando itens, o sistema achava que já tinha três entregas quando tinha uma — e
passava a dar veredito sobre um fornecedor de uma compra só.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-305 · Estoque parado: o que está encostado

Em **Relatórios → Estoque parado**, com o corte em **90 dias**.

**Esperado:** se nada está encostado há 90 dias, a tela diz *"Nada encostado — o estoque
está girando"*. Material que chegou esta semana **não** aparece.

Troque o corte para **30 dias** e depois para **365**.

**Esperado:** a lista muda a cada troca, e o texto da tela sempre diz o mesmo número de
dias que está selecionado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-306 · Estoque parado: a conta do dinheiro

Com algum material listado no estoque parado:

**Esperado:** a coluna **Dinheiro** é o **saldo × custo médio** daquele almoxarifado.
Confira abrindo **Estoque** e comparando o saldo e o custo médio do mesmo material.

Material que nunca teve saída traz o selo **Nunca saiu**, e o cartão **Nunca saíram**
conta quantos são.

> Material com saldo zero não aparece: prateleira vazia não é dinheiro parado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-307 · O preço da última compra na equalização

Compre um material, e depois abra uma **nova** cotação do **mesmo** material até chegar
na equalização.

**Esperado:** embaixo da descrição do item aparece *"Última compra: R$ X em DD/MM/AAAA"*,
com o preço do pedido anterior. Material comprado pela primeira vez não mostra linha
nenhuma.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-308 · O prazo de pagamento vira dinheiro

Na equalização, no quadro **Condições comerciais**:

1. Com **Custo do dinheiro** em *Não considerar*, cada fornecedor mostra só o **Prazo
   médio** em dias.
2. Escolha **1,5% ao mês**.

**Esperado:** aparece a linha **Equivale à vista a**, com o total descontado. Quem
respondeu *3x a cada 30 dias* tem prazo médio de **60 dias**; quem exigiu tudo na entrega
aparece como **À vista** e não ganha desconto nenhum.

3. Saia da tela e volte.

**Esperado:** a taxa que você escolheu continua escolhida.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-309 · 100% de entrada não tem parcela

No portal do fornecedor, responda uma cotação com **100%** de entrada **e** 5 parcelas.

**Esperado:** o portal **recusa** e explica que com 100% de entrada não há parcelas.
Respondendo só com 100% de entrada, sem parcelas, ele aceita normalmente.

> O sistema aceitou essa combinação uma vez. O prazo médio leu aquilo como "à vista" e
engoliu as cinco parcelas sem avisar ninguém.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-310 · A compra que estoura a alçada volta para assinar

1. Abra uma solicitação com valor **estimado baixo** — algo que o gestor aprove sozinho.
2. Aprove com **uma** assinatura só.
3. Leve para cotação e faça o fornecedor responder com um preço **bem mais alto**, que
   caia na faixa seguinte da alçada.
4. Escolha o vencedor e clique em **Gerar pedidos de compra**.

**Esperado:** o sistema **recusa**. A mensagem diz qual solicitação, quanto foi estimado,
quanto fechou, quantos por cento acima, e **quem precisa assinar agora**. Nenhum pedido
foi criado.

5. Vá em **Solicitações** e abra aquela.

**Esperado:** ela está de volta em **Aguardando aprovação**, agora valendo o preço real.
No **Histórico** há uma linha explicando por quê. As assinaturas anteriores **sumiram** —
elas foram dadas sobre outro valor.

6. Assine com quem a faixa nova exige e volte à equalização.

**Esperado:** suas escolhas continuam marcadas, e agora **Gerar pedidos** funciona.

> Este era o único buraco de controle do sistema: a alçada era decidida uma vez, pela
estimativa, e nunca mais conferida. Quem assinava R$ 1.900 autorizava, na prática,
qualquer valor.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-311 · Variação normal de preço NÃO trava a compra

Repita o CT-310, mas com o fornecedor fechando **só um pouco acima** do estimado — até
20% — ou fechando **mais barato**.

**Esperado:** os pedidos são gerados normalmente, sem aviso nenhum. Fechar mais barato
nunca trava: quem assinou tinha poder de sobra.

> Travar por qualquer centavo faria o comprador achar o sistema chato e procurar jeito de
contorná-lo. A tolerância existe para a regra ser respeitada.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-312 · A solicitação fecha quando o material chega

Leve uma compra até o recebimento e receba **só parte** dela.

**Esperado:** abra a solicitação que originou o pedido. Ela continua **Em cotação**, e o
histórico ganha uma linha dizendo que chegou parte e que ainda falta item.

Agora receba o resto.

**Esperado:** a solicitação passa para **Atendida**, com selo verde, e o histórico diz
*"Tudo que foi pedido chegou e foi conferido no almoxarifado"*.

> Antes disso, a solicitação ficava "Em cotação" para sempre — o material chegava, virava
nota e virava conta paga, e a tela de quem pediu não mudava.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-313 · "É o que eu pedi"

Na solicitação **Atendida**, entre como **quem a abriu**.

**Esperado:** aparece o botão azul **✓ É o que eu pedi**. Clicando, o histórico ganha a
linha da conferência com nome e hora, e o botão some — não dá para validar duas vezes.

Entre como outra pessoa que não abriu a solicitação e não supervisiona.

**Esperado:** o botão não aparece. E se a solicitação ainda não estiver atendida, ele
também não aparece.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-314 · Serviço não vira saldo de estoque

Cadastre um item do tipo **Serviço** (ex.: *Instalação elétrica — ponto*), compre-o junto
com um material qualquer e receba o pedido inteiro.

**Esperado:** em **Estoque**, o material aparece com saldo; o serviço **não aparece**, nem
na lista nem no extrato de movimentos. A conferência do serviço foi registrada
normalmente no recebimento.

> Serviço no estoque apareceria depois no relatório de **Estoque parado** como dinheiro
encostado num item que não existe fisicamente.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-315 · O engenheiro vê a equalização, mas não decide

Entre com uma conta que tenha **só a função Engenheiro** e abra **Cotações**.

**Esperado:** ele entra na lista, abre o pacote e **abre o mapa comparativo**, com as
condições comerciais. Mas **não vê** os botões *Aceitar todos os melhores preços*,
*Salvar escolhas*, *Última chamada* nem *Gerar pedidos de compra*.

Entre como **Almoxarife**.

**Esperado:** Cotações não aparece no menu dele.

> O fluxo da Porto Inc. diz que a equalização é conferida por comprador, solicitante e
engenheiro juntos — é ali que se checa se o que foi cotado atende à especificação. Antes,
só o comprador entrava.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---
## CT-316 · Abrir a cotação NÃO manda mensagem

Monte um pacote, convide fornecedores e clique em **Abrir cotação**.

**Esperado:** a mensagem diz *"Pacote aberto. Agora convide os fornecedores pelo WhatsApp
ou por e-mail"*. Em **Avisos → WhatsApp → Histórico**, **não aparece nada** referente a
essa cotação — nem enviado, nem bloqueado.

> Antes, abrir mandava o convite sozinho. Ninguém espera que abrir faça algo sair da
empresa, e foi assim que o envio passou tempo pulando a trava de autorizados.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-317 · A confirmação mostra quem vai receber

Na cotação aberta, clique em **Convidar pelo WhatsApp**.

**Esperado:** abre uma janela com **a lista dos convidados**, cada um com o telefone.
Fornecedor sem WhatsApp cadastrado aparece como *"sem WhatsApp cadastrado"*. Com o modo
de teste ligado, há um aviso amarelo explicando que só recebe quem está liberado.

O botão diz **Enviar 2 convites** — com o número. Clicando em **Cancelar**, ou em Esc,
**nada é enviado**.

Repita em **Convidar por e-mail**: a lista mostra os e-mails.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-318 · A confirmação do pedido avisa do anexo

Em um pedido, clique em **Mandar pelo WhatsApp**.

**Esperado:** a janela mostra o fornecedor, o telefone, e a linha *"Vai com o PDF do
pedido em anexo"*.

Se o fornecedor não tiver WhatsApp cadastrado, a janela diz que **não há para quem
mandar** e o botão de enviar fica desligado.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-319 · A lista diz quantas existem, não quantas mostrou

Entre em **Solicitações** (a conta `porto@dev.com` enxerga todas).

**Esperado:** acima da lista, uma frase do tipo *"Mostrando 1 a 20 de 68
solicitações"*. A tabela tem **20 linhas**, e o número do fim da frase é o total de
verdade.

> Antes a frase era *"20 solicitações listadas"* — o tamanho do que chegou. Com 347 no
> banco ela dizia 200, e a solicitação 201 não aparecia em tela nenhuma do sistema.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-320 · Dá para ver que mudou de página

Em **Solicitações**, role até o fim e clique no **2**.

**Esperado:** três coisas de uma vez:

1. A tela **sobe** até o começo da lista
2. As linhas ficam **apagadinhas** por um instante, e as novas entram
3. A frase em cima passa a dizer *"Mostrando 21 a 40 de 68"*

Os números das solicitações têm de ser **outros**, não os mesmos da página 1.

> O dono do sistema clicou no 2 e perguntou *"será que eu fui para a próxima página?"*. A
> confirmação existia, mas estava no rodapé: depois do clique ela ficava fora de vista.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-321 · As setas duplas vão ao começo e ao fim

Em **Solicitações**, clique em **»** (duas setas para a direita).

**Esperado:** vai para a **última** página. Lá, o **»** e o **›** ficam desligados, e o
**«** e o **‹** ligados. Clicando em **«**, volta para a página 1 e a situação se inverte.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-322 · Filtrar volta para a página 1

Em **Solicitações**, vá para a página 3. Agora escolha **Situação → Rascunho**.

**Esperado:** a lista volta para a **página 1** do filtro novo. Ela **não** fica vazia
por estar numa página que não existe mais.

> Sem isso: quem está na página 7 e filtra cai numa página 7 que não existe naquele
> filtro, vê a lista vazia e conclui que não há rascunho nenhum.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-323 · Lista curta não mostra botão de página

Entre em **Locação** (ou outra lista com poucas linhas).

**Esperado:** a frase em cima diz quantas são — *"3 locações"* —, e **não há** botões de
página embaixo. Barra com uma página só é moldura: não leva a lugar nenhum.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-324 · As dez listas que paginam

Passe por todas e confira que **cada uma** tem a frase da contagem em cima:

| Tela | Onde |
|---|---|
| Solicitações | menu **Solicitações** |
| Cotações | menu **Cotações** |
| Pedidos | menu **Pedidos** |
| Entregas conferidas | **Recebimento**, lista de baixo |
| Extrato do estoque | **Estoque → Extrato** |
| Notas fiscais | **Financeiro → Notas** |
| Contas a pagar | **Financeiro**, tabela **Parcelas** |
| Locação | menu **Locação** |
| Materiais | **Cadastros → Materiais** |
| Fornecedores | **Cadastros → Fornecedores** |

**Esperado:** as dez mostram a contagem. Onde houver mais de 20 linhas, aparecem também
os botões de página.

> As **filas de trabalho** ficaram de fora de propósito: a fila de aprovação, os itens
> esperando cotação e os pedidos esperando entrega. Fila que cresce é fila parada — ali o
> número grande é o problema a resolver, não uma lista para navegar.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-325 · No celular a barra cabe numa linha

Abra **Solicitações** no modo celular (**Ctrl+Shift+M**), com 420px de largura.

**Esperado:** a barra de páginas cabe em **uma linha**, sem quebrar e sem rolar de lado.
Ela mostra menos números que no computador — a primeira, a atual e a última.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-326 · A tela inicial conta a empresa inteira

Entre com `porto@dev.com` e olhe os cartões do **Início**.

**Esperado:** o aviso do topo diz que **os números são da empresa inteira**, e não de uma
pessoa. Cada cartão tem o número, uma frase explicando, e abre a tela onde ele mora.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-327 · "Abaixo do mínimo" bate com o Estoque

Anote o número do cartão **Abaixo do mínimo**. Agora vá em **Estoque** e, para cada
almoxarifado, conte as linhas marcadas como abaixo do mínimo. Some.

**Esperado:** os dois números são iguais.

> O cartão conta **saldos**, não materiais: se o mesmo material estiver no vermelho em
> dois almoxarifados, ele conta duas vezes. É de propósito — é a mesma conta que a tela
> de Estoque faz.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-328 · "Contas vencidas" bate com o Financeiro

Anote o cartão **Contas vencidas**. Vá em **Financeiro**, filtre **Mostrar → Vencidas** e
olhe a contagem acima da tabela.

**Esperado:** o mesmo número nos dois lugares.

Repita com **Vence em 7 dias** e o filtro **Vencem esta semana**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-329 · A conta que vence hoje não aparece como vencida

Este é o caso que já quebrou uma vez. Deixe uma parcela vencendo **hoje** e abra o Início
**no fim da tarde ou à noite**.

**Esperado:** ela aparece em **Vence em 7 dias**, nunca em **Vencidas**.

> O servidor roda num fuso diferente do nosso. Se quem decidisse "que dia é hoje" fosse o
> banco, toda noite a conta de amanhã apareceria como vencida.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-330 · Ninguém aprova o próprio pedido, nem no contador

Entre como **gestor** (ou outra conta que aprove), abra uma solicitação você mesmo e
envie-a para aprovação — de um valor que exija a sua função.

**Esperado:** o cartão **Esperando sua assinatura** **não** aumenta. Em **Aprovações**,
a solicitação ou não aparece, ou aparece sem botão de decidir.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-33 · Funciona no celular

1. Aperte **F12** para abrir as ferramentas do navegador
2. Clique no ícone de celular (ou **Ctrl+Shift+M**)
3. Escolha um aparelho, como iPhone ou Galaxy
4. Navegue por 4 ou 5 telas

**Esperado:**

- O menu vira uma gaveta, aberta pelo botão **☰**
- Tocar fora da gaveta fecha ela
- **Nenhuma** tela rola para os lados
- Os botões são grandes o suficiente para o dedo
- As tabelas rolam na horizontal dentro do quadro, sem quebrar a página

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-34 · Modo claro e modo escuro

1. No Windows: **Configurações → Personalização → Cores**
2. Alterne entre claro e escuro
3. Recarregue o sistema

**Esperado:** o sistema acompanha. Nos **dois** modos, todo texto continua legível — nada de cinza claro sobre branco ou azul escuro sobre preto.

Olhe com atenção os **avisos coloridos** (verde de sucesso, amarelo de atenção, vermelho de erro, azul de informação) e as **etiquetas de situação**: nos dois modos o texto deles tem que se destacar bem do fundo colorido.

> A régua é a **WCAG AA**: 4,5:1 de contraste para texto normal. Todas as combinações do sistema estão hoje entre **5,4:1 e 7,7:1**.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-35 · Navegação só pelo teclado

1. Recarregue a página e **não toque no mouse**
2. Use só **Tab**, **Shift+Tab**, **Enter** e **Espaço**

**Esperado:**

- O primeiro **Tab** revela o atalho "Pular para o conteúdo"
- Você **sempre enxerga** onde está — um contorno azul marca o item em foco
- Dá para abrir o menu, entrar numa tela e preencher um formulário inteiro

> Se você perdeu de vista onde estava em algum momento, isso é uma falha.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-36 · A cor nunca informa sozinha

1. Olhe as etiquetas de situação pelo sistema: **Ativo**, **Simulado**, **Em andamento**, **Todas assinam**

**Esperado:** toda etiqueta colorida tem **um ícone e um texto** junto. Uma pessoa que não distingue cores consegue usar o sistema normalmente.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-37 · O sistema avisa que está trabalhando

1. Entre em várias telas seguidas, prestando atenção ao momento em que os dados chegam

**Esperado:** aparece um indicador girando com "Carregando...". **Nunca** uma tela em branco sem explicação.

2. Clique num botão de salvar

**Esperado:** o botão muda para "Salvando..." e fica desabilitado, impedindo clique duplo.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-38 · Lista vazia explica o que fazer

1. Em **Materiais e serviços**, busque por `zzzzzz`

**Esperado:** não é uma tela em branco. Aparece "Nenhum item encontrado" com uma orientação do que fazer.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

## CT-39 · Quando a API cai

1. No terminal: `docker compose stop api`
2. No sistema, clique em qualquer tela

**Esperado:** mensagem clara de que não foi possível falar com o servidor, com um botão **Tentar novamente** — e não uma tela quebrada ou um erro técnico.

3. Religue: `docker compose start api`
4. Espere uns 20 segundos e clique em **Tentar novamente**

**Esperado:** volta a funcionar sem precisar recarregar a página.

`Resultado:` <span class="marcar">☐ OK ☐ FALHOU ☐ DÚVIDA</span>

---

# 17. Folha de resultados

| Caso | O que testa | Resultado |
|---|---|---|
| CT-01 | Entrar com dados corretos | |
| CT-02 | Senha errada | |
| CT-03 | E-mail inexistente | |
| CT-04 | Bloqueio por tentativas | |
| CT-05 | Continuar conectado | |
| CT-06 | Menu muda por pessoa | |
| CT-07 | Bloqueio ao forçar endereço | |
| CT-08 | Pessoa com duas funções | |
| CT-09 | Cadastrar usuário | |
| CT-10 | Senha fraca recusada | |
| CT-11 | E-mail repetido recusado | |
| CT-12 | Desativar derruba sessão | |
| CT-13 | Admin não se desativa | |
| CT-14 | Trocar própria senha | |
| CT-15 | Ordem dos cadastros | |
| CT-16 | Cadastrar família | |
| CT-17 | Código de barras errado | |
| CT-18 | Código de barras repetido | |
| CT-19 | Serviço sem código de barras | |
| CT-20 | Os três códigos do material | |
| CT-21 | Filtrar catálogo | |
| CT-22 | CNPJ inválido | |
| CT-23 | Fornecedor sem família | |
| CT-24 | Filtrar fornecedor por família | |
| CT-25 | Obra cria almoxarifado | |
| CT-26 | Orçamento e total | |
| CT-27 | Importar planilha | |
| CT-28 | Planilha com defeito | |
| CT-29 | Reimportar não duplica | |
| CT-30 | Simulador de alçada | |
| CT-31 | Aviso de furo nas faixas | |
| CT-32 | Só consulta, sem editar | |
| CT-33 | Funciona no celular | |
| CT-34 | Modo claro e escuro | |
| CT-35 | Navegação por teclado | |
| CT-36 | Cor não informa sozinha | |
| CT-37 | Aviso de carregamento | |
| CT-38 | Lista vazia explicada | |
| CT-39 | Quando a API cai | |
| CT-40 | Abrir solicitação | |
| CT-41 | Unidade vem preenchida | |
| CT-42 | Linha de orçamento sugerida | |
| CT-43 | Total estimado soma | |
| CT-44 | Sem item não salva | |
| CT-45 | Primeira compra exige especificação | |
| CT-46 | Quem aprova aparece antes | |
| CT-47 | Enviada não pode mudar | |
| CT-48 | Cada um vê o que solicitou | |
| CT-49 | PDF da solicitação | |
| CT-50 | Histórico registra tudo | |
| CT-51 | Cancelar solicitação | |
| CT-52 | Fila mostra só o que é seu |  |
| CT-53 | Os três números do topo |  |
| CT-54 | Aviso de prazo |  |
| CT-55 | Aprovação com uma assinatura |  |
| CT-56 | Aprovação com duas assinaturas |  |
| CT-57 | Ninguém aprova o próprio pedido |  |
| CT-58 | Devolver exige motivo |  |
| CT-59 | Solicitante corrige e reenvia |  |
| CT-60 | Reenvio zera assinaturas |  |
| CT-61 | Aviso ao reprovar |  |
| CT-62 | Reprovação derruba aprovação |  |
| CT-63 | Assinaturas registradas |  |
| CT-64 | Nomes de função legíveis |  |
| CT-65 | Quem não aprova não vê a tela |  |
| CT-66 | Só entra o que foi aprovado |  |
| CT-67 | Filtrar por família |  |
| CT-68 | Aviso ao misturar famílias |  |
| CT-69 | Criar o pacote |  |
| CT-70 | Item não entra em dois pacotes |  |
| CT-71 | Fornecedores sugeridos |  |
| CT-72 | Bloqueio ao abrir sem fornecedor |  |
| CT-73 | Abrir a cotação |  |
| CT-74 | Não mexe depois de aberto |  |
| CT-75 | O portal do fornecedor |  |
| CT-76 | Fornecedor não vê concorrentes |  |
| CT-77 | Responder a cotação |  |
| CT-78 | "Não tenho este item" |  |
| CT-79 | Item sem preço é bloqueado |  |
| CT-80 | Revisar a resposta |  |
| CT-81 | Link inválido |  |
| CT-82 | O comprador acompanha |  |
| CT-83 | Encerrar derruba os links |  |
| CT-84 | O portal no celular |  |
| CT-85 | Chegar na equalização |  |
| CT-86 | O mapa comparativo |  |
| CT-87 | O frete entra na conta da mistura |  |
| CT-88 | Escolher item a item |  |
| CT-89 | Aceitar todos os melhores preços |  |
| CT-90 | As escolhas ficam salvas |  |
| CT-91 | Última chamada não revela preço |  |
| CT-92 | A última chamada reabre a cotação |  |
| CT-93 | Bloqueio com item sem escolha |  |
| CT-94 | Gerar os pedidos |  |
| CT-95 | Não gera duas vezes |  |
| CT-96 | A tela de Pedidos e o PDF |  |
| CT-97 | Quem não é comprador não entra |  |
| CT-98 | O almoxarife vê a tela certa |  |
| CT-99 | Achar o pedido digitando só o número |  |
| CT-100 | Número que não existe |  |
| CT-101 | Texto que não é número |  |
| CT-102 | Lista de pedidos esperando entrega |  |
| CT-103 | Bipar o material |  |
| CT-104 | Bipar material de outro pedido |  |
| CT-105 | Não recebe mais do que o saldo |  |
| CT-106 | Ressalva sem motivo é recusada |  |
| CT-107 | Entrega parcial |  |
| CT-108 | Devolução não baixa o saldo |  |
| CT-109 | Preencher com o saldo |  |
| CT-110 | O pedido fecha quando tudo chega |  |
| CT-111 | Nada marcado |  |
| CT-112 | Histórico da entrega |  |
| CT-113 | Marcar o pedido como enviado |  |
| CT-114 | Rascunho não trava a entrega |  |
| CT-115 | A conferência no celular |  |
| CT-116 | O recebimento virou saldo sozinho |  |
| CT-117 | O que foi devolvido não entrou |  |
| CT-118 | Os quatro cartões |  |
| CT-119 | Retirar material |  |
| CT-120 | Retirada sem destino é recusada |  |
| CT-121 | Não dá para tirar o que não existe |  |
| CT-122 | A retirada não mexe no custo médio |  |
| CT-123 | Contagem de inventário |  |
| CT-124 | Ajuste sem explicação é recusado |  |
| CT-125 | Contagem que bate não vira movimento |  |
| CT-126 | Transferir entre almoxarifados |  |
| CT-127 | Aviso de ponto de pedido |  |
| CT-128 | Montar a reposição |  |
| CT-129 | Abrir a solicitação de reposição |  |
| CT-130 | O extrato conta a história |  |
| CT-131 | Nada é apagado |  |
| CT-132 | Quem vê e quem mexe |  |
| CT-133 | O estoque no celular |  |
| CT-134 | A tela de notas fiscais |  |
| CT-135 | Lançar nota que bate com o pedido |  |
| CT-136 | Nota acima do pedido vira pendência |  |
| CT-137 | Nota abaixo é entrega parcial |  |
| CT-138 | A mesma nota não entra duas vezes |  |
| CT-139 | A chave de acesso se confere sozinha |  |
| CT-140 | Importar o XML da nota |  |
| CT-141 | Arquivo que não é nota |  |
| CT-142 | Gerar as parcelas |  |
| CT-143 | A soma das parcelas bate com a nota |  |
| CT-144 | Não gera parcelas duas vezes |  |
| CT-145 | Os quatro cartões do financeiro |  |
| CT-146 | Cada parcela diz em que pé está |  |
| CT-147 | Dar baixa |  |
| CT-148 | Não paga duas vezes |  |
| CT-149 | Filtros |  |
| CT-150 | Exportar para o Excel |  |
| CT-151 | Cancelar nota com parcela paga |  |
| CT-152 | Cancelar nota sem pagamento |  |
| CT-153 | Quem entra no financeiro |  |
| CT-154 | O financeiro no celular |  |
| CT-155 | A trava aparece antes de tudo |  |
| CT-156 | Bloqueio de número fora da lista |  |
| CT-157 | O bloqueio fica registrado |  |
| CT-158 | Liberar o seu número |  |
| CT-159 | Agora o envio passa |  |
| CT-160 | Tirar da lista bloqueia de novo |  |
| CT-161 | O número nunca aparece inteiro |  |
| CT-162 | Número repetido e inválido |  |
| CT-163 | Só o administrador entra |  |
| CT-164 | Convites de cotação |  |
| CT-165 | Pedido de compra com PDF |  |
| CT-166 | Conexão de verdade (Baileys) |  |
| CT-167 | Mensagem de verdade no celular |  |
| CT-168 | Reiniciar não pede QR de novo |  |
| CT-169 | Desconectar apaga a sessão |  |
| CT-170 | O QR nunca aparece no log |  |
| CT-171 | Voltar para o modo simulado |  |
| CT-172 | Os quatro indicadores de gestão |  |
| CT-173 | A frase do próximo vencimento |  |
| CT-174 | O gráfico de fluxo de caixa |  |
| CT-175 | O pago conta no mês em que saiu |  |
| CT-176 | A rosca da carteira |  |
| CT-177 | O medidor de pontualidade |  |
| CT-178 | Os rankings |  |
| CT-179 | Os filtros não mexem nos gráficos |  |
| CT-180 | Movimento reduzido |  |
| CT-181 | Os gráficos no leitor de tela |  |
| CT-182 | O painel sem dado nenhum |  |
| CT-183 | Dados ao passar o mouse (PC) |  |
| CT-184 | A dica some ao tirar o mouse |  |
| CT-185 | Dados ao tocar (celular) |  |
| CT-186 | Dados pelo teclado |  |
| CT-187 | Tudo alinhado |  |
| CT-188 | Quem pode entrar |  |
| CT-189 | As cinco abas |  |
| CT-190 | A aba fica no endereço |  |
| CT-191 | O orçamento bate com a obra escolhida |  |
| CT-192 | Previsto, comprado e saldo fecham |  |
| CT-193 | O alerta começa em 80%, não no estouro |  |
| CT-194 | Compra sem apontamento aparece, não some |  |
| CT-195 | Economia e ganho na disputa são coisas diferentes |  |
| CT-196 | Cotação que fechou acima do estimado |  |
| CT-197 | Quem não respondeu derruba a taxa |  |
| CT-198 | O fornecedor é medido pelo prazo que ELE prometeu |  |
| CT-199 | Com poucas entregas não há veredito |  |
| CT-200 | Fornecedor convidado que nunca entregou |  |
| CT-201 | O gargalo é apontado |  |
| CT-202 | Só conta quem já passou |  |
| CT-203 | Filtrar por obra muda os tempos |  |
| CT-204 | A rosca fecha 100% |  |
| CT-205 | Preço médio confere |  |
| CT-206 | O mesmo material comprado duas vezes é uma linha só |  |
| CT-207 | A planilha abre certo no Excel |  |
| CT-208 | Cada aba baixa a sua planilha |  |
| CT-209 | A planilha respeita o filtro |  |
| CT-210 | Ver os números por trás (PC) |  |
| CT-211 | Ver os números por trás (celular) |  |
| CT-212 | As abas pelo teclado |  |
| CT-213 | A tela no celular |  |
| CT-214 | A cor não informa sozinha |  |
| CT-215 | Relatório sem dado nenhum |  |
| CT-216 | O relatório não inventa gargalo |  |
| CT-217 | Os números batem com as outras telas |  |
| CT-218 | Quem entra e quem contrata |  |
| CT-219 | O alerta aparece em cima de tudo |  |
| CT-220 | Os quatro cartões |  |
| CT-221 | A conta da diária confere |  |
| CT-222 | Período começado é período cobrado |  |
| CT-223 | O custo do atraso é só a diferença |  |
| CT-224 | O aviso vem antes de vencer |  |
| CT-225 | "O que fazer agora" só lista o que precisa de ação |  |
| CT-226 | Registrar uma locação avulsa |  |
| CT-227 | Locação vinda de um pedido preenche sozinha |  |
| CT-228 | Um pedido vira um contrato só |  |
| CT-229 | Devolução antes do início é recusada |  |
| CT-230 | Devolver para o relógio |  |
| CT-231 | Não devolve duas vezes |  |
| CT-232 | O que já aconteceu não se cancela |  |
| CT-233 | Cancelar exige motivo |  |
| CT-234 | Os filtros |  |
| CT-235 | Baixar em PDF e em Word |  |
| CT-236 | A tela no celular |  |
| CT-237 | A cor não informa sozinha |  |
| CT-238 | Locação sem nada registrado |  |
| CT-239 | A tela de Início acompanha o sistema |  |
| CT-240 | A barra de filtros é igual em toda tela |  |
| CT-241 | Enter busca |  |
| CT-242 | Todo botão cabe no dedo |  |
| CT-243 | Tudo que é clicável reage ao mouse |  |
| CT-244 | O cursor diz o que a coisa faz |  |
| CT-245 | O teclado enxerga onde está |  |
| CT-246 | Excesso de requisição não vira "erro do servidor" |  |
| CT-247 | O menu fica parado ao rolar |  |
| CT-248 | O menu está dividido em blocos |  |
| CT-249 | Bloco vazio some junto com o título |  |
| CT-250 | No celular o menu continua confortável para o dedo |  |
| CT-251 | A barra de rolagem do menu combina com o sistema |  |
| CT-252 | Instalação nova deixa alguém entrar |  |
| CT-253 | A cópia de segurança volta inteira |  |
| CT-254 | As telas têm prova automática |  |
| CT-255 | O e-mail não sai para quem não está na lista |  |
| CT-256 | O e-mail sai depois de liberar |  |
| CT-257 | Convite e pedido saem pelos dois canais |  |
| CT-258 | O PDF da nota fiscal |  |
| CT-259 | Guardar o arquivo que o fornecedor mandou |  |
| CT-260 | O tema é escolha sua, e o sistema lembra |  |
| CT-261 | Toda tela diz onde você está e como voltar |  |
| CT-262 | O menu de ações da tabela |  |
| CT-263 | Cancelar uma nota pergunta antes |  |
| CT-264 | A seta dos campos de escolha |  |
| CT-265 | O formulário vem até você |  |
| CT-266 | Ele pergunta antes de jogar fora o que você digitou |  |
| CT-267 | A tela inicial mostra o que precisa de você |  |
| CT-268 | Cada função vê o que pode resolver |  |
| CT-269 | Os dois temas continuam legíveis |  |
| CT-270 | A explicação do número não cobre o vizinho |  |
| CT-271 | Os números concordam com o substantivo |  |
| CT-272 | A dica dos gráficos não fica cortada |  |
| CT-273 | O campo tem o tamanho do que recebe |  |
| CT-274 | Alçadas sem faixa configurada |  |
| CT-275 | Os cartões de lista estão alinhados por dentro |  |
| CT-276 | No celular, a tabela vira cartão |  |
| CT-277 | Os números no celular |  |
| CT-278 | O foco aparece nas opções de escolha |  |
| CT-279 | Os ícones são desenhos, não emojis |  |
| CT-280 | O filtro de período do fluxo de caixa |  |
| CT-281 | Não dá para avançar para o futuro |  |
| CT-282 | O vencido continua vencido em qualquer período |  |
| CT-283 | O gráfico no celular, de três em três |  |
| CT-284 | O zoom só aumenta |  |
| CT-285 | Nenhuma tela desliza para o lado |  |
| CT-286 | O botão azul fica sempre no mesmo lugar |  |
| CT-287 | Criar abre janela, e ela fecha de quatro jeitos |  |
| CT-288 | A janela pergunta antes de descartar |  |
| CT-289 | O filtro vale na hora, sem botão |  |
| CT-290 | Vindo de Aprovações, o caminho diz Aprovações |  |
| CT-291 | Toda tabela tem nome nas colunas |  |
| CT-292 | A Conferência tem uma navegação, não duas |  |
| CT-293 | O selo de situação fica ao lado do título |  |
| CT-294 | O botão de buscar fica colado no campo |  |
| CT-295 | O saldo traz a conta inteira |  |
| CT-296 | Os códigos não parecem riscados |  |
| CT-297 | O documento sai com a data de hoje, mesmo à noite |  |
| CT-298 | Nenhum rótulo em CAIXA ALTA nos arquivos |  |
| CT-299 | O rodapé diz de quantas folhas o papel é |  |
| CT-300 | Contas a pagar: CNPJ e situação legíveis |  |
| CT-301 | O espelho da nota avisa que não é a nota |  |
| CT-302 | O orçamento mostra o dinheiro já prometido |  |
| CT-303 | O selo de dependência de fornecedor |  |
| CT-304 | Duas cargas do mesmo pedido são duas entregas |  |
| CT-305 | Estoque parado: o que está encostado |  |
| CT-306 | Estoque parado: a conta do dinheiro |  |
| CT-307 | O preço da última compra na equalização |  |
| CT-308 | O prazo de pagamento vira dinheiro |  |
| CT-309 | 100% de entrada não tem parcela |  |
| CT-310 | A compra que estoura a alçada volta para assinar |  |
| CT-311 | Variação normal de preço NÃO trava a compra |  |
| CT-312 | A solicitação fecha quando o material chega |  |
| CT-313 | "É o que eu pedi" |  |
| CT-314 | Serviço não vira saldo de estoque |  |
| CT-315 | O engenheiro vê a equalização, mas não decide |  |
| CT-316 | Abrir a cotação NÃO manda mensagem |  |
| CT-317 | A confirmação mostra quem vai receber |  |
| CT-318 | A confirmação do pedido avisa do anexo |  |

**Total: 291 casos** · Etapas cobertas: 0 a 12, mais a Revisão de design e responsividade

---

# 18. Testes automatizados

Estes rodam sozinhos e conferem o que está por baixo da tela.

## Rodando

```bash
docker compose exec api npm test    # as regras — cerca de 85 segundos
docker compose exec web npm test    # as telas — cerca de 20 segundos
```

## O que eles cobrem

| Grupo | Quantidade | O que confere |
|---|---|---|
| **Unidade** | 355 | CNPJ, chave da NF-e, leitura de XML, parcelas, senha, planilha, solicitação, aprovação, cotação, equalização, recebimento, estoque, WhatsApp, as contas dos relatórios e as da locação |
| **Integração** | 325 | Login, permissões, cadastros, alçadas, solicitações, aprovações, cotações, portal, equalização, pedidos, recebimento, estoque, fiscal, WhatsApp, relatórios e locação |
| **Telas** | 112 | Quem vê o quê no menu, solicitação que não duplica, alçada na aprovação, custo do atraso na locação, escolha entre PDF e Word |

> As provas de tela rodam num navegador de mentira, em memória. Elas conferem **o que a tela faz**, não como ela parece. Aparência é medida pela régua em `scripts/auditoria-ui.mjs`.

Os testes de integração rodam num **banco separado** (`portoink_test`). Eles nunca tocam nos dados de desenvolvimento.

## Rodando só uma parte

```bash
docker compose exec api npm run test:unidade      # rápido, sem banco
docker compose exec api npm run test:integracao   # com banco
```

## Sempre pelo npm — nunca o arquivo solto

> **Os testes de integração APAGAM todos os dados antes de rodar.** É por isso que eles usam um banco separado (`portoink_test`).
>
> Quem aponta para esse banco é o `npm`. Rodar um arquivo direto, assim:
>
> ```bash
> docker compose exec api npx tsx --test testes/recebimento.test.ts   # NÃO faça isso
> ```
>
> deixa o alvo no banco de **desenvolvimento** — e leva embora as obras, solicitações e pedidos que você estava usando para testar.
>
> Desde a versão 0.8.0 existe uma trava: antes de apagar qualquer coisa, o sistema confere o nome do banco e recusa se ele não terminar em `_test`. A mensagem é:
>
> ```
> RECUSADO: os testes apagam dados e este banco nao e de teste (portoink).
> Rode com "npm test", que aponta para o portoink_test.
> ```

## Se você perder os dados de desenvolvimento

```bash
docker compose exec api npm run seed
```

Isso recria as contas, o catálogo, os fornecedores e as obras. As solicitações e cotações de teste você refaz pela tela — é justamente o que este guia ensina.

## Quando algum falhar

A saída mostra o nome do teste e o que era esperado. Exemplo:

```
✖ recusa CNPJ inválido
  Expected: 400
  Actual:   201
```

Isso significa: o sistema **aceitou** um CNPJ que deveria ter recusado.

> Um teste que falha é sempre informação útil — ou o sistema quebrou, ou a regra mudou e o teste precisa ser atualizado.
