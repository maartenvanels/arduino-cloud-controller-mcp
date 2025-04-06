// Arduino Cloud Controller MCP
// A generic controller MCP for the Arduino IoT Cloud platform

const fetch = require('node-fetch');

/**
 * Arduino Cloud Controller MCP
 * 
 * This MCP provides functions to interact with the Arduino IoT Cloud platform.
 * It allows listing devices, things, and properties, as well as controlling properties.
 */

class ArduinoCloudClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
    this.tokenExpiry = 0;
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
      
      // Bouw formdata op met de juiste parameters
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

    return await response.json();
  }

  async getPropertyValue(thingId, propertyId) {
    const token = await this.ensureAuthenticated();
    const response = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/value`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch property value: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async setPropertyValue(thingId, propertyId, value) {
    const token = await this.ensureAuthenticated();
    const response = await fetch(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/value`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    });

    if (!response.ok) {
      throw new Error(`Failed to set property value: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// Initialize the Arduino Cloud client with environment variables if available
const client = new ArduinoCloudClient(
  process.env.ARDUINO_CLIENT_ID || '',
  process.env.ARDUINO_CLIENT_SECRET || ''
);

// MCP definition
const ArduinoCloudController = {
  name: 'arduino_cloud_controller',
  description: 'Arduino Cloud Controller MCP for IoT device management',
  
  // Define the functions available in this MCP
  functions: [
    {
      name: 'list_devices',
      description: 'List all Arduino IoT Cloud devices',
      parameters: [],
      handler: async () => {
        try {
          const devices = await client.getDevices();
          return devices.map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            serial: device.serial
          }));
        } catch (error) {
          console.error('Error listing devices:', error);
          throw error;
        }
      }
    },
    {
      name: 'list_things',
      description: 'List all Arduino IoT Cloud things',
      parameters: [],
      handler: async () => {
        try {
          const things = await client.getThings();
          return things.map(thing => ({
            id: thing.id,
            name: thing.name,
            device_id: thing.device_id,
            created_at: thing.created_at
          }));
        } catch (error) {
          console.error('Error listing things:', error);
          throw error;
        }
      }
    },
    {
      name: 'get_properties',
      description: 'Get properties for a specific thing',
      parameters: [
        {
          name: 'thing_id',
          type: 'string',
          description: 'ID of the thing to get properties for',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const properties = await client.getProperties(params.thing_id);
          return properties.map(prop => ({
            id: prop.id,
            name: prop.name,
            variable_name: prop.variable_name,
            type: prop.type,
            permission: prop.permission
          }));
        } catch (error) {
          console.error(`Error getting properties for thing ${params.thing_id}:`, error);
          throw error;
        }
      }
    },
    {
      name: 'get_property_value',
      description: 'Get the current value of a property',
      parameters: [
        {
          name: 'thing_id',
          type: 'string',
          description: 'ID of the thing',
          required: true
        },
        {
          name: 'property_id',
          type: 'string',
          description: 'ID of the property',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          return await client.getPropertyValue(params.thing_id, params.property_id);
        } catch (error) {
          console.error(`Error getting value for property ${params.property_id}:`, error);
          throw error;
        }
      }
    },
    {
      name: 'set_property_value',
      description: 'Set the value of a property',
      parameters: [
        {
          name: 'thing_id',
          type: 'string',
          description: 'ID of the thing',
          required: true
        },
        {
          name: 'property_id',
          type: 'string',
          description: 'ID of the property',
          required: true
        },
        {
          name: 'value',
          type: 'object',
          description: 'Value to set (format depends on property type)',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          return await client.setPropertyValue(params.thing_id, params.property_id, params.value);
        } catch (error) {
          console.error(`Error setting value for property ${params.property_id}:`, error);
          throw error;
        }
      }
    },
    {
      name: 'toggle_property',
      description: 'Toggle a boolean property (or a light switch)',
      parameters: [
        {
          name: 'thing_id',
          type: 'string',
          description: 'ID of the thing',
          required: true
        },
        {
          name: 'property_id',
          type: 'string',
          description: 'ID of the property',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const currentValue = await client.getPropertyValue(params.thing_id, params.property_id);
          
          // Handle different property types
          let newValue;
          if (typeof currentValue === 'boolean') {
            // Simple boolean toggle
            newValue = !currentValue;
          } else if (typeof currentValue === 'object' && currentValue !== null) {
            // Likely a light with more complex structure
            if ('swi' in currentValue) {
              // Light switch toggle
              newValue = { ...currentValue, swi: !currentValue.swi };
            } else {
              throw new Error('Property does not have a toggleable structure');
            }
          } else {
            throw new Error('Property is not toggleable');
          }
          
          return await client.setPropertyValue(params.thing_id, params.property_id, newValue);
        } catch (error) {
          console.error(`Error toggling property ${params.property_id}:`, error);
          throw error;
        }
      }
    },
    {
      name: 'find_thing_by_name',
      description: 'Find a thing by its name',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Name of the thing to find',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const things = await client.getThings();
          const thing = things.find(t => t.name.toLowerCase() === params.name.toLowerCase());
          
          if (!thing) {
            return null;
          }
          
          return {
            id: thing.id,
            name: thing.name,
            device_id: thing.device_id,
            created_at: thing.created_at
          };
        } catch (error) {
          console.error(`Error finding thing by name ${params.name}:`, error);
          throw error;
        }
      }
    },
    {
      name: 'find_property_by_name',
      description: 'Find a property by its name within a thing',
      parameters: [
        {
          name: 'thing_id',
          type: 'string',
          description: 'ID of the thing to search in',
          required: true
        },
        {
          name: 'name',
          type: 'string',
          description: 'Name of the property to find',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const properties = await client.getProperties(params.thing_id);
          const property = properties.find(p => 
            p.name.toLowerCase() === params.name.toLowerCase() || 
            p.variable_name.toLowerCase() === params.name.toLowerCase()
          );
          
          if (!property) {
            return null;
          }
          
          return {
            id: property.id,
            name: property.name,
            variable_name: property.variable_name,
            type: property.type,
            permission: property.permission
          };
        } catch (error) {
          console.error(`Error finding property by name ${params.name}:`, error);
          throw error;
        }
      }
    }
  ],
  
  // Configuration options
  config: {
    clientId: {
      type: 'string',
      description: 'Arduino IoT Cloud Client ID',
      required: true
    },
    clientSecret: {
      type: 'string',
      description: 'Arduino IoT Cloud Client Secret',
      required: true
    }
  }
};

module.exports = ArduinoCloudController; 