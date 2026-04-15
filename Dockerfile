FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY server.ts ./

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=appuser:nodejs /app/server.ts ./

RUN npm ci --omit=dev --ignore-scripts && npm install tsx && chown -R appuser:nodejs /app

RUN mkdir -p data/conversations data/uploads && chmod 755 data

USER appuser

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
