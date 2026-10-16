# Multi-stage production build for Digiverse frontend client
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/game-engine/package.json packages/game-engine/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @digiverse/shared build && \
    pnpm --filter @digiverse/game-engine build && \
    pnpm --filter @digiverse/web build

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
