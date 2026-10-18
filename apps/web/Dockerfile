# Multi-stage build for the Next.js web app in this pnpm/turborepo monorepo.
# Build from the REPO ROOT so workspace packages (@binaryiq/types, @binaryiq/ui)
# resolve correctly:
#   docker build -f apps/web/Dockerfile -t binaryiq-web .
#
# Same shape as apps/api/Dockerfile — see that file's comments for why the final
# image reuses the build stage's node_modules wholesale instead of a pruned
# `--prod` install (pnpm's per-package node_modules symlinks break otherwise).

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install once, cached unless lockfile/manifests change ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile the workspace deps web needs, then web itself ----
FROM deps AS build
COPY turbo.json tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/types packages/types
COPY packages/ui packages/ui
COPY packages/config packages/config
# Build-time env: NEXT_PUBLIC_* values are baked into the client bundle, so they
# must be set here (as Railway build args/vars), not only at runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USE_MOCK=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK
RUN pnpm turbo run build --filter=@binaryiq/web

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build /repo/packages/types/node_modules ./packages/types/node_modules
COPY --from=build /repo/packages/types/dist ./packages/types/dist
COPY --from=build /repo/packages/types/package.json ./packages/types/package.json
COPY --from=build /repo/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=build /repo/packages/ui ./packages/ui

WORKDIR /repo/apps/web
EXPOSE 3000
ENV PORT=3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
