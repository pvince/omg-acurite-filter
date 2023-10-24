import { Validator } from './validator';
import { DataEntry } from '../dataCache';
import { IOMGDeviceBase, KnownType } from '../../mqtt/omg_devices/device';
import { Acurite5n1MessageType, IAcurite5n1 } from '../../mqtt/omg_devices/acurite.types';
import { is_range_valid_generic } from './validator.util';
import configuration from '../configuration';

const TypesWithHumidity = new Set<KnownType>([
  KnownType.Acurite5n1,
  KnownType.AcuriteTower,
  KnownType.AcuriteProIn,
  KnownType.AcuriteLightning
]);


/**
 * Does the newly received data have a valid humidity?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
function is_humidity_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined): number | null => (n?.get_humidity() ?? null);
  return is_range_valid_generic(prev_data_array, new_entry,
    'Humidity', get_value, configuration.validHumidityRange);
}

/**
 * Humidity Validator
 */
export class ValidateHumidity implements Validator {

  /**
   * Validates a new data entry value. Can use previous data entries to perform the validation.
   * @param prev_data_array - Previously received set of data values
   * @param new_entry - Newly received data entry
   * @returns - True if the data is valid, false otherwise.
   */
  public validate(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
    return is_humidity_valid(prev_data_array, new_entry);
  }

  /**
   * Can this validator validate this data?
   * @param device - Raw device info.
   * @returns - True if this validator will work with this device.
   */
  public canValidate(device: IOMGDeviceBase): boolean {
    let result = TypesWithHumidity.has(device.model);
    if (result && device.model === KnownType.Acurite5n1 ) {
      const fiveInOne = device as IAcurite5n1;
      result = fiveInOne.message_type === Acurite5n1MessageType.SpeedAndTemp;
    }

    return result;
  }
}
