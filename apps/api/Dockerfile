# Multi-stage build for the NestJS API in this pnpm/turborepo monorepo.
# Build from the REPO ROOT so workspace packages (@binaryiq/db, @binaryiq/types)
# resolve correctly:
#   docker build -f apps/api/Dockerfile -t binaryiq-api .
#
# Why not Vercel: this service runs persistent BullMQ workers (daily DPDP erasure
# sweep, RSS polling, async notification delivery) that need a long-running Node
# process polling Redis. Vercel serverless functions are invoked per-request and
# frozen between calls, so none of those scheduled/background jobs would fire.
# Any host that runs a long-lived container works (Railway, Render, Fly.io, a VPS).
# DATABASE_URL (Neon) and REDIS_URL (Upstash) already point at serverless-friendly
# managed services, so nothing else needs to change to move the API off a laptop.

FROM node:20-slim AS base
# Prisma's query engine needs OpenSSL on Debian-based images.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ---- deps: install once, cached unless lockfile/manifests change ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile the workspace deps the API needs, then the API itself ----
FROM deps AS build
COPY turbo.json tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/types packages/types
COPY packages/config packages/config
RUN pnpm turbo run build --filter=@binaryiq/api

# ---- runtime: reuses the build stage's node_modules as-is. ----
# A separate `pnpm install --prod` prune stage was tried and dropped: pnpm's
# content-addressable store puts the generated Prisma query engine under the
# ROOT node_modules/.pnpm tree, not under packages/db/node_modules. A fresh
# prod-only install creates its own store that never had `prisma generate` run
# against it, so @binaryiq/db silently loads an uninitialized client. Shipping
# the build stage's node_modules (devDependencies included) costs some image
# size but is correct, and is the pattern Prisma's own Docker docs recommend
# for pnpm workspaces.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build /repo/packages/types/node_modules ./packages/types/node_modules
COPY --from=build /repo/packages/types/dist ./packages/types/dist
COPY --from=build /repo/packages/types/package.json ./packages/types/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/package.json ./package.json

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
