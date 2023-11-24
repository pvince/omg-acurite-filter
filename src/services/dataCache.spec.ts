/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-magic-numbers */
import { describe, it } from 'mocha';
import { AcuriteBatteryOk, AcuriteChannel, IAcuriteTower } from '../mqtt/omg_devices/acurite.types';
import { KnownType } from '../mqtt/omg_devices/device';
import { assert, expect } from 'chai';
import configuration from './configuration';
import { DataEntry } from './dataEntries/dataEntry';
import { is_data_valid } from './validators';
import * as fs from 'fs';
import { DataCache } from './dataCache';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import { OMGDevice } from '../mqtt/omg_devices/device.types';

/**
 * Gets a default constructed tower object.
 * @param tower_opts - Optional, overide default values
 * @returns - Returns a tower object
 */
function get_acurite_tower(tower_opts: Partial<IAcuriteTower> = {}): IAcuriteTower {
  const default_object: IAcuriteTower = {
    id: '5476',
    battery_ok: AcuriteBatteryOk.Yes,
    channel: AcuriteChannel.A,
    humidity: 45,
    model: KnownType.AcuriteTower,
    rssi: -50,
    temperature_C: 65
  };

  return { ...default_object, ...tower_opts };
}


let MQTT_MSG_CACHE: IMQTTMessage[] | null = null;

/**
 * Returns the recorded MQTT messages.
 * @returns - Recorded MQTT messages
 */
export async function get_mqtt_msg_log(): Promise<IMQTTMessage[]> {
  if (MQTT_MSG_CACHE === null) {
    MQTT_MSG_CACHE = [];

    try {
      const fileContents = await fs.promises.readFile('testData/mqtt_msgs.log', { encoding: 'utf-8' });
      const lines = fileContents.split('\n');

      let i = 0;
      for (const line of lines) {
        i++;
        try {
          if (line.length > 0) {
            const mqttMsg: IMQTTMessage = JSON.parse(line);
            mqttMsg.data = JSON.parse(mqttMsg.message);
            MQTT_MSG_CACHE.push(mqttMsg);
          }
        } catch (ex) {
          assert.fail(`Failed to logged message for line ${i} - [${line}] - ${ex}`);
        }

      }
    } catch (ex) {
      assert.fail(`${ex}`);
    }
  }

  return MQTT_MSG_CACHE;
}

/**
 * Create a new DataEntry based on the parameters.
 * @param tower_opts - Tower constructions options
 * @param topic - Topic we received the data at
 * @returns - A newly constructed DataEntry
 */
function get_data_entry(tower_opts: Partial<IAcuriteTower> = {},
                        topic = '433_direct/OMG_lilygo_rtl_433_ESP_2/RTL_433toMQTT/Acurite-Tower/A/5476'): DataEntry {
  return new DataEntry(topic, get_acurite_tower(tower_opts));
}

describe('is_data_valid', () => {
  describe('temperature tests', () => {
    it('should be valid, same as last', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ temperature_C: 65 }),
        get_data_entry({ temperature_C: 65.1 }),
        get_data_entry({ temperature_C: 65.2 }),
        get_data_entry({ temperature_C: 66 })
      ];

      const new_data = get_data_entry({ temperature_C: 66 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('highest possible valid value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ temperature_C: 65 }),
        get_data_entry({ temperature_C: 65.1 }),
        get_data_entry({ temperature_C: 65.2 }),
        get_data_entry({ temperature_C: 66 })
      ];

      const new_data = get_data_entry({ temperature_C: 66 + configuration.validTemperatureRange });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('lowest possible valid value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ temperature_C: 65 }),
        get_data_entry({ temperature_C: 65.1 }),
        get_data_entry({ temperature_C: 65.2 }),
        get_data_entry({ temperature_C: 66 })
      ];

      const new_data = get_data_entry({ temperature_C: 66 - configuration.validTemperatureRange });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('Invalid low value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ temperature_C: 65 }),
        get_data_entry({ temperature_C: 65.1 }),
        get_data_entry({ temperature_C: 65.2 }),
        get_data_entry({ temperature_C: 66 })
      ];

      const new_data = get_data_entry({ temperature_C: 66 - configuration.validTemperatureRange - 0.1 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.false;
    });

    it('Invalid high value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ temperature_C: 65 }),
        get_data_entry({ temperature_C: 65.1 }),
        get_data_entry({ temperature_C: 65.2 }),
        get_data_entry({ temperature_C: 66 })
      ];

      const new_data = get_data_entry({ temperature_C: 66 + configuration.validTemperatureRange + 0.1 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.false;
    });
  });

  describe('humidity tests', () => {
    it('should be valid, same as last', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ humidity: 65 }),
        get_data_entry({ humidity: 65.1 }),
        get_data_entry({ humidity: 65.2 }),
        get_data_entry({ humidity: 66 })
      ];

      const new_data = get_data_entry({ humidity: 66 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('highest possible valid value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ humidity: 65 }),
        get_data_entry({ humidity: 65.1 }),
        get_data_entry({ humidity: 65.2 }),
        get_data_entry({ humidity: 66 })
      ];

      const new_data = get_data_entry({ humidity: 66 + configuration.validHumidityRange });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('lowest possible valid value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ humidity: 65 }),
        get_data_entry({ humidity: 65.1 }),
        get_data_entry({ humidity: 65.2 }),
        get_data_entry({ humidity: 66 })
      ];

      const new_data = get_data_entry({ humidity: 66 - configuration.validHumidityRange });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.true;
    });

    it('Invalid low value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ humidity: 65 }),
        get_data_entry({ humidity: 65.1 }),
        get_data_entry({ humidity: 65.2 }),
        get_data_entry({ humidity: 66 })
      ];

      const new_data = get_data_entry({ humidity: 66 - configuration.validHumidityRange - 0.1 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.false;
    });

    it('Invalid high value', () => {
      // Build a list of 'pre-existing' temperature values.
      const data_array = [
        get_data_entry({ humidity: 65 }),
        get_data_entry({ humidity: 65.1 }),
        get_data_entry({ humidity: 65.2 }),
        get_data_entry({ humidity: 66 })
      ];

      const new_data = get_data_entry({ humidity: 66 + configuration.validHumidityRange + 0.1 });

      const result = is_data_valid(data_array, new_data);
      expect(result).to.be.false;
    });
  });
});

describe('DataCache', () => {
  it('should have all valid messages', async () => {
    const dataCache = new DataCache();
    const msg_log = await get_mqtt_msg_log();
    let i = 0;
    for ( const msg of msg_log ) {
      i++;
      const dataEntry = new DataEntry(msg.topic, msg.data as OMGDevice);
      const result = dataCache.add(msg.topic, dataEntry);

      expect(result, `${i} - ${msg.topic} failed validation?`).to.be.true;
    }
  });
});
