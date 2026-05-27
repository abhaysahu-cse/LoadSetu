# ============================================================================
# VahanSync ML Engine — Production Dockerfile
# Multi-stage build for optimized FastAPI deployment
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1001 vahansync

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /root/.local /home/vahansync/.local

# Copy application code
COPY --chown=vahansync:vahansync . .

# Update PATH to include user-installed packages
ENV PATH=/home/vahansync/.local/bin:$PATH

# Switch to non-root user
USER vahansync

# Expose FastAPI port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run with production settings
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--no-access-log"]
