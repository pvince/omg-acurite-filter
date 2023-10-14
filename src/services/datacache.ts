import { IOMGDeviceBase, KnownType } from '../mqtt/omg_devices/device';
import configuration from './configuration';
import { AcuriteDevice, getUniqueID } from '../mqtt/omg_devices/acurite';

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
    if (this.data.model === KnownType.Acurite5n1) {
      return getUniqueID(this.data as AcuriteDevice);
    }
    return `${this.data.model}:${this.data.id}`;
  }
}

function remove_stale_data(dataArray: DataEntry[]) {
  if (dataArray.length === 0)
    return;

  const timestampCutoff = new Date(Date.now() - (configuration.maxCacheAge));

  let finished = false;
  while (!finished && dataArray.length > 0) {
    if (dataArray[0].timestamp < timestampCutoff) {
      console.log(`${dataArray[0].data.model}:${dataArray[0].data.id} aging out of cache!}`);

      dataArray.pop();
    } else {
      finished = true;
    }
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

    remove_stale_data(dataArray);

    dataArray.push(dataEntry);
    console.log(`Cache Size: ${dataArray.length}`);
  }
}

const dataCache = new DataCache();
export default dataCache;
