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

/**
 * Arduino Cloud Controller MCP
 * 
 * This MCP provides functions to interact with the Arduino IoT Cloud platform.
 * It allows listing devices, things, and properties, as well as controlling properties.
 * Implemented according to Model Context Protocol specification.
 */

class ArduinoCloudClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
    this.tokenExpiry = 0;
    this.propertyTypesCache = new Map(); // Cache voor property types
  }

  async ensureAuthenticated() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing Arduino Cloud API credentials. Please check your environment variables.');
    }

    const now = Date.now();
    if (!this.token || now >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.token;
  }

  async authenticate() {
    try {
      const now = Date.now();
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('audience', 'https://api2.arduino.cc/iot');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      
      const response = await fetch('https://api2.arduino.cc/iot/v1/clients/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      
      // Set token expiry (subtract 60 seconds as a safety margin)
      this.tokenExpiry = now + (data.expires_in - 60) * 1000;
      return this.token;
    } catch (error) {
      console.error('Arduino Cloud authentication error:', error.message);
      throw error;
    }
  }

  async getDevices() {
    const token = await this.ensureAuthenticated();
    const response = await fetch('https://api2.arduino.cc/iot/v2/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getThings() {
    const token = await this.ensureAuthenticated();
    const response = await fetch('https://api2.arduino.cc/iot/v2/things', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch things: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getProperties(thingId) {
    const token = await this.ensureAuthenticated();
    const response = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch properties: ${response.status} ${response.statusText}`);
    }

    const properties = await response.json();
    
    // Cache property types voor later gebruik
    properties.forEach(prop => {
      const key = `${thingId}:${prop.id}`;
      this.propertyTypesCache.set(key, prop.type);
    });
    
    return properties;
  }

  // Haal het type op van een eigenschap (uit cache of via API)
  async getPropertyType(thingId, propertyId) {
    const cacheKey = `${thingId}:${propertyId}`;
    
    // Check de cache eerst
    if (this.propertyTypesCache.has(cacheKey)) {
      return this.propertyTypesCache.get(cacheKey);
    }
    
    // Anders, haal alle eigenschappen op en update de cache
    const properties = await this.getProperties(thingId);
    const property = properties.find(p => p.id === propertyId);
    
    if (!property) {
      throw new Error(`Property ${propertyId} not found for thing ${thingId}`);
    }
    
    return property.type;
  }

  async getPropertyValue(thingId, propertyId) {
    try {
      const token = await this.ensureAuthenticated();
      
      // Haal de volledige eigenschap op in plaats van alleen de waarde
      console.log(`Fetching property details for ${propertyId} as alternative to value endpoint`);
      
      // Voeg timeout toe aan fetch-aanroepen
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconden timeout
      
      // We halen de volledige eigenschap op in plaats van alleen de waarde
      const response = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch property: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const property = await response.json();
      console.log(`Received property data:`, JSON.stringify(property));
      
      // Haal de waarde uit de eigenschap
      const value = property.last_value;
      
      if (value === undefined) {
        throw new Error(`Property does not have a last_value`);
      }
      
      // Check eigenschap type en verwerk de waarde correct
      try {
        const propType = property.type || await this.getPropertyType(thingId, propertyId);
        console.log(`Property type is: ${propType}`);
        
        // Als het een dimbaar licht is, controleer of het de juiste structuur heeft
        if (propType === 'HOME_DIMMED_LIGHT') {
          if (typeof value !== 'object' || value === null) {
            console.warn(`Expected complex object for HOME_DIMMED_LIGHT, got: ${typeof value}`, value);
            return { swi: false, bri: 5.0 }; // Fallback naar uit
          }
          
          // Zorg ervoor dat we een gestandaardiseerde structuur terugsturen
          const result = {
            swi: typeof value.swi === 'boolean' ? value.swi : false,
            bri: typeof value.bri === 'number' ? value.bri : 5.0
          };
          
          console.log(`Normalized HOME_DIMMED_LIGHT value:`, result);
          return result;
        }
      } catch (typeError) {
        console.warn(`Error checking property type: ${typeError.message}`);
      }
      
      return value;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out when fetching property value');
      }
      console.error(`Error in getPropertyValue:`, error);
      throw error;
    }
  }

  async setPropertyValue(thingId, propertyId, value) {
    try {
      const token = await this.ensureAuthenticated();
      
      // Haal eigenschap type op
      let valueToSend = value;
      try {
        // Eerst eigenschap ophalen om het type te bepalen
        const property = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(res => res.json());
        
        const propType = property.type;
        console.log(`Setting property of type: ${propType}, value:`, JSON.stringify(value));
        
        // Als het een dimbaar licht is, zorg dat we het juiste formaat gebruiken
        if (propType === 'HOME_DIMMED_LIGHT') {
          // Als value geen object is maar een boolean, convert naar juiste format
          if (typeof value === 'boolean') {
            valueToSend = { swi: value, bri: 5.0 };
            console.log(`Converting boolean ${value} to:`, valueToSend);
          } 
          // Als value een numerieke waarde is, behandel als helderheid
          else if (typeof value === 'number') {
            const brightness = Math.max(0, Math.min(10, value)); // Ensure brightness is between 0-10
            valueToSend = { swi: brightness > 0, bri: brightness };
            console.log(`Converting number ${value} to:`, valueToSend);
          }
          // Als value een string is, probeer te interpreteren
          else if (typeof value === 'string') {
            if (value.toLowerCase() === 'on' || value.toLowerCase() === 'true') {
              valueToSend = { swi: true, bri: 5.0 };
            } else if (value.toLowerCase() === 'off' || value.toLowerCase() === 'false') {
              valueToSend = { swi: false, bri: 5.0 };
            } else {
              // Probeer te parsen als nummer voor helderheid
              const brightness = parseFloat(value);
              if (!isNaN(brightness)) {
                const normalizedBrightness = Math.max(0, Math.min(10, brightness));
                valueToSend = { swi: normalizedBrightness > 0, bri: normalizedBrightness };
              } else {
                // Fallback naar uit als we het niet kunnen interpreteren
                valueToSend = { swi: false, bri: 5.0 };
              }
            }
            console.log(`Converting string "${value}" to:`, valueToSend);
          }
          // Als het een object is maar zonder juiste eigenschappen, corrigeer
          else if (typeof value === 'object' && value !== null) {
            valueToSend = { 
              swi: 'swi' in value ? Boolean(value.swi) : true,
              bri: 'bri' in value ? Math.max(0, Math.min(10, Number(value.bri))) : 5.0
            };
            console.log(`Normalizing object to:`, valueToSend);
          }
        }
      } catch (typeError) {
        console.warn(`Error checking property type: ${typeError.message}`);
      }
      
      // Voeg timeout toe aan fetch-aanroepen
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconden timeout
      
      console.log(`Sending to API:`, JSON.stringify(valueToSend));
      const response = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/value`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(valueToSend),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to set property value: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`API response:`, JSON.stringify(result));
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out when setting property value');
      }
      console.error(`Error in setPropertyValue:`, error);
      throw error;
    }
  }
}

// Initialize the Arduino Cloud client with environment variables
const client = new ArduinoCloudClient(
  process.env.ARDUINO_CLIENT_ID || '',
  process.env.ARDUINO_CLIENT_SECRET || ''
);

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
          properties: {},
          required: []
        }
      },
      {
        name: "list_things",
        description: "List all Arduino IoT Cloud things",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
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
      },
      {
        name: "turn_dimmed_light_on",
        description: "Turn on a dimmed light with specified brightness",
        inputSchema: {
          type: "object",
          properties: {
            thing_id: {
              type: "string",
              description: "ID of the thing the property belongs to"
            },
            property_id: {
              type: "string",
              description: "ID of the light property to turn on"
            },
            brightness: {
              type: "number",
              description: "Brightness level (0-10), defaults to 5.0 if not specified"
            }
          },
          required: ["thing_id", "property_id"]
        }
      },
      {
        name: "turn_dimmed_light_off",
        description: "Turn off a dimmed light",
        inputSchema: {
          type: "object",
          properties: {
            thing_id: {
              type: "string",
              description: "ID of the thing the property belongs to"
            },
            property_id: {
              type: "string",
              description: "ID of the light property to turn off"
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
        console.log(`Toggling property ${togglePropId} on thing ${toggleThingId}`);
        
        try {
          // Haal eerst de volledige eigenschap details op in plaats van alleen de waarde
          const currentProperty = await client.getProperties(toggleThingId)
            .then(properties => properties.find(p => p.id === togglePropId));
          
          if (!currentProperty) {
            throw new Error(`Property ${togglePropId} not found on thing ${toggleThingId}`);
          }
          
          const currentValue = currentProperty.last_value;
          console.log(`Current property value: ${JSON.stringify(currentValue)}`);
          
          // Handle different property types
          let newValue;
          
          if (typeof currentValue === 'boolean') {
            // Simple boolean toggle
            newValue = !currentValue;
            console.log(`Toggling boolean from ${currentValue} to ${newValue}`);
          } else if (typeof currentValue === 'object' && currentValue !== null) {
            // Likely a light with more complex structure
            if ('swi' in currentValue) {
              // Light switch toggle
              newValue = { ...currentValue, swi: !currentValue.swi };
              console.log(`Toggling light switch from ${currentValue.swi} to ${newValue.swi}`);
            } else {
              throw new Error('Property does not have a toggleable structure');
            }
          } else {
            throw new Error(`Property is not toggleable, value type: ${typeof currentValue}`);
          }
          
          // Set the new value
          const toggleResult = await client.setPropertyValue(toggleThingId, togglePropId, newValue);
          
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                previous: currentValue,
                current: newValue,
                result: toggleResult
              }, null, 2) 
            }],
          };
        } catch (error) {
          console.error(`Error toggling property: ${error.message}`);
          return {
            content: [{ type: "text", text: `Error toggling property: ${error.message}` }],
          };
        }

      case "turn_dimmed_light_on":
        try {
          const { thing_id: lightThingId, property_id: lightPropertyId, brightness = 5.0 } = request.params.arguments;
          console.log(`Turning on dimmed light ${lightPropertyId} with brightness ${brightness}`);
          
          // Eerst checken we het property type
          const properties = await client.getProperties(lightThingId);
          const property = properties.find(p => p.id === lightPropertyId);
          
          if (!property) {
            throw new Error(`Property ${lightPropertyId} not found on thing ${lightThingId}`);
          }
          
          if (property.type !== 'HOME_DIMMED_LIGHT') {
            console.warn(`Warning: Property ${property.name} is not a dimmed light but ${property.type}`);
          }
          
          // Normaliseer de helderheid (tussen 0-10)
          const normalizedBrightness = Math.max(0, Math.min(10, brightness));
          
          // Format met correcte structuur voor dimbare lamp
          const lightOnValue = {
            swi: true,
            bri: normalizedBrightness
          };
          
          console.log(`Sending to API: ${JSON.stringify(lightOnValue)}`);
          const turnOnResult = await client.setPropertyValue(lightThingId, lightPropertyId, lightOnValue);
          
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                property: property.name,
                value_sent: lightOnValue,
                result: turnOnResult
              }, null, 2) 
            }],
          };
        } catch (error) {
          console.error(`Error turning on dimmed light: ${error.message}`);
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
          };
        }

      case "turn_dimmed_light_off":
        try {
          const { thing_id: lightThingIdOff, property_id: lightPropertyIdOff } = request.params.arguments;
          console.log(`Turning off dimmed light ${lightPropertyIdOff}`);
          
          // Eerst proberen we de huidige status op te halen om de helderheid te behouden
          let currentBrightness = 5.0;
          try {
            const currentValue = await client.getPropertyValue(lightThingIdOff, lightPropertyIdOff);
            if (typeof currentValue === 'object' && currentValue !== null && 'bri' in currentValue) {
              currentBrightness = currentValue.bri;
              console.log(`Current brightness is ${currentBrightness}, will preserve it`);
            }
          } catch (error) {
            console.warn(`Could not retrieve current brightness: ${error.message}`);
          }
          
          // Eerst checken we het property type
          const propertiesOff = await client.getProperties(lightThingIdOff);
          const propertyOff = propertiesOff.find(p => p.id === lightPropertyIdOff);
          
          if (!propertyOff) {
            throw new Error(`Property ${lightPropertyIdOff} not found on thing ${lightThingIdOff}`);
          }
          
          if (propertyOff.type !== 'HOME_DIMMED_LIGHT') {
            console.warn(`Warning: Property ${propertyOff.name} is not a dimmed light but ${propertyOff.type}`);
          }
          
          // Format met correcte structuur voor dimbare lamp
          const lightOffValue = {
            swi: false,
            bri: currentBrightness  // Behoud de helderheid voor als het weer aan gaat
          };
          
          console.log(`Sending to API: ${JSON.stringify(lightOffValue)}`);
          const turnOffResult = await client.setPropertyValue(lightThingIdOff, lightPropertyIdOff, lightOffValue);
          
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                property: propertyOff.name,
                value_sent: lightOffValue,
                result: turnOffResult
              }, null, 2) 
            }],
          };
        } catch (error) {
          console.error(`Error turning off dimmed light: ${error.message}`);
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
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
async function runServer() {
  console.error("Starting Arduino Cloud Controller MCP Server using stdio transport");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Arduino Cloud Controller MCP Server running on stdio");
  } catch (error) {
    console.error("Error starting Arduino Cloud Controller MCP Server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 