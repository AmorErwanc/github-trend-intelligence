# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
ENV TZ=Asia/Shanghai
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN pnpm exec prisma generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3310)+'/github-trend-intelligence/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
