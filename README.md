# Porto Inc. — Sistema de Compras e Almoxarifado

Sistema de gestão de compras e almoxarifado para construtora, baseado no fluxo BPMN
fornecido pela empresa.

## Como subir

```bash
cp .env.example .env     # ajuste as senhas
docker compose up -d
```

Depois acesse **http://localhost:5173**.

## Estrutura

```
.
├── docker-compose.yml         # As três peças e seus limites de recurso
├── .env                       # Senhas e escolha dos adaptadores (não versionado)
│
├── backend/                   # API em Node + Fastify + Prisma
│   ├── prisma/                # Modelo de dados e migrações
│   └── src/
│       ├── config/            # Leitura e validação do .env
│       ├── plugins/           # Conexão com o banco
│       ├── rotas/             # Endpoints HTTP
│       └── integracoes/       # ← As "tomadas" das integrações externas
│           ├── whatsapp/
│           ├── fiscal/        # NF-e / SEFAZ
│           ├── gtin/          # Código de barras / GS1
│           └── pagamento/
│
├── frontend/                  # Interface em React + Vite
│   └── src/
│       ├── componentes/       # Peças reutilizáveis
│       ├── estilos/           # tokens.css = sistema de design
│       ├── paginas/
│       └── servicos/          # Chamadas à API
│
├── docs/
│   ├── 01-analise-fluxo-compras.md
│   └── tutorial/              # Manual do usuário (Markdown + PDF)
│
└── scripts/
    └── gerar-tutorial.mjs     # Gera o PDF do manual
```

## Integrações

As quatro integrações externas usam o padrão **porta e adaptador**: o sistema conhece
apenas o contrato (a porta), nunca o provedor. Trocar de provedor é mudar uma linha
no `.env`.

| Variável | Valores | Padrão |
|---|---|---|
| `WHATSAPP_ADAPTER` | `mock`, `baileys`, `cloud-api` | `mock` |
| `FISCAL_ADAPTER` | `mock`, `sefaz` | `mock` |
| `GTIN_ADAPTER` | `mock`, `gs1` | `mock` |
| `PAGAMENTO_ADAPTER` | `mock`, `cnab`, `open-finance` | `mock` |

Com `mock`, **nada sai do sistema**: nenhuma mensagem é enviada, nenhum pagamento é feito.

## Limites de recurso

Cada container está limitado a **1 GB de RAM e 1 núcleo**, igual ao servidor de destino.
Para acompanhar o consumo real:

```bash
docker stats
```

## Testes

```bash
docker compose exec api npm test              # todos (75 testes, ~7s)
docker compose exec api npm run test:unidade  # só os de lógica pura
```

Os testes de integração usam o banco `portoink_test`, separado dos dados de desenvolvimento.

## Documentos

```bash
cd scripts && npm run pdfs
```

| Documento | Arquivo |
|---|---|
| Manual do usuário | `docs/tutorial/Tutorial-PortoInc.pdf` |
| Guia de teste manual | `docs/testes/Guia-Teste-Manual-PortoInc.pdf` |
