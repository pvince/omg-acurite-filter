import { ValidateAcuriteTemp } from './validateAcuriteTemp';
import { ValidateHumidity } from './validateHumidity';
import { ValidateRain } from './validateRain';
import { ValidateMaverickTemp } from './validateMaverickTemp';
import { DataEntry } from '../dataEntries/dataEntry';
import { ValidateStrikeCount } from './validateStrikeCount';
import { IValidatorError, Validator } from './validator';
import msgLog from '../msgLog';
import configuration from '../configuration';

const log = configuration.log.extend('validator');

let validators: Validator[] = [];

/**
 * Re-initalizes the validators back to their default state. Useful for
 * unit tests.
 */
export function initialize_validators(): void {
  validators = [
    new ValidateAcuriteTemp(),
    new ValidateHumidity(),
    new ValidateRain(),
    new ValidateMaverickTemp(),
    new ValidateStrikeCount()
  ];
}
initialize_validators();



/**
 * Does the newly received data have valid values?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
export function is_data_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  let result = true;
  let error: IValidatorError | null = null;
  for (let i = 0; i < validators.length && result; i++) {
    const curValidator = validators[i];
    if (curValidator.canValidate(new_entry.data)) {
      [result, error] = curValidator.validate(prev_data_array, new_entry);

      if (!result && error) {
        const msg = `Invalid ${error.dataType} Received! ${new_entry.get_unique_id()} [prev_value: ${error.prev_value}] [new_value: ${error.new_value}]`;
        log(msg);
        msgLog.add(new_entry.get_unique_id(), msg);
      }
    }
  }
  return result;
}
