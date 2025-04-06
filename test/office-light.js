/**
 * Office Light Test
 * 
 * A test script for checking the Arduino Cloud Client implementation
 * specifically focusing on retrieving devices and checking the office light status.
 * 
 * Usage: node test/office-light.js
 */

import 'dotenv/config';
import { ArduinoCloudClient } from '../lib/arduino-cloud-client.js';

// Configuration
const THING_NAME = 'MainHomeController'; // Vervang dit met de naam van jouw thing
const OFFICE_LIGHT_NAME = 'Office_Light'; // Vervang dit met de naam van jouw office light property

/**
 * Main test function
 */
async function main() {
  console.log('Starting Office Light Test');
  
  try {
    // Initialize the Arduino Cloud client with environment variables
    const client = new ArduinoCloudClient(
      process.env.ARDUINO_CLIENT_ID,
      process.env.ARDUINO_CLIENT_SECRET
    );
    
    // Stap 1: Haal alle apparaten op
    console.log('\n--- DEVICES ---');
    const devices = await client.getDevices();
    console.log(`Found ${devices.length} devices:`);
    devices.forEach(device => {
      console.log(`- ${device.name} (${device.id}): ${device.type}`);
    });
    
    // Stap 2: Haal alle things op
    console.log('\n--- THINGS ---');
    const things = await client.getThings();
    console.log(`Found ${things.length} things:`);
    things.forEach(thing => {
      console.log(`- ${thing.name} (${thing.id})`);
    });
    
    // Stap 3: Zoek de main controller thing
    console.log(`\n--- FINDING THING: ${THING_NAME} ---`);
    const mainThing = things.find(t => t.name === THING_NAME);
    
    if (!mainThing) {
      console.error(`Thing with name '${THING_NAME}' not found! Available things:`);
      things.forEach(t => console.log(`- ${t.name}`));
      process.exit(1);
    }
    
    console.log(`Found thing: ${mainThing.name} (${mainThing.id})`);
    
    // Stap 4: Haal alle eigenschappen van de thing op
    console.log('\n--- PROPERTIES ---');
    const properties = await client.getProperties(mainThing.id);
    console.log(`Found ${properties.length} properties on ${mainThing.name}:`);
    properties.forEach(prop => {
      console.log(`- ${prop.name} (${prop.id}): ${prop.type}`);
    });
    
    // Stap 5: Zoek de office light eigenschap
    console.log(`\n--- FINDING PROPERTY: ${OFFICE_LIGHT_NAME} ---`);
    const officeLightProp = properties.find(p => 
      p.name === OFFICE_LIGHT_NAME || 
      p.variable_name === OFFICE_LIGHT_NAME
    );
    
    if (!officeLightProp) {
      console.error(`Property with name '${OFFICE_LIGHT_NAME}' not found! Available properties:`);
      properties.forEach(p => console.log(`- ${p.name} (${p.variable_name})`));
      process.exit(1);
    }
    
    console.log(`Found property: ${officeLightProp.name} (${officeLightProp.id}) of type ${officeLightProp.type}`);
    
    // Stap 6: Controleer de huidige waarde van de office light
    console.log('\n--- CURRENT OFFICE LIGHT STATUS ---');
    const lightValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
    
    if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
      console.log(`Office light status: ${lightValue.swi ? 'ON' : 'OFF'} at brightness ${lightValue.bri}`);
    } else if (typeof lightValue === 'boolean') {
      console.log(`Office light status: ${lightValue ? 'ON' : 'OFF'}`);
    } else {
      console.log(`Office light value:`, lightValue);
    }
    
    // Stap 7: Controleer alle overige eigenschappen
    console.log('\n--- ALL PROPERTY VALUES ---');
    for (const prop of properties) {
      try {
        const value = await client.getPropertyValue(mainThing.id, prop.id);
        console.log(`- ${prop.name}: ${JSON.stringify(value)}`);
      } catch (error) {
        console.log(`- ${prop.name}: Error: ${error.message}`);
      }
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 