import { IOMGDeviceBase, KnownType } from '../../mqtt/omg_devices/device';
import { Validator } from './validator';
import { Acurite5n1MessageType, IAcurite5n1 } from '../../mqtt/omg_devices/acurite.types';
import { DataEntry } from '../dataCache';
import { is_range_valid_generic } from './validator.util';
import configuration from '../configuration';

const TypesWithTemperature = new Set<KnownType>([
  KnownType.Acurite5n1,
  KnownType.AcuriteTower,
  KnownType.AcuriteProIn,
  KnownType.AcuriteLightning
]);


/**
 * Does the newly received data have a valid temperature?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
function is_temperature_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined): number | null => (n?.get_temperature() ?? null);
  return is_range_valid_generic(prev_data_array, new_entry,
    'Temperature', get_value, configuration.validTemperatureRange);
}

/**
 * Validates devices w/ temperature values.
 */
export class ValidateTemperature implements Validator {
  /**
   * Validates a new data entry value. Can use previous data entries to perform the validation.
   * @param prev_data_array - Previously received set of data values
   * @param new_entry - Newly received data entry
   * @returns - True if the data is valid, false otherwise.
   */
  public validate(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
    return is_temperature_valid(prev_data_array, new_entry);
  }

  /**
   * Can this validator validate this data?
   * @param device - Raw device info.
   * @returns - True if this validator will work with this device.
   */
  public canValidate(device: IOMGDeviceBase): boolean {
    let result = TypesWithTemperature.has(device.model);
    if (result && device.model === KnownType.Acurite5n1 ) {
      const fiveInOne = device as IAcurite5n1;
      result = fiveInOne.message_type === Acurite5n1MessageType.SpeedAndTemp;
    }

    return result;
  }
}
