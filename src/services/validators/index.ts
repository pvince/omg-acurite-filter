import { ValidateAcuriteTemp } from './validateAcuriteTemp';
import { ValidateHumidity } from './validateHumidity';
import { ValidateRain } from './validateRain';
import { ValidateMaverickTemp } from './validateMaverickTemp';
import { DataEntry } from '../dataEntries/dataEntry';

const validators = [
  new ValidateAcuriteTemp(),
  new ValidateHumidity(),
  new ValidateRain(),
  new ValidateMaverickTemp()
];

/**
 * Does the newly received data have valid values?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
export function is_data_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  let result = true;
  for (let i = 0; i < validators.length && result; i++) {
    const curValidator = validators[i];
    if (curValidator.canValidate(new_entry.data)) {
      result = curValidator.validate(prev_data_array, new_entry);
    }
  }
  return result;
}
