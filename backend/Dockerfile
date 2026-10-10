# ============================================================
#  Backend Porto Inc.
#  Usamos Debian "slim" (e nao Alpine) porque o Prisma precisa
#  de bibliotecas que o Alpine nao tem por padrao. Evita dor de
#  cabeca sem custo real de memoria.
# ============================================================

# ---------- Base comum ----------
FROM node:24-slim AS base
WORKDIR /app
# openssl:         exigido pelo motor do Prisma
# git:             o Baileys instala o libsignal direto do GitHub
# ca-certificates: sem ele o git nao valida o certificado do GitHub
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# O Baileys declara o libsignal por SSH. Sem chave nenhuma o npm falha;
# apontando para HTTPS ele baixa como qualquer repositorio publico.
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
COPY package*.json ./
COPY prisma ./prisma

# ---------- DESENVOLVIMENTO (com recarga automatica) ----------
FROM base AS dev
ENV NODE_ENV=development
RUN npm install
RUN npx prisma generate
COPY . .
EXPOSE 3000
# ------------------------------------------------------------
#  A SUBIDA, EM QUATRO PASSOS — E OS DOIS DO MEIO SAO NOVOS
#
#  1. migrate deploy  -> o BANCO fica em dia
#  2. prisma generate -> o CLIENTE fica em dia
#  3. seed-se-vazio   -> planta so em banco novo
#  4. dev             -> sobe a API
#
#  O passo 2 nasceu em 09/10/2026. O `node_modules` deste
#  container e volume anonimo: um `docker compose down -v` apaga
#  ele, e na subida seguinte ele volta DA IMAGEM — com o cliente
#  Prisma gerado na ultima construcao. Se migracoes entraram
#  depois disso, o cliente nao conhece as tabelas novas.
#
#  Na simulacao de entrega isso derrubou o Financeiro inteiro com
#  erro 500 (`Cannot read properties of undefined (reading
#  'findMany')`) — e o 500 aparecia na primeira tela que a
#  empresa abriria. O banco estava certo; o cliente e que estava
#  velho, porque so o passo 1 existia.
#
#  O passo 3 trocou `npm run seed` por `seed-se-vazio`: a semente
#  usa `upsert`, entao REINICIAR a API ressuscitava 8 contas com
#  senha conhecida e 20 materiais que a empresa nao cadastrou.
#  Agora ela so planta quando nao ha nenhum usuario.
# ------------------------------------------------------------
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run seed-se-vazio && npm run dev"]

# ---------- CONSTRUCAO PARA PRODUCAO ----------
FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate && npx tsc -p tsconfig.json

# ---------- PRODUCAO ----------
FROM node:24-slim AS prod
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Nao rodar como root: reduz o estrago em caso de invasao
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/servidor.js"]
