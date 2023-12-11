import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { AcuriteDevice, AcuriteTypes } from '../../mqtt/omg_devices/acurite.types';
import { getAcuriteHumidity, getAcuriteTemperature, getUniqueAcuriteID } from '../../mqtt/omg_devices/acurite.util';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';
import configuration from '../configuration';

/**
 * Individual data entry.
 */
export class DataEntry implements IMQTTMessage {
  /**
   * The raw MQTT topic from which this message was received
   */
  public readonly topic: string;

  /**
   * The raw string based MQTT message.
   * @returns - The raw, string based MQTT message
   */
  public get message(): string {
    return JSON.stringify(this.data);
  }

  /**
   * Data object for a received Open MQTT Gateway message.
   */
  public readonly data: OMGDevice;

  /**
   * Timestamp for when this data was received.
   */
  public readonly timestamp: Date;

  /**
   * Constructor
   * @param topic - MQTT Topic
   * @param data - MQTT message data
   */
  public constructor(topic: string, data: OMGDevice) {
    this.topic = topic;
    this.data = data;
    this.timestamp = configuration.newDate();
  }

  /**
   * Gets a unique identifier for this data entry.
   * @returns - Returns a unique identifier for this data entry.
   */
  public get_unique_id(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (AcuriteTypes.includes(this.data.model)) {
      return getAcuriteHumidity(this.data as AcuriteDevice);
    }
    return null;
  }
}

/**
 * Check if the msg represents an OMG device, and build a new DataEntry if it does. If it doesn't look like an OMG
 * device, null is returned.
 *
 * An object is considered to be an OMG device if it has:
 * - An 'id' property
 * - A 'model' property.
 * @param msg - MQTT message
 * @returns - If the data looks like an OMG device, a new DataEntry, null otherwise.
 */
export function buildDataEntry(msg: IMQTTMessage): DataEntry | null {
  let result: DataEntry | null = null;

  if (msg.data && Object.hasOwn(msg.data, 'id') && Object.hasOwn(msg.data, 'model')) {
    // Assume it is a known, OMGDevice.
    // We could clamp this down to only KnownTypes with:
    //  Object.values(KnownTypes).includes(messageObj.model)
    const device = msg.data as OMGDevice;
    result =  new DataEntry(msg.topic,  device);
  }

  return result;
}
