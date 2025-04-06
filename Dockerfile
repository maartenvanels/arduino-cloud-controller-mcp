FROM node:16-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV MCP_SERVER_MODE=true

# Expose port for MCP server
EXPOSE 3000

# Start the MCP server
CMD ["node", "mcp-server.js"] 