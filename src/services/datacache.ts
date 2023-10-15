import { IOMGDeviceBase } from '../mqtt/omg_devices/device';
import configuration from './configuration';
import { AcuriteDevice, AcuriteTypes, getAcuriteHumidity, getAcuriteTemperature, getUniqueAcuriteID } from '../mqtt/omg_devices/acurite';

const log =  configuration.log.extend('dataCache');

/**
 * Individual data entry.
 */
export class DataEntry {
  public readonly topic: string;

  public readonly data: IOMGDeviceBase;

  public readonly timestamp: Date;

  /**
   * Constructor
   * @param topic - MQTT Topic
   * @param data - MQTT message data
   */
  public constructor(topic: string, data: IOMGDeviceBase) {
    this.topic = topic;
    this.data = data;
    this.timestamp = new Date();
  }

  /**
   * Gets a unique identifier for this data entry.
   * @returns - Returns a unique identifier for this data entry.
   */
  public get_unique_id(): string {
    if (AcuriteTypes.includes(this.data.model)) {
      return getUniqueAcuriteID(this.data as AcuriteDevice);
    }
    return `${this.data.model}:${this.data.id}`;
  }

  /**
   * The temperature for this data entry, null if no temperature is associated with it.
   * @returns - The temperature for this data entry, null if no temperature is associated with it.
   */
  public get_temperature(): number | null {
    if (AcuriteTypes.includes(this.data.model)) {
      return getAcuriteTemperature(this.data as AcuriteDevice);
    }
    return null;
  }


  /**
   * The humidity for this data entry, null if no humidity is associated with it.
   * @returns - The humidity for this data entry, null if no humidity is associated with it.
   */
  public get_humidity(): number | null {
    if (AcuriteTypes.includes(this.data.model)) {
      return getAcuriteHumidity(this.data as AcuriteDevice);
    }
    return null;
  }
}

/**
 * Scans the provided dataArray for data that is older than the maximum cache age, and removes it.
 * @param data_id - Unique identifier for the data that is currently being processed. Used for log messages.
 * @param dataArray - Data array to process.
 */
function remove_stale_data(data_id: string, dataArray: DataEntry[]): void {
  if (dataArray.length === 0) {
    return;
  }

  const timestampCutoff = new Date(Date.now() - (configuration.maxCacheAge));

  const startCount = dataArray.length;
  let ageOutCount = 0;
  let finished = false;
  while (!finished && dataArray.length > 0) {
    if (dataArray[0].timestamp < timestampCutoff) {
      ageOutCount++;
      dataArray.shift();
    } else {
      finished = true;
    }
  }

  if (ageOutCount > 0) {
    log(`${data_id} aged out ${ageOutCount}/${startCount} entries!`);
  }

}

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
function is_data_valid_generic(prev_data_array: DataEntry[], new_entry: DataEntry,
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

/**
 * Does the newly received data have a valid temperature?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
function is_temperature_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined): number | null => (n?.get_temperature() ?? null);
  return is_data_valid_generic(prev_data_array, new_entry,
    'Temperature', get_value, configuration.validTemperatureRange);
}

/**
 * Does the newly received data have a valid humidity?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
function is_humidity_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined): number | null => (n?.get_humidity() ?? null);
  return is_data_valid_generic(prev_data_array, new_entry,
    'Humidity', get_value, configuration.validHumidityRange);
}

/**
 * Does the newly received data have valid values?
 * @param prev_data_array - Previously received set of data values
 * @param new_entry - Newly received data entry
 * @returns - True if the data is valid, false otherwise.
 */
function is_data_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  return is_temperature_valid(prev_data_array, new_entry) ||
    is_humidity_valid(prev_data_array, new_entry);
}

/**
 * Cache of received data
 */
class DataCache {
  private readonly cache = new Map<string, DataEntry[]>();

  /**
   * Retrieve a data array that could hold  the current data entry.
   * @param dataEntry - Newly received data entry
   * @returns - Cached data entry array for the provided data.
   */
  public get(dataEntry: DataEntry): DataEntry[] {

    let dataArray = this.cache.get(dataEntry.get_unique_id()) ?? null;
    if (dataArray === null) {
      dataArray = [];
      this.cache.set(dataEntry.get_unique_id(), dataArray);
    }
    return dataArray;
  }

  /**
   * Adds a newly received data entry.
   * @param topic - MQTT topic for the data entry
   * @param dataEntry - Newly received data entry to add to cache.
   */
  public add(topic: string, dataEntry: DataEntry): void {
    // Get the cached data
    const dataArray = this.get(dataEntry);

    // Remove any data older than the cache age limit
    remove_stale_data(dataEntry.get_unique_id(), dataArray);

    // Verify that the current data is valid
    if (is_data_valid(dataArray, dataEntry)) {

      // Save the new data
      dataArray.push(dataEntry);
      log(`Cache Size: ${dataArray.length}`);
    }
  }
}

const dataCache = new DataCache();
export default dataCache;
