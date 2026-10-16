# Multi-stage production build for Digiverse backend server
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/game-engine/package.json packages/game-engine/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full repository source
COPY . .

# Build packages and server
RUN pnpm --filter @digiverse/shared build && \
    pnpm --filter @digiverse/game-engine build && \
    pnpm --filter @digiverse/server build

# Runner stage
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable pnpm

COPY --from=builder /app /app

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
