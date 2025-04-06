// Arduino Cloud Controller MCP Server
// This script registers the MCP with Cursor or other MCP-compatible platforms

require('dotenv').config();
const ArduinoCloudController = require('./arduino-cloud-controller-mcp');
const http = require('http');

// Check for NodeJS version compatibility
const nodeVersion = process.version.match(/^v(\d+)\./)[1];
if (parseInt(nodeVersion) < 12) {
  console.error('Error: This MCP requires Node.js v12 or higher');
  console.error('Current version:', process.version);
  console.error('Please upgrade your Node.js installation');
  process.exit(1);
}

// Basic configuration validation
if (!process.env.ARDUINO_CLIENT_ID || !process.env.ARDUINO_CLIENT_SECRET) {
  console.error('Error: Missing Arduino Cloud API credentials.');
  console.error('Please ensure ARDUINO_CLIENT_ID and ARDUINO_CLIENT_SECRET are set in your .env file.');
  console.error('You can copy the .env.example file to .env and add your credentials.');
  process.exit(1);
}

// Display available MCP functions (to stderr for logs)
console.error('Arduino Cloud Controller MCP loaded successfully.');
console.error(`Configured for API client ID: ${process.env.ARDUINO_CLIENT_ID.substring(0, 5)}...`);
console.error('\nAvailable MCP functions:');
ArduinoCloudController.functions.forEach(fn => {
  const params = fn.parameters.map(p => p.required ? `${p.name}*` : p.name).join(', ');
  console.error(`- mcp_arduino_cloud_controller_${fn.name}(${params})`);
});

// Start HTTP server for MCP when in server mode
if (process.env.MCP_SERVER_MODE === 'true') {
  const PORT = process.env.PORT || 3000;
  
  const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    
    // Handle MCP function calls
    if (req.url === '/execute') {
      try {
        let body = '';
        
        // Collect request body
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        // Process the request
        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const { functionName, params } = request;
            
            // Remove the 'mcp_arduino_cloud_controller_' prefix
            const mcpFunctionName = functionName.replace('mcp_arduino_cloud_controller_', '');
            
            // Find the requested function
            const mcpFunction = ArduinoCloudController.functions.find(fn => fn.name === mcpFunctionName);
            
            if (!mcpFunction) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Function '${mcpFunctionName}' not found` }));
              return;
            }
            
            // Execute the function
            const result = await mcpFunction.handler(params || {});
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ result }));
          } catch (error) {
            console.error('Error processing request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  server.listen(PORT, () => {
    console.error(`\nMCP server running on port ${PORT}`);
    console.error(`Endpoint: http://localhost:${PORT}/execute`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
} else {
  // In standalone mode (Cursor integration via stdin/stdout)
  // Detect if this is stdin/stdout mode and prepare to handle input/output
  if (process.stdin.isTTY === undefined) {
    // Process MCP call from stdin
    let inputData = '';
    
    process.stdin.on('data', (chunk) => {
      inputData += chunk.toString();
    });
    
    process.stdin.on('end', async () => {
      try {
        const request = JSON.parse(inputData);
        const { functionName, params } = request;
        
        // Remove the 'mcp_arduino_cloud_controller_' prefix
        const mcpFunctionName = functionName.replace('mcp_arduino_cloud_controller_', '');
        
        // Find the requested function
        const mcpFunction = ArduinoCloudController.functions.find(fn => fn.name === mcpFunctionName);
        
        if (!mcpFunction) {
          console.log(JSON.stringify({ error: `Function '${mcpFunctionName}' not found` }));
          process.exit(1);
        }
        
        // Execute the function and return result as JSON to stdout
        const result = await mcpFunction.handler(params || {});
        console.log(JSON.stringify({ result }));
        process.exit(0);
      } catch (error) {
        console.error('Error processing stdin request:', error);
        console.log(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
    });
  } else {
    console.error('\nRunning in standalone mode. Use module exports to integrate with your application.');
    console.error('Set MCP_SERVER_MODE=true in your .env file to enable server mode.');
  }
}

// Export the MCP for use by other modules
module.exports = ArduinoCloudController; 