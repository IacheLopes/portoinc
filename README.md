# Porto Inc. — Sistema de Compras e Almoxarifado

Sistema de gestão de compras e almoxarifado para construtora, baseado no fluxo BPMN
fornecido pela empresa.

---

## Como subir, do zero

Precisa de **Docker Desktop** instalado e rodando. Nada mais — nem Node, nem
PostgreSQL na máquina.

```bash
git clone https://github.com/IacheLopes/portoinc.git
cd portoinc
cp .env.example .env     # abra e troque as duas senhas
docker compose up -d
```

A primeira subida leva alguns minutos: ela baixa as imagens, instala as
dependências, cria o banco, **aplica as migrações** e **planta os dados de
exemplo**. Para acompanhar:

```bash
docker compose logs -f api
```

Quando aparecer `Porto Inc. - API no ar na porta 3000`, abra
**http://localhost:5173**.

### A primeira entrada

A semente cria 8 contas. **A senha de todas é `admin123`.**

| E-mail | Quem é | O que vê |
|---|---|---|
| `porto@dev.com` | DEV-Porto | **tudo** — entra em qualquer tela |
| `admin@portoinc.com.br` | Administrador | administração, usuários, integrações |
| `washington@portoinc.com.br` | Washington | Fundador — aprova acima da alçada |
| `andre@portoinc.com.br` | André | Comprador — cotações e pedidos |
| `neilma@portoinc.com.br` | Neilma | Compradora e solicitante |
| `gilson@portoinc.com.br` | Gilson | Almoxarife — estoque e recebimento |
| `bras@portoinc.com.br` | Brás | Gestor de obra e solicitante |
| `engenheiro@portoinc.com.br` | Engenheiro de Obra | aprovação técnica |

Para explorar, entre com **`porto@dev.com`**: é a conta que atravessa todos os
blocos de acesso.

> **A semente só planta em banco vazio.** Depois que a empresa cadastrar as contas
> dela, reiniciar o container não traz as 8 de volta. Para zerar de propósito:
> `docker compose down -v && docker compose up -d` — isso **apaga o banco**.

### Dados de exemplo, em três níveis

```bash
# Cadastros: 10 fornecedores, 10 famílias de material, obras, usuários
docker compose exec api npm run seed

# Um fluxo pronto para demonstrar: 1 solicitação, 1 aprovação, 1 cotação
docker compose exec api npm run seed:demonstracao

# Mais movimento: aprovações, cotações e financeiro em vários estados
docker compose exec api npm run seed:situacoes
```

---

## O que já funciona, e o que ainda não

Nenhuma integração externa está ligada numa instalação nova — **nada sai do sistema
para fora** até alguém ligar de propósito. A tela **Administração → Status do
Sistema** mostra em que estado cada uma está.

| Integração | Numa instalação nova | Como se liga |
|---|---|---|
| **E-mail** | `desligado` | Administração → Comunicação → **E-mail** (servidor SMTP, usuário, senha) |
| **WhatsApp** | `mock` | `WHATSAPP_ADAPTER=baileys` no `.env`, e ler o QR Code em Comunicação → WhatsApp |
| **Assistente de IA** | `mock` | chave em `IA_API_TOKEN` ou na tela, QR do WhatsApp lido, e um grupo liberado |
| **Fiscal (NF-e)** | `mock` | depende do **certificado digital A1** do CNPJ — ainda não entregue pela empresa |
| **Pagamento** | `mock` | depende de contrato com o banco (CNAB ou Open Finance) |

Os dois últimos estão travados em terceiros, não em código.

### `mock` e `desligado` não são a mesma coisa

- **`mock`** finge que deu certo. Responde "enviei" sem nada sair, e a tela pinta de
  verde. Serve para desenvolver e para os testes automatizados.
- **`desligado`** não finge. Recusa o envio e diz onde ligar.

O e-mail era `mock` e virou `desligado` em 15/10/2026, porque o `mock` escondia: o
histórico enchia de "enviado" e nenhuma caixa de entrada do mundo tinha recebido
nada. Na tela de Status, hoje existem **três** estados — *Simulado*, *Desligado* e
*Ativo*.

---

## O assistente de IA no WhatsApp

Responde perguntas sobre o sistema, pelo WhatsApp, para o pessoal da empresa. Lê o
sistema por **12 ferramentas de consulta** e nunca escreve nada nele.

**Para ligar, três coisas — e as três precisam estar de pé:**

1. a **chave da IA**, no `.env` ou na tela;
2. o **QR Code lido**, em Comunicação → WhatsApp;
3. ao menos **um grupo liberado**, em Administração → **Área IA**.

Faltando qualquer uma, ele fica calado, e a Área IA diz qual está faltando em uma
linha no alto da tela.

**O que ele sabe de quem pergunta:** o número de quem manda é cruzado com o cadastro.
Quem é da equipe vê números e valores; quem é fornecedor vê só o que é dele; quem não
está cadastrado recebe o essencial. **Esse controle está no código das ferramentas,
não no texto do pedido** — os testes de acesso passam com qualquer modelo, ou com
nenhum.

O detalhe de uso está no [manual do usuário](docs/tutorial/TUTORIAL.md) e no
[guia de teste manual](docs/testes/GUIA-TESTE-MANUAL.md).

---

## Estrutura

```
.
├── docker-compose.yml           # Desenvolvimento — as três peças e seus limites
├── docker-compose.producao.yml  # Produção — imagem compilada, sem hot-reload
├── .env.example                 # Modelo seguro; copie para .env
│
├── backend/                     # API em Node + Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma        # Modelo de dados
│   │   ├── migrations/          # 39 migrações, aplicadas na subida
│   │   └── seed-*.ts            # Sementes (cadastros, demonstração, situações)
│   ├── testes/                  # Provas de integração (banco de verdade)
│   └── src/
│       ├── config/              # Leitura e validação do .env
│       ├── rotas/               # Endpoints HTTP
│       ├── servicos/            # Regras de negócio
│       │   ├── assistente.ts            # O ciclo do assistente de IA
│       │   ├── assistente-ferramentas.ts # As 12 consultas e o acesso por perfil
│       │   └── atendimento.ts           # O que chega do WhatsApp
│       └── integracoes/         # ← As "tomadas" das integrações externas
│           ├── whatsapp/        # mock | baileys | cloud-api
│           ├── email/           # desligado | mock | resend | SMTP pela tela
│           ├── ia/              # mock | groq
│           ├── fiscal/          # mock | sefaz
│           └── pagamento/       # mock | cnab | open-finance
│
├── frontend/                    # Interface em React + Vite
│   └── src/
│       ├── componentes/         # Peças reutilizáveis
│       ├── estilos/             # tokens.css = o sistema de design
│       ├── paginas/             # 44 telas
│       └── servicos/            # Chamadas à API
│
├── docs/
│   ├── tutorial/                # Manual do usuário (Markdown + PDF)
│   ├── testes/                  # Guia de teste manual
│   ├── navegacao/               # Guias de navegação e alimentação do sistema
│   ├── design/                  # O sistema de design
│   └── sefaz/                   # Levantamento fiscal e o pedido à empresa
│
└── scripts/
    ├── gerar-pdf.mjs            # Gera os PDFs dos documentos
    ├── auditoria-ui.mjs         # Régua: mede as 44 telas em três larguras
    ├── padrao.mjs               # Confere as 9 regras da casa
    └── backup.mjs               # Cópia de segurança do banco
```

---

## Testes

```bash
docker compose exec api npm test               # unidade + integração
docker compose exec api npm run test:unidade   # 619 — lógica pura, sem banco
docker compose exec api npm run test:integracao # 580 — com banco de verdade
docker compose exec api npm run tipos          # confere os tipos

cd frontend && npm test                        # 375 — as telas
```

**1.574 provas no total.** Os testes de integração usam o banco `portoink_test`,
separado dos dados de desenvolvimento, e rodam **um por vez** — dois processos ao
mesmo tempo travam o banco um do outro.

Nenhum teste chama provedor externo: as suítes forçam `mock` em todos os
adaptadores.

---

## Medir as telas

```bash
cd scripts
npm run padrao              # as 9 regras da casa
npm run auditoria           # mede as 44 telas a 1440px
npm run auditoria:celular   # as mesmas 44 a 420px
npm run pente-fino          # lê o CSS e acha defeito sem abrir navegador
```

A régua mede **transbordo**, não beleza: ela acha texto cortado, barra de rolagem
horizontal e elemento fora da caixa. Para julgar aparência, é preciso olhar a foto.

---

## Limites de recurso

Cada container está limitado a **1 GB de RAM e 1 núcleo**, igual ao servidor de
destino. Para acompanhar o consumo real:

```bash
docker stats
```

---

## Documentos

```bash
cd scripts && npm run pdfs
```

| Documento | Para quem | Arquivo |
|---|---|---|
| Manual do usuário | quem vai usar | `docs/tutorial/Tutorial-PortoInc.pdf` |
| Guia de teste manual | quem vai conferir | `docs/testes/Guia-Teste-Manual-PortoInc.pdf` |
| Guia de navegação | quem está se achando no sistema | `docs/navegacao/Guia-Navegacao-PortoInc.pdf` |
| Guia prático | o caminho curto de cada tarefa | `docs/navegacao/Guia-Pratico-PortoInc.pdf` |
| Guia de alimentação | quem vai cadastrar os dados | `docs/navegacao/Guia-Alimentar-PortoInc.pdf` |
| Sistema de design | quem for mexer em tela | `docs/design/Design-PortoInc.pdf` |
| Levantamento SEFAZ | o que falta para a nota fiscal | `docs/sefaz/Levantamento-SEFAZ-PortoInc.pdf` |

---

## Se algo não subir

| Sintoma | Causa provável |
|---|---|
| `Cannot read package config: no data available` | o Windows serviu um arquivo pela metade — `docker compose restart api` |
| A API reinicia em laço | `JWT_SECRET` com menos de 32 caracteres no `.env` |
| `password authentication failed` | a senha em `DATABASE_URL_TESTE` não bate com `POSTGRES_PASSWORD` |
| O banco não aceita conexão | o container `db` ainda está no `start_period` — espere 20s |
| Tela em branco no 5173 | `docker compose logs web` |
