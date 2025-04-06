# Arduino IoT Cloud MCP

A Model Context Protocol (MCP) implementation for managing Arduino IoT Cloud devices and properties. This tool allows you to manage Arduino IoT Cloud devices through an MCP interface and through a standalone CLI.

## Features

- MCP server for integration with assistants that support the Model Context Protocol
- Standalone CLI for direct Arduino Cloud control
- Query devices and 'things'
- Query and control properties
- Support for different property types such as boolean, numeric, and dimmable lights
- Specific tests for office lights

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/maartenvanels/arduino-cloud-controller-mcp.git
   cd arduino-cloud-controller-mcp
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file with the required credentials:

   ```
   ARDUINO_CLIENT_ID=your_client_id
   ARDUINO_CLIENT_SECRET=your_client_secret
   ```

You can obtain these credentials via the [Arduino IoT Cloud Dashboard](https://cloud.arduino.cc/home/).

## Usage

### As MCP Server

Start the MCP server that can communicate with assistants that support the Model Context Protocol:

```
npm start
```

### As Standalone CLI

You can also use the Arduino Cloud Client directly via the CLI:

```
# Show all available commands
npm test

# List all devices
npm run list-devices

# List all things
npm run list-things

# Custom commands
node mcp-arduino-cloud.js --test get-properties <thing_id>
node mcp-arduino-cloud.js --test get-value <thing_id> <property_id>
node mcp-arduino-cloud.js --test set-value <thing_id> <property_id> <value>
node mcp-arduino-cloud.js --test find-thing <name>
node mcp-arduino-cloud.js --test toggle <thing_id> <property_id>
```

### Office Light Tests

There are special tests and tools built in to test office lights:

```
# Test that checks the office light status
npm run test:office

# Interactive tool to control the office light
npm run control:office
```

To adapt the 'thing' and 'property' names to your specific setup, modify the constants in the test files:

```javascript
// In test/office-light.js and test/control-office-light.js
const THING_NAME = "MainHomeController"; // Replace this with the name of your thing
const OFFICE_LIGHT_NAME = "Office_Light"; // Replace this with the name of your office light property
```

## Architecture

The code is designed according to SOLID principles:

- **Single Responsibility Principle**: The `ArduinoCloudClient` class is separate from the MCP implementation.
- **Open/Closed Principle**: The architecture is open for extension (new tools, property types) without modifying existing code.
- **Liskov Substitution Principle**: Common interfaces are used to treat different property types consistently.
- **Interface Segregation Principle**: Clear separation between client functions and MCP server functions.
- **Dependency Inversion Principle**: The MCP server depends on abstractions of the client, not concrete implementations.

## Development

For development with hot-reloading:

```
npm run dev
```

## Docker

You can also run the application in a Docker container:

```
docker-compose up -d
```

## License

MIT
