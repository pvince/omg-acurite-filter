/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-magic-numbers */
import { describe, it } from 'mocha';
import { AcuriteBatteryOk, AcuriteChannel, IAcuriteTower } from '../mqtt/omg_devices/acurite.types';
import { KnownType } from '../mqtt/omg_devices/device';
import { is_data_valid } from './dataCache';
import { expect } from 'chai';
import configuration from './configuration';
import { DataEntry } from './dataEntries/dataEntry';

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
