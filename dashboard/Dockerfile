# Stage 1: Install dependencies & Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN mkdir -p public
ENV DB_HOST=localhost DB_PORT=5432 DB_USER=dummy DB_PASSWORD=dummy DB_NAME=dummy REDIS_HOST=localhost REDIS_PORT=6379 REDIS_PASSWORD=dummy SESSION_SECRET=dummy NEXT_PUBLIC_API_URL=/api INTERNAL_API_URL=http://localhost:3000
RUN npm run build

# Stage 2: Runner
FROM node:20-slim AS runner
WORKDIR /app

# Install docker CLI and docker-compose v2 standalone for scaling management from admin UI
# Use static Docker CLI binary so the client API version matches modern host daemons.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -L "https://download.docker.com/linux/static/stable/x86_64/docker-29.1.3.tgz" -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && cp /tmp/docker/docker /usr/local/bin/docker \
    && chmod +x /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz \
    && curl -L "https://github.com/docker/compose/releases/download/v2.35.1/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose \
    && chmod +x /usr/local/bin/docker-compose \
    && docker --version \
    && docker-compose --version \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/next.config.js ./
RUN mkdir -p ./public
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
