/**
 * MQTT message object
 */
export interface IMQTTMessage {
  /**
   * Topic string
   */
  topic: string;
  /**
   * Message string.
   */
  message: string;
  /**
   * Optional, message that has been parsed into an object.
   */
  data?: object;
}
