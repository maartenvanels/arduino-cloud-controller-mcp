# Arduino Cloud Controller MCP

An MCP for interacting with the Arduino IoT Cloud platform. This MCP allows you to discover and control Arduino IoT Cloud devices, things, and properties from Cursor or any other MCP-compatible platform.

## Features

- List all devices in your Arduino Cloud account
- List all things (IoT projects)
- Get properties for any thing
- Control property values (turn lights on/off, adjust brightness, read sensors, etc.)
- Find things and properties by name
- Toggle boolean properties or light switches

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/yourusername/arduino-cloud-controller-mcp.git
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

This MCP uses the Arduino IoT Cloud REST API to interact with devices and properties. It handles OAuth 2.0 authentication automatically and refreshes tokens as needed.

For more details on the Arduino IoT Cloud API, see the [official documentation](https://www.arduino.cc/reference/en/iot/api/).
