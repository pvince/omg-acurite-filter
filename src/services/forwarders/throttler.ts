import { IMQTTMessage } from '../../mqtt/IMQTTMessage';

/**
 * Allows customizing the message throttling
 */
export abstract class AbstractThrottler {

  /**
   * Does this type of message have a custom rate?
   * @param msg - Newly received MQTT rate
   * @returns - Returns true if this message has custom rate handling.
   */
  public abstract hasCustomRate(msg: IMQTTMessage): boolean;

  /**
   * Gets the custom rate for this message
   * @param msg - Newly received MQTT rate
   * @returns - Returns custom throttle rate for this message
   */
  public abstract getCustomRate(msg: IMQTTMessage): number;
}
