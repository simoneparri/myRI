FROM node:24-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/dist/myri/browser /usr/share/nginx/html
COPY --chmod=755 docker-config.sh /docker-entrypoint.d/40-myri-config.sh
USER 101:101
EXPOSE 8080
