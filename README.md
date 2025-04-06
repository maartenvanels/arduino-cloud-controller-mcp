# Arduino Cloud Controller MCP

A Model Context Protocol (MCP) implementation for interacting with the Arduino IoT Cloud platform. This MCP allows you to discover and control Arduino IoT Cloud devices, things, and properties from Cursor or any other MCP-compatible platform.

## Features

- List all devices in your Arduino Cloud account
- List all things (IoT projects)
- Get properties for any thing
- Control property values (turn lights on/off, adjust brightness, read sensors, etc.)
- Find things and properties by name
- Toggle boolean properties or light switches
- Enhanced support for dimmed lights (HOME_DIMMED_LIGHT) with intelligent handling of switch state and brightness
- Improved error handling and logging for better debugging
- Fully compatible with the [Model Context Protocol](https://modelcontextprotocol.io) specification
- Uses stdio transport for direct communication with Cursor

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

3. Copy the example environment file and edit it with your credentials:

   ```
   cp .env.example .env
   ```

4. Edit the `.env` file and add your Arduino IoT Cloud API credentials (client ID and client secret)

## Running Locally

You can run the MCP directly via Node.js locally:

```
node mcp-arduino-cloud.js
```

## Running as Docker Container

You can run this MCP in a Docker container:

1. Build the Docker image:

   ```
   docker build -t arduino-cloud-mcp .
   ```

2. Run the container with interactive mode to support stdio:

   ```
   docker run -i --rm -e ARDUINO_CLIENT_ID=your_client_id -e ARDUINO_CLIENT_SECRET=your_client_secret arduino-cloud-mcp
   ```

## Configuring in Cursor

### MCP Configuration File Location

The MCP configuration file (`mcp.json`) in Cursor is located at:

- Windows: `%USERPROFILE%\.cursor\mcp.json`
- macOS: `~/.cursor/mcp.json`
- Linux: `~/.cursor/mcp.json`

If the file doesn't exist yet, you can create it.

### Complete Configuration Examples

#### Option A: Node.js Integration

Here's a complete example of an `mcp.json` file using Node.js:

```json
{
  "mcps": {
    "arduino_cloud_controller": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-arduino-cloud.js"],
      "env": {
        "ARDUINO_CLIENT_ID": "your_arduino_cloud_client_id",
        "ARDUINO_CLIENT_SECRET": "your_arduino_cloud_client_secret"
      }
    }
  }
}
```

For Windows:

```json
{
  "mcps": {
    "arduino_cloud_controller": {
      "command": "node",
      "args": ["D:\\path\\to\\mcp-arduino-cloud.js"],
      "env": {
        "ARDUINO_CLIENT_ID": "your_arduino_cloud_client_id",
        "ARDUINO_CLIENT_SECRET": "your_arduino_cloud_client_secret"
      }
    }
  }
}
```

#### Option B: Docker Container Integration

Here's a complete example of an `mcp.json` file using Docker:

```json
{
  "mcps": {
    "arduino_cloud_controller": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "ARDUINO_CLIENT_ID=your_arduino_cloud_client_id",
        "-e",
        "ARDUINO_CLIENT_SECRET=your_arduino_cloud_client_secret",
        "arduino-cloud-mcp"
      ]
    }
  }
}
```

> **Important Notes**:
>
> - The `-i` flag is critical for stdio transport - it enables interactive mode in Docker, allowing standard input/output to be properly piped between Cursor and the MCP.
> - Replace `your_arduino_cloud_client_id` and `your_arduino_cloud_client_secret` with your actual credentials.
> - For absolute paths, use the appropriate format for your operating system.

### Testing the Configuration

After adding the configuration:

1. Restart Cursor
2. Open a new file
3. Test with a simple command like:
   ```javascript
   await mcp_arduino_cloud_controller_list_things();
   ```

## Arduino IoT Cloud Setup

To use this MCP, you need to:

1. Have an Arduino IoT Cloud account
2. Create an API key at https://cloud.arduino.cc/home/api-keys
3. Have at least one device and thing set up in your Arduino Cloud

## Usage in Cursor

Here are some example usages in Cursor:

### Finding a Thing

```javascript
const things = await mcp_arduino_cloud_controller_list_things();
console.log(things);

// Or find by name
const thing = await mcp_arduino_cloud_controller_find_thing_by_name({
  name: "MainHomeController",
});
console.log(thing);
```

### Finding Properties

```javascript
// Get all properties for a thing
const properties = await mcp_arduino_cloud_controller_get_properties({
  thing_id: "your-thing-id",
});
console.log(properties);

// Find a specific property by name
const property = await mcp_arduino_cloud_controller_find_property_by_name({
  thing_id: "your-thing-id",
  name: "Office_Light",
});
console.log(property);
```

### Controlling Properties

```javascript
// Get current property value
const value = await mcp_arduino_cloud_controller_get_property_value({
  thing_id: "your-thing-id",
  property_id: "your-property-id",
});
console.log(value);

// Set a property value (example for a dimmed light)
await mcp_arduino_cloud_controller_set_property_value({
  thing_id: "your-thing-id",
  property_id: "your-property-id",
  value: { swi: true, bri: 80 },
});

// Toggle a property (e.g., turn a light on/off)
await mcp_arduino_cloud_controller_toggle_property({
  thing_id: "your-thing-id",
  property_id: "your-property-id",
});
```

### Complete Example: Turn Office Lights On

```javascript
// Find the home controller thing
const thing = await mcp_arduino_cloud_controller_find_thing_by_name({
  name: "MainHomeController",
});

// Find the office light property
const property = await mcp_arduino_cloud_controller_find_property_by_name({
  thing_id: thing.id,
  name: "Office_Light",
});

// Turn on the light at 70% brightness
await mcp_arduino_cloud_controller_set_property_value({
  thing_id: thing.id,
  property_id: property.id,
  value: { swi: true, bri: 70 },
});

// Check the current state
const currentState = await mcp_arduino_cloud_controller_get_property_value({
  thing_id: thing.id,
  property_id: property.id,
});
console.log("Light state:", currentState);
```

## Technical Details

This MCP uses the official Arduino IoT Cloud REST API with authentication. It handles token management and renewal automatically.

The tool is built with Node.js and implements the MCP protocol as specified in the [Model Context Protocol](https://modelcontextprotocol.io) specification.

For more details on the Arduino IoT Cloud API, see the [official documentation](https://www.arduino.cc/reference/en/iot/api/).
