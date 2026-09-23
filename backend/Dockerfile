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
# Aplica as migracoes e sobe a API observando alteracoes no codigo
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run dev"]

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
