# Dockerfile
FROM node:24-slim AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Final runtime image
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]