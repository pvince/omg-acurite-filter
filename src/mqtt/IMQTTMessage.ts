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
}
