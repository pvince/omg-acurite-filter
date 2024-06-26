import { DataEntry } from '../dataEntries/dataEntry';
import _ from 'lodash';
import { IValidatorError, IValidatorErrorLevel } from './validator';


/**
 * Optional parameters to the almighty generic range validator
 */
export interface IRangeOptions {
  /**
   * Should it only allow incrementing values? Eg: No values lower than the most recent value.
   */
  onlyIncrementing: boolean;

  /**
   * Minimum valid temperature
   */
  minimumTemperature: number;
}

/**
 * This is a common method that verifies that the new data entry is valid in the context of the previously received
 * data.
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @param data_type_name - Identifier name for this type of data. This is used in log messages.
 * @param get_value - Function to retrieve the value for the type of data being validated
 * @param valid_range - What is a valid +/- range for the data?
 * @param opts - Optional parameters
 * @returns - True if the data is valid, false otherwise.
 */
export function is_range_valid_generic(prev_data_array: DataEntry[], new_entry: DataEntry,
                                       data_type_name: string,
                                       get_value: (n: DataEntry | undefined) => number | null,
                                       valid_range: number,
                                       opts: Partial<IRangeOptions> = {}): [boolean, IValidatorError | null] {
  const new_value = get_value(new_entry);
  const prev_value = get_value(prev_data_array[prev_data_array.length - 1]);

  let isValid = new_value === null || prev_value === null;
  let message: string | null = null;

  if (new_value === null) {
    isValid = false;
  }

  if (new_value !== null && prev_value !== null) {
    let valid_min = prev_value - valid_range;
    if (opts?.onlyIncrementing) {
      valid_min = prev_value;
    }
    const valid_max = prev_value + valid_range;

    isValid = new_value >= valid_min && new_value <= valid_max;

    if ( !isValid ) {
      message = `Valid range ${valid_range}`;
    }
  }

  if (isValid && new_value !== null) {
    if (_.isNumber(opts.minimumTemperature)) {
      isValid = new_value >= opts.minimumTemperature;
    }

    if (!isValid) {
      message = `Value below the minimum temperature limit of ${opts.minimumTemperature}`;
    }
  }

  let error: IValidatorError | null = null;
  if (!isValid) {
    error = {
      dataType: data_type_name,
      prev_value: prev_value,
      new_value: new_value,
      error_level: IValidatorErrorLevel.ERROR,
      message: message
    };
  }

  return [isValid, error];
}
