import configuration from './configuration';
import { DataEntry } from './dataEntries/dataEntry';

import { is_data_valid } from './validators';

const log =  configuration.log.extend('dataCache');



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
    return this.getByID(dataEntry.get_unique_id());
  }

  /**
   * Retrieves a data entry array for the specified device_id.
   * @param device_id - Unique device ID
   * @returns - Cached data entry array for the provided unique device ID
   */
  public getByID(device_id: string): DataEntry[] {
    let dataArray = this.cache.get(device_id) ?? null;
    if (dataArray === null) {
      dataArray = [];
      this.cache.set(device_id, dataArray);
    }
    return dataArray;
  }

  /**
   * Adds a newly received data entry.
   * @param topic - MQTT topic for the data entry
   * @param dataEntry - Newly received data entry to add to cache.
   * @returns - True if the data was added to cache.
   */
  public add(topic: string, dataEntry: DataEntry): boolean {
    let result = false;
    // Get the cached data
    const dataArray = this.get(dataEntry);

    // Remove any data older than the cache age limit
    remove_stale_data(dataEntry.get_unique_id(), dataArray);

    // Verify that the current data is valid
    if (is_data_valid(dataArray, dataEntry)) {

      // Save the new data
      dataArray.push(dataEntry);
      result = true;
      //log(`Cache Size: ${dataArray.length}`);
    }

    return result;
  }
}

const dataCache = new DataCache();
export default dataCache;
