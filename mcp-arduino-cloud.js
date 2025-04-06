// Arduino Cloud Controller MCP
// A generic controller MCP for the Arduino IoT Cloud platform

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import 'dotenv/config';
import fetch from 'node-fetch';
import { ArduinoCloudClient } from './lib/arduino-cloud-client.js';

/**
 * Arduino Cloud Controller MCP
 * 
 * This MCP provides functions to interact with the Arduino IoT Cloud platform.
 * It allows listing devices, things, and properties, as well as controlling properties.
 * Implemented according to Model Context Protocol specification.
 */

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test') || args.includes('-t');

// Initialize the Arduino Cloud client with environment variables
const client = new ArduinoCloudClient(
  process.env.ARDUINO_CLIENT_ID || '',
  process.env.ARDUINO_CLIENT_SECRET || ''
);

// If in test mode, run the test CLI instead of the MCP server
if (isTestMode) {
  runTestCLI(client, args).catch(error => {
    console.error('Error in test mode:', error.message);
    process.exit(1);
  });
} else {
  // Create and run the MCP server
  runMCPServer(client).catch(error => {
    console.error("Fatal error in MCP server:", error.message);
    process.exit(1);
  });
}

/**
 * Run a simple CLI test interface for Arduino Cloud Client
 */
async function runTestCLI(client, args) {
  console.log("Running in test mode. Commands:");
  console.log("  list-devices - List all devices");
  console.log("  list-things - List all things");
  console.log("  get-properties <thing_id> - Get properties for a thing");
  console.log("  get-value <thing_id> <property_id> - Get property value");
  console.log("  set-value <thing_id> <property_id> <value> - Set property value");
  console.log("  find-thing <name> - Find thing by name");
  console.log("  toggle <thing_id> <property_id> - Toggle boolean property");
  
  // Extract the command from args
  const command = args.find(arg => !arg.startsWith('-'));
  const otherArgs = args.filter(arg => arg !== command && !arg.startsWith('-'));
  
  try {
    switch (command) {
      case 'list-devices':
        const devices = await client.getDevices();
        // Redact sensitive information before logging
        const safeDevices = devices.map(device => ({
          id: device.id,
          name: device.name,
          type: device.type
        }));
        console.log(JSON.stringify(safeDevices, null, 2));
        break;
        
      case 'list-things':
        const things = await client.getThings();
        // Redact sensitive information before logging
        const safeThings = things.map(thing => ({
          id: thing.id,
          name: thing.name
        }));
        console.log(JSON.stringify(safeThings, null, 2));
        break;
        
      case 'get-properties':
        if (otherArgs.length < 1) {
          console.error('Missing thing_id parameter');
          process.exit(1);
        }
        const properties = await client.getProperties(otherArgs[0]);
        console.log(JSON.stringify(properties, null, 2));
        break;
        
      case 'get-value':
        if (otherArgs.length < 2) {
          console.error('Missing parameters: thing_id property_id');
          process.exit(1);
        }
        const value = await client.getPropertyValue(otherArgs[0], otherArgs[1]);
        console.log(JSON.stringify(value, null, 2));
        break;
        
      case 'set-value':
        if (otherArgs.length < 3) {
          console.error('Missing parameters: thing_id property_id value');
          process.exit(1);
        }
        
        // Try to parse the value properly
        let valueToSet;
        try {
          valueToSet = JSON.parse(otherArgs[2]);
        } catch (e) {
          // If not JSON, use the raw string value
          valueToSet = otherArgs[2];
        }
        
        const result = await client.setPropertyValue(otherArgs[0], otherArgs[1], valueToSet);
        console.log(JSON.stringify(result, null, 2));
        break;
        
      case 'find-thing':
        if (otherArgs.length < 1) {
          console.error('Missing name parameter');
          process.exit(1);
        }
        const allThings = await client.getThings();
        const foundThing = allThings.find(t => 
          t.name.toLowerCase() === otherArgs[0].toLowerCase()
        );
        console.log(foundThing ? JSON.stringify(foundThing, null, 2) : "Thing not found");
        break;
        
      case 'toggle':
        if (otherArgs.length < 2) {
          console.error('Missing parameters: thing_id property_id');
          process.exit(1);
        }
        
        // Get current value
        const currentValue = await client.getPropertyValue(otherArgs[0], otherArgs[1]);
        console.log(`Current value: ${JSON.stringify(currentValue)}`);
        
        // Determine new value based on the type
        let newValue;
        if (typeof currentValue === 'boolean') {
          newValue = !currentValue;
        } else if (typeof currentValue === 'object' && currentValue !== null && 'swi' in currentValue) {
          newValue = { ...currentValue, swi: !currentValue.swi };
        } else {
          console.error('Property is not toggleable');
          process.exit(1);
        }
        
        console.log(`Setting new value: ${JSON.stringify(newValue)}`);
        const toggleResult = await client.setPropertyValue(otherArgs[0], otherArgs[1], newValue);
        console.log(`Result: ${JSON.stringify(toggleResult, null, 2)}`);
        break;
        
      default:
        console.log('No command specified or invalid command');
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  
  process.exit(0);
}

/**
 * Create and run the MCP server
 */
async function runMCPServer(client) {
  // Create an MCP server instance
  const server = new Server(
    {
      name: "arduino-cloud-controller",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Setup the list_tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_devices",
          description: "List all Arduino IoT Cloud devices",
          inputSchema: {
            type: "object",
            properties: {
              random_string: {
                type: "string",
                description: "Dummy parameter for no-parameter tools"
              }
            },
            required: ["random_string"]
          }
        },
        {
          name: "list_things",
          description: "List all Arduino IoT Cloud things",
          inputSchema: {
            type: "object",
            properties: {
              random_string: {
                type: "string",
                description: "Dummy parameter for no-parameter tools"
              }
            },
            required: ["random_string"]
          }
        },
        {
          name: "get_properties",
          description: "Get properties for a specific thing",
          inputSchema: {
            type: "object",
            properties: {
              thing_id: {
                type: "string",
                description: "ID of the thing to get properties for"
              }
            },
            required: ["thing_id"]
          }
        },
        {
          name: "get_property_value",
          description: "Get the current value of a property",
          inputSchema: {
            type: "object",
            properties: {
              thing_id: {
                type: "string",
                description: "ID of the thing the property belongs to"
              },
              property_id: {
                type: "string",
                description: "ID of the property to get the value of"
              }
            },
            required: ["thing_id", "property_id"]
          }
        },
        {
          name: "set_property_value",
          description: "Set a property value",
          inputSchema: {
            type: "object",
            properties: {
              thing_id: {
                type: "string",
                description: "ID of the thing the property belongs to"
              },
              property_id: {
                type: "string",
                description: "ID of the property to set"
              },
              value: {
                type: ["string", "number", "boolean", "object"],
                description: "Value to set (type depends on property)"
              }
            },
            required: ["thing_id", "property_id", "value"]
          }
        },
        {
          name: "find_thing_by_name",
          description: "Find a thing by name",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the thing to find"
              }
            },
            required: ["name"]
          }
        },
        {
          name: "find_property_by_name",
          description: "Find a property by name",
          inputSchema: {
            type: "object",
            properties: {
              thing_id: {
                type: "string",
                description: "ID of the thing to search in"
              },
              name: {
                type: "string",
                description: "Name of the property to find"
              }
            },
            required: ["thing_id", "name"]
          }
        },
        {
          name: "toggle_property",
          description: "Toggle a boolean property (e.g., turn a light on/off)",
          inputSchema: {
            type: "object",
            properties: {
              thing_id: {
                type: "string",
                description: "ID of the thing the property belongs to"
              },
              property_id: {
                type: "string",
                description: "ID of the boolean property to toggle"
              }
            },
            required: ["thing_id", "property_id"]
          }
        }
      ]
    };
  });

  // Setup the call_tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(`Request to call tool: ${request.params.name}`, request.params.arguments);

    try {
      switch (request.params.name) {
        case "list_devices":
          const devices = await client.getDevices();
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(devices.map(device => ({
                id: device.id,
                name: device.name,
                type: device.type,
                serial: device.serial
              })), null, 2) 
            }],
          };

        case "list_things":
          const things = await client.getThings();
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(things.map(thing => ({
                id: thing.id,
                name: thing.name,
                device_id: thing.device_id,
                created_at: thing.created_at
              })), null, 2) 
            }],
          };

        case "get_properties":
          const { thing_id } = request.params.arguments;
          const properties = await client.getProperties(thing_id);
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(properties.map(prop => ({
                id: prop.id,
                name: prop.name,
                variable_name: prop.variable_name,
                type: prop.type,
                permission: prop.permission
              })), null, 2) 
            }],
          };

        case "get_property_value":
          const { thing_id: propThingId, property_id } = request.params.arguments;
          const value = await client.getPropertyValue(propThingId, property_id);
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(value, null, 2) 
            }],
          };

        case "set_property_value":
          try {
            const { thing_id: setPropThingId, property_id: setPropId, value: setValue } = request.params.arguments;
            console.log(`Setting property ${setPropId} on thing ${setPropThingId} to value:`, setValue);
            
            // Eerst checken we het property type
            const properties = await client.getProperties(setPropThingId);
            const property = properties.find(p => p.id === setPropId);
            
            if (!property) {
              throw new Error(`Property ${setPropId} not found on thing ${setPropThingId}`);
            }
            
            console.log(`Found property: ${property.name} of type ${property.type}`);
            
            // Verzenden naar de client, die zal de conversie doen op basis van type
            const result = await client.setPropertyValue(setPropThingId, setPropId, setValue);
            
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  property: property.name,
                  property_type: property.type,
                  value_sent: setValue,
                  result: result
                }, null, 2) 
              }],
            };
          } catch (error) {
            console.error(`Error setting property value: ${error.message}`);
            return {
              content: [{ type: "text", text: `Error: ${error.message}` }],
            };
          }

        case "find_thing_by_name":
          const { name: thingName } = request.params.arguments;
          const allThings = await client.getThings();
          const foundThing = allThings.find(t => 
            t.name.toLowerCase() === thingName.toLowerCase()
          );
          
          return {
            content: [{ 
              type: "text", 
              text: foundThing ? JSON.stringify(foundThing, null, 2) : "Thing not found" 
            }],
          };

        case "find_property_by_name":
          const { thing_id: findPropThingId, name: propName } = request.params.arguments;
          const allProps = await client.getProperties(findPropThingId);
          const foundProp = allProps.find(p => 
            p.name.toLowerCase() === propName.toLowerCase() || 
            p.variable_name.toLowerCase() === propName.toLowerCase()
          );
          
          return {
            content: [{ 
              type: "text", 
              text: foundProp ? JSON.stringify(foundProp, null, 2) : "Property not found" 
            }],
          };

        case "toggle_property":
          const { thing_id: toggleThingId, property_id: togglePropId } = request.params.arguments;
          console.log(`Toggling property ${togglePropId.substring(0, 8)}... on thing ${toggleThingId.substring(0, 8)}...`);
          
          try {
            // Haal eerst de huidige waarde op
            const currentValue = await client.getPropertyValue(toggleThingId, togglePropId);
            // Don't log the entire value for security
            console.log(`Current property has value of type: ${typeof currentValue}`);
            
            // Bepaal de nieuwe waarde op basis van het type
            let newValue;
            
            if (typeof currentValue === 'boolean') {
              // Eenvoudige boolean toggle
              newValue = !currentValue;
              console.log(`Toggling boolean from ${currentValue} to ${newValue}`);
            } else if (typeof currentValue === 'object' && currentValue !== null) {
              // Waarschijnlijk een lamp met een complexere structuur
              if ('swi' in currentValue) {
                // Lichtschakelaar toggle
                newValue = { ...currentValue, swi: !currentValue.swi };
                console.log(`Toggling light switch state`);
              } else {
                throw new Error('Property does not have a toggleable structure');
              }
            } else {
              throw new Error(`Property is not toggleable, value type: ${typeof currentValue}`);
            }
            
            // Zet de nieuwe waarde
            const toggleResult = await client.setPropertyValue(toggleThingId, togglePropId, newValue);
            
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: true,
                  new_state: typeof newValue === 'boolean' ? newValue : 
                             (typeof newValue === 'object' && newValue !== null && 'swi' in newValue) ? 
                             newValue.swi : 'unknown'
                }, null, 2) 
              }],
            };
          } catch (error) {
            console.error(`Error toggling property: ${error.message}`);
            return {
              content: [{ type: "text", text: `Error toggling property: ${error.message}` }],
            };
          }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      console.error(`Error handling tool request: ${error.message}`);
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  });

  // Start the server with stdio transport
  console.error("Starting Arduino Cloud Controller MCP Server using stdio transport");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Arduino Cloud Controller MCP Server running on stdio");
  } catch (error) {
    console.error("Error starting Arduino Cloud Controller MCP Server:", error);
    throw error;
  }
} 