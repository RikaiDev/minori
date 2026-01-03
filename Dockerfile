# Build stage
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/ai-engine/package.json ./packages/ai-engine/
COPY packages/line-bot/package.json ./packages/line-bot/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json ./

# Build TypeScript (compile packages)
RUN bun run typecheck

# Production stage
FROM oven/bun:1.1-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 minori && \
    adduser --system --uid 1001 minori

# Copy dependencies and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/package.json ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/tsconfig.json ./

# Switch to non-root user
USER minori

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the API server
CMD ["bun", "run", "--cwd", "apps/api", "start"]
