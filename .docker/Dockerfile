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

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/server.ts ./

RUN npm ci --omit=dev --ignore-scripts && npm install tsx

RUN mkdir -p data/conversations data/uploads

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
