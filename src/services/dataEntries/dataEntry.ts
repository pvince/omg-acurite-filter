import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { AcuriteDevice, AcuriteTypes } from '../../mqtt/omg_devices/acurite.types';
import { getAcuriteHumidity, getAcuriteTemperature, getUniqueAcuriteID } from '../../mqtt/omg_devices/acurite.util';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';

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
