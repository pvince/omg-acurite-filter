
/**
 * MQTT Message in the database
 */
export interface IDataModelMqttMsg {
  /**
   * Timestamp for when the message was received
   */
  timestamp: number;
  /**
   * The MQTT message as text
   */
  msg: string;
  /**
   * Device ID if the MQTT Message was for an OMG device.
   */
  device_id: string | null;
}

