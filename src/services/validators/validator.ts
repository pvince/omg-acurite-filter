import { IOMGDeviceBase } from '../../mqtt/omg_devices/device';
import { DataEntry } from '../dataCache';

/**
 * Abstract base Validator class.
 */
export abstract class Validator {
  /**
   * Can this validator validate this data?
   * @param device - Raw device info.
   * @returns - True if this validator will work with this device.
   */
  public abstract canValidate(device: IOMGDeviceBase): boolean;

  /**
   * Validates a new data entry value. Can use previous data entries to perform the validation.
   * @param prev_data_array - Previously received set of data values
   * @param new_entry - Newly received data entry
   * @returns - True if the data is valid, false otherwise.
   */
  public abstract validate(prev_data_array: DataEntry[], new_entry: DataEntry): boolean;
}

