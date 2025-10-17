# Multi-stage build for SierraDB Inspector
FROM node:22-alpine AS builder

# Install Python and build dependencies needed for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (including dev dependencies for building)
RUN npm ci
RUN cd shared && npm ci
RUN cd server && npm ci
RUN cd client && npm ci

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# Build shared package first (dependency of server and client)
RUN cd shared && npm run build

# Build all packages
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install Python and build dependencies needed for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

# Install only production dependencies
RUN npm ci --only=production
RUN cd shared && npm ci --only=production
RUN cd server && npm ci --only=production

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S inspector -u 1001

# Change ownership of the app directory
RUN chown -R inspector:nodejs /app
USER inspector

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV SIERRADB_URL=redis://localhost:9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start the server
CMD ["npm", "start"]