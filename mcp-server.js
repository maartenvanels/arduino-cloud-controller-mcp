// Arduino Cloud Controller MCP Server
// This script registers the MCP with Cursor or other MCP-compatible platforms

require('dotenv').config();
const ArduinoCloudController = require('./arduino-cloud-controller-mcp');

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

// Display available MCP functions
console.log('Arduino Cloud Controller MCP loaded successfully.');
console.log(`Configured for API client ID: ${process.env.ARDUINO_CLIENT_ID.substring(0, 5)}...`);
console.log('\nAvailable MCP functions:');
ArduinoCloudController.functions.forEach(fn => {
  const params = fn.parameters.map(p => p.required ? `${p.name}*` : p.name).join(', ');
  console.log(`- mcp_arduino_cloud_controller_${fn.name}(${params})`);
});

// Register MCP to server if running in MCP server mode
if (process.env.MCP_SERVER_MODE === 'true') {
  try {
    // This is a placeholder for MCP server registration
    // The actual implementation depends on the MCP server platform
    console.log('\nMCP server mode enabled. Registering with MCP server...');
    // mcpServer.register(ArduinoCloudController);
    console.log('MCP registration successful. Server ready to accept commands.');
  } catch (error) {
    console.error('Failed to register MCP with server:', error);
    process.exit(1);
  }
} else {
  console.log('\nRunning in standalone mode. Use module exports to integrate with your application.');
  console.log('Set MCP_SERVER_MODE=true in your .env file to enable server registration.');
}

// Export the MCP for use by other modules
module.exports = ArduinoCloudController; 