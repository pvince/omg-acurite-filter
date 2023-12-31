import { IValidatorError, Validator } from './validator';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';
import { DataEntry } from '../dataEntries/dataEntry';
import { KnownType } from '../../mqtt/omg_devices/device';
import { IRangeOptions, is_range_valid_generic } from './validator.util';

const TEMP_RANGE = 30;
const MINIMUM_VALID = -17.7778;

/**
 * Get the food temperature
 * @param n - Possible data value.
 * @returns - The food temperature, or null if input was not valid.
 */
function get_temp_1(n: DataEntry | undefined): number | null  {
  let result: number | null = null;
  if (n?.data.model === KnownType.MaverickET73) {
      n.data.temperature_1_C = Math.max(n.data.temperature_1_C, MINIMUM_VALID);
      result = n.data.temperature_1_C;
  }
  return result;
}

/**
 * Get the oven temperature
 * @param n - Possible data value.
 * @returns - The oven temperature, or null if input was not valid.
 */
function get_temp_2(n: DataEntry | undefined): number | null  {
    let result: number | null = null;
    if (n?.data.model === KnownType.MaverickET73) {
        n.data.temperature_2_C = Math.max(n.data.temperature_2_C, MINIMUM_VALID);
        result = n.data.temperature_2_C;
    }
    return result;
}

/**
 * Maverick temperature probe data validator
 */
export class ValidateMaverickTemp implements Validator {
    /**
     * Can this validator validate this data?
     * @param device - Raw device info.
     * @returns - True if this validator will work with this device.
     */
    public canValidate(device: OMGDevice): boolean {
        return device.model === KnownType.MaverickET73;
    }

    /**
     * Validates a new data entry value. Can use previous data entries to perform the validation.
     * @param prev_data_array - Previously received set of data values
     * @param new_entry - Newly received data entry
     * @returns - True if the data is valid, false otherwise.
     */
    public validate(prev_data_array: DataEntry[], new_entry: DataEntry): [boolean, IValidatorError | null] {
        let result = false;
        let error: IValidatorError | null = null;

        if (new_entry.data.model === KnownType.MaverickET73) {
            const validationOpts: Partial<IRangeOptions> = { minimumTemperature: MINIMUM_VALID };

            [result, error] = is_range_valid_generic(prev_data_array, new_entry, 'Food temperature',
                get_temp_1, TEMP_RANGE, validationOpts);

            if (result) {
                [result, error] = is_range_valid_generic(prev_data_array, new_entry, 'Oven temperature',
                  get_temp_2, TEMP_RANGE, validationOpts);
            }
        }

        return [result, error];
    }

}
