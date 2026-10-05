FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
# Build with repository root as context; the authoritative lockfile lives there.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nestjs-api/package.json ./nestjs-api/package.json
RUN pnpm --filter nestjs-api... install --frozen-lockfile
COPY nestjs-api ./nestjs-api
RUN pnpm --filter nestjs-api run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nestjs-api/package.json ./nestjs-api/package.json
RUN pnpm --filter nestjs-api... install --prod --frozen-lockfile
COPY --from=builder /app/nestjs-api/dist ./nestjs-api/dist
COPY nestjs-api/migrations ./nestjs-api/migrations
COPY nestjs-api/scripts/migration-files.mjs ./nestjs-api/scripts/migration-files.mjs
COPY nestjs-api/run_sql.mjs ./nestjs-api/run_sql.mjs
USER node

EXPOSE 3001
ENV PORT=3001
CMD ["node", "nestjs-api/dist/main.js"]
