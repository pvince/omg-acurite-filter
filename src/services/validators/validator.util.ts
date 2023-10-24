import { DataEntry } from '../dataCache';
import configuration from '../configuration';

const log = configuration.log.extend('validator');

/**
 * This is a common method that verifies that the new data entry is valid in the context of the previously received
 * data.
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @param data_type_name - Identifier name for this type of data. This is used in log messages.
 * @param get_value - Function to retrieve the value for the type of data being validated
 * @param valid_range - What is a valid +/- range for the data?
 * @returns - True if the data is valid, false otherwise.
 */
export function is_range_valid_generic(prev_data_array: DataEntry[], new_entry: DataEntry,
                                       data_type_name: string,
                                       get_value: (n: DataEntry | undefined) => number | null,
                                       valid_range: number): boolean {
  const new_value = get_value(new_entry);
  const prev_value = get_value(prev_data_array[prev_data_array.length - 1]);

  let isValid = new_value === null || prev_value === null;

  if (new_value !== null && prev_value !== null) {
    const valid_min = prev_value - valid_range;
    const valid_max = prev_value + valid_range;

    isValid = new_value >= valid_min && new_value <= valid_max;
  }

  if (!isValid) {
    log(`Invalid ${data_type_name} Received! ${new_entry.get_unique_id()} [prev_value: ${prev_value}] [new_value: ${new_value}]`);
  }

  return isValid;
}