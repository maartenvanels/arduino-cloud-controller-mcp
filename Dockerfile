FROM node:16-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY arduino-cloud-controller-mcp.js ./
COPY mcp-server.js ./

FROM node:16-alpine AS release

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/arduino-cloud-controller-mcp.js ./
COPY --from=builder /app/mcp-server.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV MCP_SERVER_MODE=true

# Use ENTRYPOINT instead of CMD
ENTRYPOINT ["node", "mcp-server.js"] 