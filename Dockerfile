# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json* ./
# tsx (used to run server.ts) lives in devDependencies, so keep them.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm cache clean --force
COPY server.ts tsconfig.json ./
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["npx", "tsx", "server.ts"]
