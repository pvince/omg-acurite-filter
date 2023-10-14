import { IOMGDeviceBase } from '../mqtt/omg_devices/device';
import configuration from './configuration';
import { AcuriteDevice, AcuriteTypes, getAcuriteHumidity, getAcuriteTemperature, getUniqueAcuriteID } from '../mqtt/omg_devices/acurite';

const log =  configuration.log.extend("dataCache");

export class DataEntry {
  public readonly topic: string;
  public readonly data: IOMGDeviceBase;
  public readonly timestamp: Date;

  constructor(topic: string, data: IOMGDeviceBase) {
    this.topic = topic;
    this.data = data;
    this.timestamp = new Date();
  }

  public get_unique_id(): string {
    if (AcuriteTypes.includes(this.data.model)) {
      return getUniqueAcuriteID(this.data as AcuriteDevice);
    }
    return `${this.data.model}:${this.data.id}`;
  }

  public get_temperature(): number | null {
    if (AcuriteTypes.includes(this.data.model)) {
      return getAcuriteTemperature(this.data as AcuriteDevice);
    }
    return null;
  }

  public get_humidity(): number | null {
    if (AcuriteTypes.includes(this.data.model)) {
      return getAcuriteHumidity(this.data as AcuriteDevice);
    }
    return null;
  }
}

function remove_stale_data(data_id: string, dataArray: DataEntry[]) {
  if (dataArray.length === 0)
    return;

  const timestampCutoff = new Date(Date.now() - (configuration.maxCacheAge));

  let startCount = dataArray.length;
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

function is_data_valid_generic(prev_data_array: DataEntry[], new_entry: DataEntry,
                       data_type_name: string,
                       get_value: (n: DataEntry | undefined)=>number | null,
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

function is_temperature_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined) => (n?.get_temperature() ?? null);
  return is_data_valid_generic(prev_data_array, new_entry,
    "Temperature", get_value, configuration.validTemperatureRange);
}

function is_humidity_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  const get_value = (n:  DataEntry | undefined) => (n?.get_humidity() ?? null);
  return is_data_valid_generic(prev_data_array, new_entry,
    "Humidity", get_value, configuration.validHumidityRange);
}

function is_data_valid(prev_data_array: DataEntry[], new_entry: DataEntry): boolean {
  return is_temperature_valid(prev_data_array, new_entry) ||
    is_humidity_valid(prev_data_array, new_entry);
}

class DataCache {
  private cache = new Map<string, DataEntry[]>()

  public get(dataEntry: DataEntry): DataEntry[] | null {
    return this.cache.get(dataEntry.get_unique_id()) ?? null;
  }

  public add(topic: string, dataEntry: DataEntry): void {
    let dataArray = this.get(dataEntry);
    if (dataArray === null) {
      dataArray = []
      this.cache.set(dataEntry.get_unique_id(), dataArray);
    }

    remove_stale_data(dataEntry.get_unique_id(), dataArray);

    if (is_data_valid(dataArray, dataEntry)) {
      dataArray.push(dataEntry);
      log(`Cache Size: ${dataArray.length}`);
    }
  }
}

const dataCache = new DataCache();
export default dataCache;
