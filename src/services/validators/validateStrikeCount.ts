import { IValidatorError, IValidatorErrorLevel, Validator } from './validator';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';
import { DataEntry } from '../dataEntries/dataEntry';
import { KnownType } from '../../mqtt/omg_devices/device';
import { IAcuriteLightning } from '../../mqtt/omg_devices/acurite.types';
import { is_range_valid_generic } from './validator.util';

// Picking some absurd value, at the moment I don't care if it suddenly shoots up.
export const VALID_RANGE = 5;

/**
 * Strike Count
 */
export class ValidateStrikeCount implements Validator {
  private previousValue = 0;

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
  public validate(prev_data_array: DataEntry[], new_entry: DataEntry): [boolean, IValidatorError | null] {
    const get_value = (n:  DataEntry | undefined):  number | null => {
      let result: number | null =  null;
      if (n?.data?.model === KnownType.AcuriteLightning ) {
        const lightningDevice = n.data as IAcuriteLightning;

        result = lightningDevice.strike_count;
      }

      return result;
    };

    const curValue = get_value(new_entry) ?? 0;

    // Let's start w/ the standard bounding limits
    let [isValid, error] = is_range_valid_generic(prev_data_array, new_entry,
        'Strike count', get_value, VALID_RANGE, { onlyIncrementing: true });

    // Next, use the new logic that works almost solely on confirming that we have received two identical values
    // in a row.
    if (this.previousValue === 0) {
      this.previousValue = curValue;
    } else if ( isValid &&  this.previousValue !== curValue) {
      isValid = false;
      error = {
        dataType: 'Strike count',
        new_value: curValue,
        prev_value:  this.previousValue,
        error_level: IValidatorErrorLevel.INFO,
        message: 'Must get same value twice in a row before it is considered valid.'
      };
      this.previousValue = curValue;
    }

    // Next, make sure it fits in our standard 'bounding' limits.

    return [isValid, error];
  }
}
