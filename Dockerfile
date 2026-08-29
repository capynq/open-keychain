# syntax=docker/dockerfile:1.7
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable
RUN --mount=type=cache,id=open-keychain-pnpm,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Open Keychain" \
      org.opencontainers.image.description="Local-first printable keychain customizer" \
      org.opencontainers.image.source="https://github.com/capynq/open-keychain" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION \
      org.opencontainers.image.licenses="MIT"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
  CMD wget --spider --quiet http://127.0.0.1/ || exit 1
EXPOSE 80
