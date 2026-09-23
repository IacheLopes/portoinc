# ============================================================
#  Frontend Porto Inc.
# ============================================================

# ---------- DESENVOLVIMENTO (com recarga automatica) ----------
FROM node:24-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------- CONSTRUCAO ----------
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Damos folga de memoria ao build: e o passo mais pesado do projeto.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

# ---------- PRODUCAO ----------
# O resultado e so HTML, CSS e JS. O Nginx serve isso gastando ~15 MB.
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
