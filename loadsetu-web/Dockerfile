# ============================================================================
# LoadSetu Web — Production Dockerfile
# Multi-stage build for optimized Next.js deployment
# ============================================================================

# ── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# ── Stage 2: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_SPRING_URL
ARG NEXT_PUBLIC_FASTAPI_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_H3_HEATMAP_DEFAULT

# Set environment variables for build
ENV NEXT_PUBLIC_SPRING_URL=$NEXT_PUBLIC_SPRING_URL
ENV NEXT_PUBLIC_FASTAPI_URL=$NEXT_PUBLIC_FASTAPI_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_H3_HEATMAP_DEFAULT=$NEXT_PUBLIC_H3_HEATMAP_DEFAULT

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN npm run build

# ── Stage 3: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose Next.js port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start Next.js
CMD ["node", "server.js"]
