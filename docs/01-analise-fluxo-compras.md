# Análise do Fluxo de Compras — Porto Inc.

> Documento de trabalho do Tech Lead. Base: `Fluxo de compras - Porto Inc.pdf` (BPMN Bizagi, v1.0) + `Porto Inc - Anotações de Reunião.pdf`.
> Data: 2026-09-21

## 1. Papéis identificados

| Papel | Responsabilidade principal | Pessoa citada na reunião |
|---|---|---|
| Solicitante | Abre solicitação, valida material recebido, solicita retirada | qualquer funcionário |
| Gestor de obra | Consultado na solicitação, participa da aprovação | Bras (mestre de obra) |
| Comprador | Monta BID, cotação, equalização, pedido, contas a pagar | Neilma |
| Engenheiro | Consultado na especificação e na aprovação | — |
| Fundador | Aprovação acima do limite de alçada | Washington |
| Almoxarife | Recebimento, conferência, estoque, arquivo da NF | Gilson |
| Fornecedor | Responde cotação, fornece, emite NF | externo |
| (Admin/Financeiro) | Não está no BPMN, mas aparece na reunião | Andre |

Regra confirmada: **um usuário pode acumular mais de uma função**, e as funções devem ser criáveis dentro do sistema.

## 2. O fluxo em linguagem simples

### Trilha A — Compra
1. **Solicitação** — alguém pede material/serviço. Campos obrigatórios: família, descrição (marca/qualidade/dimensões), quantidade, prazo desejado, linha do orçamento, obra.
2. **Aprovação** — engenheiro/gestor/fundador decidem. Acima de um valor limite, exige fundador.
   - Reprovado + precisa revisar → volta ao solicitante → reentra na aprovação.
   - Reprovado definitivo → processo encerrado.
3. **BID de cotação** — comprador agrupa itens aprovados e dispara para fornecedores da família correspondente, com data limite.
4. **Resposta do fornecedor** — via link com validade. Informa preço unitário, marca, modelo, prazo, frete, outros custos e condição de pagamento.
5. **Equalização** — comprador + solicitante + engenheiro conferem se o orçado atende. Se não, fornecedor revê a cotação.
6. **Última chamada** — rodada final de desconto; escolha do fornecedor item a item.
7. **Pedido** — registra o fornecedor vencedor por item e envia o pedido por e-mail/WhatsApp.
8. **Fornecimento** — fornecedor emite NF e entrega com o código do pedido.

### Trilha B — Recebimento
9. **Recebimento e conferência** (almoxarife) — bipa código de barras, compara com o pedido, lança NF, data, quantidade e se há problema.
10. **Validação** (solicitante) — confere se é o que foi pedido.
    - **Conforme** → NF arquivada em PDF, material entra no estoque (serviço não entra) → NF vai para contas a pagar.
    - **Não conforme** → ressalva na NF e devolução → estorno oficializado ao fornecedor.

### Trilha C — Estoque
11. **Retirada de material** — solicitante pede, almoxarife registra a saída.
12. **Ponto de pedido** — se o saldo ficar abaixo do mínimo, o sistema abre automaticamente uma nova solicitação (também citado como "Kanban pré-definido").

## 3. Divergências entre o BPMN e as anotações da reunião

| # | Ponto | BPMN diz | Reunião diz | Ação |
|---|---|---|---|---|
| D1 | Entrega parcial | Não existe | "comparar solicitado x chegou e alertar o que não chegou" | Modelar saldo pendente por item |
| D2 | Devolução | Termina o processo (Fim) | Texto do próprio PDF diz que volta ao recebimento | Modelar estado de pendência reentrante |
| D3 | Locação de equipamento | Não existe | "alertar itens locados no dia em que devem ser usados" | Módulo novo, fora do BPMN |
| D4 | Canal de entrada | Formulário web | "requisição pelo WhatsApp" e "pelo celular" | Definir canal oficial |
| D5 | NF em PDF | "consultada diretamente da Receita Federal" | "consultar o SEFAZ" | Tecnicamente: baixa-se o XML, o PDF (DANFE) é gerado por nós |
| D6 | Contas a pagar | Ponto final do fluxo | Andre já controla em planilha | Definir se entra no escopo |

## 4. Inconsistências dentro do próprio BPMN

| # | Onde | Problema |
|---|---|---|
| I1 | "Faz a análise de aprovação" | Limite de alçada está literalmente como "A definir limite" |
| I2 | "Solicita cotação" | Executante = Solicitante, mas a descrição diz que quem faz é o Comprador |
| I3 | "Responde cotação" | Executante = Comprador, Responsável = Fornecedor |
| I4 | "Recebimento e conferência" | Executante = Comprador, mas está na raia do Almoxarifado |
| I5 | Diagrama | Caixa "Tarefa 1" solta, sem conexão e sem descrição |
| I6 | "Última chamada" | Laço "Melhor preço definido? Não" pode repetir infinitamente |
| I7 | Aprovação | Descrita como decisão "em reunião" (coletiva), mas sistema precisa de registro individual |

## 5. Integrações externas — risco e custo

| Integração | Para quê | Risco | Recomendação |
|---|---|---|---|
| WhatsApp | Notificar e receber requisições | Alto | API Oficial (Meta Cloud) ou provedor. **Nunca** biblioteca não oficial: exige Chromium (~400 MB) e arrisca banimento |
| SEFAZ / NF-e | Conferir NF do pedido | Alto | Exige certificado digital A1 do CNPJ. Usar NFeDistribuiçãoDFe (XML) e gerar o DANFE localmente |
| GS1 | Consultar GTIN do código de barras | Médio | Serviço pago / associação. Alternativa: catálogo próprio alimentado pelo bipe |
| API bancária | Aprovar pagamento | Muito alto | Contrato, homologação e certificados. Alternativa realista: arquivo CNAB ou PIX via PSP |

## 6. Pontos em aberto para a empresa

1. Qual o **valor limite** de alçada? Há faixas (ex.: até 5k gestor, acima disso fundador)?
2. Aprovação é de **uma pessoa** ou precisa de mais de uma assinatura?
3. O estoque é **centralizado** ou **um almoxarifado por obra**?
4. De onde vem o **orçamento da obra** e suas linhas? Planilha importada?
5. **Contas a pagar** fica dentro deste sistema ou exporta para o controle do Andre?
6. O que significa **"NBR"** no item? Norma ABNT, código SINAPI ou o código interno "COD PORTO"?
7. Quantos usuários simultâneos? Quantas obras ativas? Quantos itens no catálogo?
8. Quem tem **certificado digital A1** do CNPJ e pode disponibilizá-lo?
