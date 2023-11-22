import { Validator } from './validator';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';
import { DataEntry } from '../dataEntries/dataEntry';
import { KnownType } from '../../mqtt/omg_devices/device';
import {  IAcuriteLightning } from '../../mqtt/omg_devices/acurite.types';
import { is_range_valid_generic } from './validator.util';

// Picking some absurd value, at the moment I don't care if it suddenly shoots up.
export const VALID_RANGE = 20;

/**
 * Strike Count
 */
export class ValidateStrikeCount implements Validator {

  /**
   * Can this validator validate this data?
   * @param device - Raw device info.
   * @returns - True if this validator will work with this device.
   */
  public canValidate(device: OMGDevice): boolean {
    return device.model === KnownType.AcuriteLightning;
  }

  /**
   * Validates a new data entry value. Can use previous data entries to perform the validation.
   * @param prev_data_array - Previously received set of data values
   * @param new_entry - Newly received data entry
   * @returns - True if the data is valid, false otherwise.
   */
  public validate(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
    const get_value = (n:  DataEntry | undefined):  number | null => {
      let result: number | null =  null;
      if (n?.data?.model === KnownType.AcuriteLightning ) {
        const lightningDevice = n.data as IAcuriteLightning;

        result = lightningDevice.strike_count;
      }

      return result;
    };

    return is_range_valid_generic(prev_data_array, new_entry,
      'Strike count', get_value, VALID_RANGE, { onlyIncrementing: true });
  }
}
