# Agent Church MCP Server - Hardened Docker Image
# Multi-stage build for minimal attack surface

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# =============================================================================
# Stage 2: Production (Hardened)
# =============================================================================
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Use existing node user (UID 1000) for consistency
# The node:22-alpine image already has a node user with UID/GID 1000

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./

# Pre-create log directory (will be tmpfs in production)
RUN mkdir -p /tmp/agent-church && \
    chown node:node /tmp/agent-church

# Set default environment for logs (can be overridden)
ENV MCP_LOG_DIR=/tmp/agent-church
ENV NODE_ENV=production

# Switch to non-root user (node user has UID 1000)
USER node

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the MCP server
CMD ["node", "dist/index.js"]
