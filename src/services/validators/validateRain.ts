import { IOMGDeviceBase, KnownType } from '../../mqtt/omg_devices/device';
import { IValidatorError, Validator } from './validator';
import { is_range_valid_generic } from './validator.util';
import { Acurite5n1MessageType, IAcurite5n1 } from '../../mqtt/omg_devices/acurite.types';
import { DataEntry } from '../dataEntries/dataEntry';

// Picking some absurd value, at the moment I don't care if it suddenly shoots up.
const VALID_RANGE = 99999;

/**
 * Validates devices w/ temperature values.
 */
export class ValidateRain implements Validator {
  /**
   * Validates a new data entry value. Can use previous data entries to perform the validation.
   * @param prev_data_array - Previously received set of data values
   * @param new_entry - Newly received data entry
   * @returns - True if the data is valid, false otherwise.
   */
  public validate(prev_data_array: DataEntry[], new_entry: DataEntry): [boolean, IValidatorError | null] {
    const get_value = (n:  DataEntry | undefined): number | null => {
      let result: number | null =  null;
      if (n?.data?.model === KnownType.Acurite5n1 ) {
        const fiveIn1 = n.data as IAcurite5n1;

        if (fiveIn1.message_type === Acurite5n1MessageType.WindAndRain) {
          result = fiveIn1.rain_mm;
        }
      }

      return result;
    };
    return is_range_valid_generic(prev_data_array, new_entry,
      'Rain MM', get_value, VALID_RANGE, { onlyIncrementing: true });
  }

  /**
   * Can this validator validate this data?
   * @param device - Raw device info.
   * @returns - True if this validator will work with this device.
   */
  public canValidate(device: IOMGDeviceBase): boolean {
    let result = false;
    if (device.model === KnownType.Acurite5n1) {
      result = (device as IAcurite5n1).message_type === Acurite5n1MessageType.WindAndRain;
    }
    return result;
  }
}
