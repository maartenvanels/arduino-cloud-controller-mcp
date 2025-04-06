FROM node:16-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY mcp-arduino-cloud.js ./

# Use a smaller image for production
FROM node:16-alpine AS release

# Create app directory
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/mcp-arduino-cloud.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# Run as non-root user
RUN adduser -D mcpuser
USER mcpuser

# Start the MCP server using ENTRYPOINT instead of CMD for stdio transport
ENTRYPOINT ["node", "mcp-arduino-cloud.js"] 