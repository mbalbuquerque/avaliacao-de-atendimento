# =============================================================================
# Estágio 1: Dependências de Produção
# =============================================================================
FROM node:22.12.0-alpine3.21 AS dependencias
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# =============================================================================
# Estágio 2: Imagem Final de Execução
# =============================================================================
FROM node:22.12.0-alpine3.21 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Execução segura com usuário não-root
USER node

# Copia dependências limpas de produção
COPY --chown=node:node --from=dependencias /app/node_modules ./node_modules
COPY --chown=node:node package.json ./

# Copia código-fonte da aplicação e assets estáticos
COPY --chown=node:node server.js ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node css/ ./css/
COPY --chown=node:node js/ ./js/
COPY --chown=node:node icons/ ./icons/
COPY --chown=node:node index.html dashboard.html admin.html admin-login.html offline.html manifest.webmanifest sw.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]

