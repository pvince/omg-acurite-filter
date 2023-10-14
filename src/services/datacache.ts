import { IOMGDeviceBase } from '../mqtt/omg_devices/device';
import configuration from './configuration';
import { AcuriteDevice, AcuriteTypes, getUniqueID } from '../mqtt/omg_devices/acurite';

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
      return getUniqueID(this.data as AcuriteDevice);
    }
    return `${this.data.model}:${this.data.id}`;
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

    dataArray.push(dataEntry);
    log(`Cache Size: ${dataArray.length}`);
  }
}

const dataCache = new DataCache();
export default dataCache;
