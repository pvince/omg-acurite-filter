/* eslint-disable @typescript-eslint/no-unused-expressions */
import { describe, it } from 'mocha';
import { Acurite5n1MessageType, AcuriteChannel, IAcurite5n1_WindAndRain } from '../../mqtt/omg_devices/acurite.types';
import { KnownType } from '../../mqtt/omg_devices/device';
import { DataEntry } from '../dataCache';
import { ValidateRain } from './validateRain';
import { expect } from 'chai';

/**
 * Get a typical Acurite 5n1 rain  reading.
 * @param fiveInOneOpts - Specific configuration settings for the returned object
 * @returns - Returns a 5n1 Wind & Rain message
 */
export function get_acurite_5in1_rain(fiveInOneOpts: Partial<IAcurite5n1_WindAndRain> = {}): IAcurite5n1_WindAndRain {
  const default_object: IAcurite5n1_WindAndRain = {
    'model': KnownType.Acurite5n1,
    'message_type':  Acurite5n1MessageType.WindAndRain,
    'id': '2447',
    'channel': AcuriteChannel.A,
    'battery_ok': 1,
    'wind_avg_km_h': 0,
    'wind_dir_deg': 157.5,
    'rain_mm': 877.823,
    'rssi': -93
  };
  return { ...default_object, ...fiveInOneOpts };
}

/**
 * Create a new DataEntry based on the parameters.
 * @param fiveInOneOpts - 5n1 constructions options
 * @param topic - Topic we received the data at
 * @returns - A newly constructed DataEntry
 */
export function get_data_entry(fiveInOneOpts: Partial<IAcurite5n1_WindAndRain> = {},
                               topic = '433_direct/OMG_lilygo_rtl_433_ESP_2/RTL_433toMQTT/Acurite-Tower/A/5476'): DataEntry {
  return new DataEntry(topic, get_acurite_5in1_rain(fiveInOneOpts));
}

describe('validaateRain', () => {
  it('should allow the same value', () => {
    const prev_values = [
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 888.0 })
    ];

    const new_data = get_data_entry({ rain_mm: 888.0 });
    const validator = new ValidateRain();
    expect(validator.canValidate(new_data.data)).to.be.true;
    expect(validator.validate(prev_values, new_data)).to.be.true;
  });

  it('should allow higher values', () => {
    const prev_values = [
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 888.0 })
    ];

    const new_data = get_data_entry({ rain_mm: 888.1 });
    const validator = new ValidateRain();
    expect(validator.canValidate(new_data.data)).to.be.true;
    expect(validator.validate(prev_values, new_data)).to.be.true;
  });

  it('should prevent lower values', () => {
    const prev_values = [
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 887.5 }),
      get_data_entry({ rain_mm: 888.0 })
    ];

    const new_data = get_data_entry({ rain_mm: 887.9 });
    const validator = new ValidateRain();
    expect(validator.canValidate(new_data.data)).to.be.true;
    expect(validator.validate(prev_values, new_data)).to.be.false;
  });
});
