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
export class DataCache {
  private readonly cache = new Map<string, DataEntry[]>();

  /**
   * Check if the specified data entry has a corresponding entry in the cache, and return its full array of cached data
   * if it exists.
   * @param dataEntry - Data entry value.
   * @returns - Cached data entry array for the provided data, or null if none is found.
   */
  public get(dataEntry: DataEntry): DataEntry[] | null {
    return this.getByID_internal(dataEntry.get_unique_id(), false);
  }

  /**
   * Check if the specified device ID corresponds to an existing array of data entries. If it does, return the full array
   * of cached data entries.
   * @param device_id - Device ID to check for
   * @returns - Cached data entry array for the provided device id, or null if none is found.
   */
  public getByID(device_id: string): DataEntry[] | null {
    return this.getByID_internal(device_id, false);
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
    const dataArray = this.get_create(dataEntry);

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

  /**
   * Cleans up stale values from the data cache. Removes stale values for the specified device_id. If the resulting
   * device no longer has any cached values, it is removed as well.
   * @returns - Count of devices deleted from cache.
   */
  public cleanup(): number {
    let deleted = 0;

    for (const [device_id, data_array] of this.cache.entries()) {
      remove_stale_data(device_id, data_array);

      if (data_array.length === 0) {
        this.cache.delete(device_id);
        deleted++;
        log('Removing %s from cache since it no longer has any entries.', device_id);
      }
    }

    return deleted;
  }

  /**
   * Retrieve an iterator for the data cache.
   * @returns - Iterator for the data held in cache.
   */
  public getEntries(): IterableIterator<[string, DataEntry[]]> {
    return this.cache.entries();
  }

  /**
   * Returns the count of items in cache.
   * @returns - Count of items in cache.
   */
  public get count(): number {
    return this.cache.size;
  }

  /**
   * Checks if the provided data entry exists & creates a new data cache entry if it doesn't exist.
   * @param dataEntry - Newly received data entry
   * @returns - Cached data entry array for the provided data.
   * @protected
   */
  protected get_create(dataEntry: DataEntry): DataEntry[] {
    return this.getByID_create(dataEntry.get_unique_id());
  }

  /**
   * Checks if the provided device ID corresponds to existing cached data & creates a new cache entry if it doesn't exist.
   * @param device_id - Newly received device ID
   * @returns - Cached data entry array for the provided ID
   * @protected
   */
  protected getByID_create(device_id: string): DataEntry[] {
    return this.getByID_internal(device_id, true);
  }


  protected getByID_internal(device_id: string, create_missing: true): DataEntry[];
  protected getByID_internal(device_id: string, create_missing: false): DataEntry[] | null;
  /**
   * Retrieves a data entry array for the specified device_id.
   * @param device_id - Unique device ID
   * @param create_missing - If an entry is not found, should an empty entry be created & cached?
   * @returns - Cached data entry array for the provided unique device ID.
   */
  protected getByID_internal(device_id: string, create_missing: boolean = false): DataEntry[] | null {
    let dataArray = this.cache.get(device_id) ?? null;
    if (dataArray === null && create_missing) {
      dataArray = [];
      this.cache.set(device_id, dataArray);
    }
    return dataArray;
  }
}

const dataCache = new DataCache();
export default dataCache;
