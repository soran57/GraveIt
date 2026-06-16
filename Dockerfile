# GraveIt — Production Dockerfile (Multi-Stage)

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy runtime assets needed by the server:
# - server/db/schema.sql is read via fs.readFileSync at startup
COPY server/db/schema.sql ./server/db/schema.sql

# Create uploads directory
RUN mkdir -p uploads

# Non-root user for security
RUN addgroup -g 1001 -S graveit && \
    adduser -S graveit -u 1001 -G graveit && \
    chown -R graveit:graveit /app
USER graveit

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.cjs"]
