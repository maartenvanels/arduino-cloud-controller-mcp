/**
 * Arduino Cloud Client
 * 
 * A client for interacting with the Arduino IoT Cloud API.
 * This client handles authentication, caching, and simplifies API operations.
 */

import fetch from 'node-fetch';

/**
 * Type definitions for the Arduino Cloud API
 * @typedef {Object} ArduinoPropertyValue
 * @property {boolean} [swi] - Switch state (for dimmed lights)
 * @property {number} [bri] - Brightness (for dimmed lights, 0-10)
 */

/**
 * Client for the Arduino IoT Cloud API
 */
export class ArduinoCloudClient {
  /**
   * Create a new Arduino Cloud Client
   * @param {string} clientId - The client ID from Arduino IoT Cloud
   * @param {string} clientSecret - The client secret from Arduino IoT Cloud
   */
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
    this.tokenExpiry = 0;
    this.propertyTypesCache = new Map(); // Cache voor property types
    this.timeout = 10000; // Default timeout of 10 seconds
  }

  /**
   * Set the timeout for API requests
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.timeout = timeout;
  }

  /**
   * Ensures the client is authenticated before making API calls
   * @returns {Promise<string>} The valid access token
   * @throws {Error} If authentication fails or credentials are missing
   */
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

  /**
   * Authenticate with the Arduino IoT Cloud API
   * @private
   * @returns {Promise<string>} The access token
   * @throws {Error} If authentication fails
   */
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
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      
      // Set token expiry (subtract 60 seconds as a safety margin)
      this.tokenExpiry = now + (data.expires_in - 60) * 1000;
      return this.token;
    } catch (error) {
      console.error('Arduino Cloud authentication error:', error.message);
      throw new Error('Failed to authenticate with Arduino Cloud. Check your credentials.');
    }
  }

  /**
   * Execute a request to the Arduino IoT Cloud API with timeout and token handling
   * @private
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} The API response
   * @throws {Error} If the API request fails or times out
   */
  async execApiRequest(url, options = {}) {
    try {
      const token = await this.ensureAuthenticated();
      
      // Add authorization header
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };
      
      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        // Don't log the full error text which might contain sensitive info
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms when calling ${url}`);
      }
      
      // Re-throw the error with sanitized context
      throw new Error(`API request error for ${url.split('?')[0]}: ${error.message}`);
    }
  }

  /**
   * Get all devices from the Arduino IoT Cloud
   * @returns {Promise<Array>} List of devices
   */
  async getDevices() {
    return this.execApiRequest('https://api2.arduino.cc/iot/v2/devices');
  }

  /**
   * Get all things from the Arduino IoT Cloud
   * @returns {Promise<Array>} List of things
   */
  async getThings() {
    return this.execApiRequest('https://api2.arduino.cc/iot/v2/things');
  }

  /**
   * Get all properties for a specific thing
   * @param {string} thingId - ID of the thing
   * @returns {Promise<Array>} List of properties
   */
  async getProperties(thingId) {
    if (!thingId) {
      throw new Error('Thing ID is required');
    }
    
    const properties = await this.execApiRequest(`https://api2.arduino.cc/iot/v2/things/${thingId}/properties`);
    
    // Cache property types
    if (Array.isArray(properties)) {
      properties.forEach(prop => {
        const key = `${thingId}:${prop.id}`;
        this.propertyTypesCache.set(key, prop.type);
      });
    }
    
    return properties;
  }

  /**
   * Get the type of a property from cache or API
   * @param {string} thingId - ID of the thing
   * @param {string} propertyId - ID of the property
   * @returns {Promise<string>} Property type
   */
  async getPropertyType(thingId, propertyId) {
    if (!thingId || !propertyId) {
      throw new Error('Both Thing ID and Property ID are required');
    }
    
    const cacheKey = `${thingId}:${propertyId}`;
    
    // Check cache first
    if (this.propertyTypesCache.has(cacheKey)) {
      return this.propertyTypesCache.get(cacheKey);
    }
    
    // Get all properties and update cache
    const properties = await this.getProperties(thingId);
    const property = properties.find(p => p.id === propertyId);
    
    if (!property) {
      throw new Error(`Property ${propertyId} not found for thing ${thingId}`);
    }
    
    return property.type;
  }

  /**
   * Get the current value of a property
   * @param {string} thingId - ID of the thing
   * @param {string} propertyId - ID of the property
   * @returns {Promise<any>} Property value
   */
  async getPropertyValue(thingId, propertyId) {
    if (!thingId || !propertyId) {
      throw new Error('Both Thing ID and Property ID are required');
    }
    
    try {
      // Get full property details instead of just the value
      console.log(`Fetching property details for property ID: ${propertyId.substring(0, 8)}...`);
      
      const property = await this.execApiRequest(
        `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`
      );
      
      // Don't log the full property data which might contain sensitive info
      console.log(`Received property data for type: ${property.type || 'unknown'}`);
      
      // Extract the value
      const value = property.last_value;
      
      if (value === undefined) {
        throw new Error(`Property does not have a last_value`);
      }
      
      // Handle special property types
      try {
        const propType = property.type || await this.getPropertyType(thingId, propertyId);
        console.log(`Property type is: ${propType}`);
        
        // Handle dimmed light properties
        if (propType === 'HOME_DIMMED_LIGHT') {
          if (typeof value !== 'object' || value === null) {
            console.warn(`Expected complex object for HOME_DIMMED_LIGHT, got: ${typeof value}`);
            return { swi: false, bri: 5.0 }; // Fallback to off
          }
          
          // Ensure standardized structure
          const result = {
            swi: typeof value.swi === 'boolean' ? value.swi : false,
            bri: typeof value.bri === 'number' ? value.bri : 5.0
          };
          
          // Don't log detailed values that might contain sensitive info
          console.log(`Normalized HOME_DIMMED_LIGHT value`);
          return result;
        }
      } catch (typeError) {
        console.warn(`Error checking property type: ${typeError.message}`);
      }
      
      return value;
    } catch (error) {
      console.error(`Error in getPropertyValue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set the value of a property
   * @param {string} thingId - ID of the thing
   * @param {string} propertyId - ID of the property
   * @param {any} value - Value to set
   * @returns {Promise<any>} API response
   */
  async setPropertyValue(thingId, propertyId, value) {
    if (!thingId || !propertyId) {
      throw new Error('Both Thing ID and Property ID are required');
    }
    
    try {
      // Determine property type
      let valueToSend = value;
      try {
        // First get the property to determine its type
        const property = await this.execApiRequest(
          `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`
        );
        
        const propType = property.type;
        // Don't log actual values that might contain sensitive info
        console.log(`Setting property of type: ${propType}`);
        
        // Handle dimmed light properties
        if (propType === 'HOME_DIMMED_LIGHT') {
          valueToSend = this.normalizeDimmedLightValue(value);
        }
      } catch (typeError) {
        console.warn(`Error checking property type: ${typeError.message}`);
      }
      
      // Don't log detailed values for security
      console.log(`Sending data to API...`);
      
      // Send the value to the API
      const result = await this.execApiRequest(
        `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/value`, 
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(valueToSend)
        }
      );
      
      // Don't log detailed results for security
      console.log(`Received API response successfully`);
      return result;
    } catch (error) {
      console.error(`Error in setPropertyValue: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Normalize a value for a dimmed light property
   * @private
   * @param {any} value - Input value
   * @returns {ArduinoPropertyValue} Normalized value
   */
  normalizeDimmedLightValue(value) {
    // If value is a boolean, convert to correct format
    if (typeof value === 'boolean') {
      return { swi: value, bri: 5.0 };
    } 
    // If value is a number, treat as brightness
    else if (typeof value === 'number') {
      const brightness = Math.max(0, Math.min(10, value)); // Ensure brightness is between 0-10
      return { swi: brightness > 0, bri: brightness };
    }
    // If value is a string, try to interpret
    else if (typeof value === 'string') {
      if (value.toLowerCase() === 'on' || value.toLowerCase() === 'true') {
        return { swi: true, bri: 5.0 };
      } else if (value.toLowerCase() === 'off' || value.toLowerCase() === 'false') {
        return { swi: false, bri: 5.0 };
      } else {
        // Try to parse as number for brightness
        const brightness = parseFloat(value);
        if (!isNaN(brightness)) {
          const normalizedBrightness = Math.max(0, Math.min(10, brightness));
          return { swi: normalizedBrightness > 0, bri: normalizedBrightness };
        } else {
          // Fallback to off if we can't interpret
          return { swi: false, bri: 5.0 };
        }
      }
    }
    // If object but without correct properties, correct
    else if (typeof value === 'object' && value !== null) {
      return { 
        swi: 'swi' in value ? Boolean(value.swi) : true,
        bri: 'bri' in value ? Math.max(0, Math.min(10, Number(value.bri))) : 5.0
      };
    }
    
    // Default fallback
    return { swi: false, bri: 5.0 };
  }
} 