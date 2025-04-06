/**
 * Office Light Controller
 * 
 * An interactive script for controlling the office light via Arduino IoT Cloud.
 * This script allows you to turn the office light on/off and adjust brightness.
 * 
 * Usage: node test/control-office-light.js
 */

import 'dotenv/config';
import { ArduinoCloudClient } from '../lib/arduino-cloud-client.js';
import readline from 'readline';

// Configuration - Pas deze aan naar jouw specifieke setup
const THING_NAME = 'MainHomeController'; // Vervang dit met de naam van jouw thing
const OFFICE_LIGHT_NAME = 'Office_Light'; // Vervang dit met de naam van jouw office light property

// Create readline interface for interactive console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Vraag functie met Promise interface
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

// De main functie
async function main() {
  console.log('=== Arduino IoT Cloud Office Light Controller ===');
  
  try {
    // Client initialiseren
    const client = new ArduinoCloudClient(
      process.env.ARDUINO_CLIENT_ID,
      process.env.ARDUINO_CLIENT_SECRET
    );
    
    // Things ophalen
    const things = await client.getThings();
    const mainThing = things.find(t => t.name === THING_NAME);
    
    if (!mainThing) {
      console.error(`Thing '${THING_NAME}' niet gevonden. Beschikbare things:`);
      things.forEach(t => console.log(`- ${t.name}`));
      return;
    }
    
    // Properties ophalen
    const properties = await client.getProperties(mainThing.id);
    const officeLightProp = properties.find(p => 
      p.name === OFFICE_LIGHT_NAME || 
      p.variable_name === OFFICE_LIGHT_NAME
    );
    
    if (!officeLightProp) {
      console.error(`Property '${OFFICE_LIGHT_NAME}' niet gevonden. Beschikbare properties:`);
      properties.forEach(p => console.log(`- ${p.name}`));
      return;
    }
    
    console.log(`\nGevonden: ${officeLightProp.name} (${officeLightProp.type}) in ${mainThing.name}`);
    
    // Huidige status ophalen
    const currentValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
    
    // Status tonen, afhankelijk van het type
    if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
      console.log(`Huidige status: ${currentValue.swi ? 'AAN' : 'UIT'} met helderheid ${currentValue.bri}/10`);
    } else if (typeof currentValue === 'boolean') {
      console.log(`Huidige status: ${currentValue ? 'AAN' : 'UIT'}`);
    } else {
      console.log(`Huidige waarde: ${JSON.stringify(currentValue)}`);
    }
    
    // Interactieve loop
    let running = true;
    
    while (running) {
      console.log('\nMogelijke acties:');
      console.log('1. Status controleren');
      console.log('2. Licht AAN zetten');
      console.log('3. Licht UIT zetten');
      if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
        console.log('4. Helderheid aanpassen');
        console.log('5. Toggle aan/uit');
      }
      console.log('0. Afsluiten');
      
      const choice = await ask('Kies een actie (0-5): ');
      
      switch (choice) {
        case '0':
          running = false;
          console.log('Tot ziens!');
          break;
          
        case '1': {
          const value = await client.getPropertyValue(mainThing.id, officeLightProp.id);
          if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
            console.log(`Status: ${value.swi ? 'AAN' : 'UIT'} met helderheid ${value.bri}/10`);
          } else if (typeof value === 'boolean') {
            console.log(`Status: ${value ? 'AAN' : 'UIT'}`);
          } else {
            console.log(`Waarde: ${JSON.stringify(value)}`);
          }
          break;
        }
          
        case '2': {
          let setValue;
          
          if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
            // Haal huidige waarde op om de helderheid te behouden
            const currentValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
            setValue = { swi: true, bri: currentValue.bri || 5.0 };
            console.log(`Zet licht AAN met helderheid ${setValue.bri}/10...`);
          } else {
            setValue = true;
            console.log('Zet licht AAN...');
          }
          
          await client.setPropertyValue(mainThing.id, officeLightProp.id, setValue);
          console.log('Licht is nu AAN.');
          break;
        }
          
        case '3': {
          let setValue;
          
          if (officeLightProp.type === 'HOME_DIMMED_LIGHT') {
            // Haal huidige waarde op om de helderheid te behouden
            const currentValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
            setValue = { swi: false, bri: currentValue.bri || 5.0 };
            console.log(`Zet licht UIT (helderheid blijft ${setValue.bri}/10)...`);
          } else {
            setValue = false;
            console.log('Zet licht UIT...');
          }
          
          await client.setPropertyValue(mainThing.id, officeLightProp.id, setValue);
          console.log('Licht is nu UIT.');
          break;
        }
          
        case '4': {
          if (officeLightProp.type !== 'HOME_DIMMED_LIGHT') {
            console.log('Deze actie is alleen beschikbaar voor dimbare lampen.');
            break;
          }
          
          const brightnessStr = await ask('Geef de gewenste helderheid (0-10): ');
          const brightness = parseFloat(brightnessStr);
          
          if (isNaN(brightness) || brightness < 0 || brightness > 10) {
            console.log('Ongeldige waarde. Geef een getal tussen 0 en 10.');
            break;
          }
          
          // Haal huidige waarde op om de aan/uit status te behouden
          const currentValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
          
          // Als de helderheid 0 is, zet het licht uit
          const isOn = brightness > 0 ? true : false;
          
          // Stuur nieuwe waarde
          const setValue = { 
            swi: isOn, 
            bri: brightness 
          };
          
          console.log(`Zet helderheid naar ${brightness}/10 (licht ${isOn ? 'AAN' : 'UIT'})...`);
          await client.setPropertyValue(mainThing.id, officeLightProp.id, setValue);
          console.log(`Helderheid aangepast naar ${brightness}/10.`);
          break;
        }
          
        case '5': {
          if (officeLightProp.type !== 'HOME_DIMMED_LIGHT') {
            console.log('Deze actie is alleen beschikbaar voor dimbare lampen.');
            break;
          }
          
          // Haal huidige waarde op
          const currentValue = await client.getPropertyValue(mainThing.id, officeLightProp.id);
          
          // Toggle de schakelaar
          const newValue = { 
            swi: !currentValue.swi, 
            bri: currentValue.bri || 5.0 
          };
          
          console.log(`Toggle licht van ${currentValue.swi ? 'AAN' : 'UIT'} naar ${newValue.swi ? 'AAN' : 'UIT'}...`);
          await client.setPropertyValue(mainThing.id, officeLightProp.id, newValue);
          console.log(`Licht is nu ${newValue.swi ? 'AAN' : 'UIT'}.`);
          break;
        }
          
        default:
          console.log('Ongeldige keuze. Probeer opnieuw.');
      }
    }
    
  } catch (error) {
    console.error('Er is een fout opgetreden:', error.message);
  } finally {
    rl.close();
  }
}

// Run the program
main().catch(error => {
  console.error('Onbehandelde fout:', error);
  process.exit(1);
}); 