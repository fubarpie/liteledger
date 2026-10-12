# syntax=docker/dockerfile:1
# NOTE: package-lock.json is deliberately deleted before install. A lockfile
# generated on another OS/arch/libc lacks the platform-specific optional native
# binaries (rolldown, esbuild) needed here (musl, amd64 + arm64), which breaks
# `vite build`. Letting npm re-resolve picks the right binaries per platform.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY package.json ./
# tsx (used to run server.ts) lives in devDependencies, so keep them.
RUN npm install --no-audit --no-fund && npm cache clean --force
COPY server.ts tsconfig.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["npx", "tsx", "server.ts"]
