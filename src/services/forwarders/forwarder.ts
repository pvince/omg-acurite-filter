import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { MS_IN_MINUTE } from '../../constants';

const THROTTLE_RATE_MINUTES = 1;
export const THROTTLE_RATE = THROTTLE_RATE_MINUTES * MS_IN_MINUTE;

/**
 * Generic message forwarder
 */
export class Forwarder {
  /**
   * Can this forwarder handle his specific message?
   * @param mqttMsg - MQTT Message
   * @returns - True if this message can be handled by this forwarder
   */
  public canHandle(mqttMsg: IMQTTMessage): boolean {
    return true;
  }

  /**
   * At what rate will a message matching this forwarder be throttled? This value is the minimum amount of time
   * between forwarding messages that match this forwarder.
   * @returns - Returns throttle rate in milliseconds.
   */
  public get throttleRateInMs(): number {
    return THROTTLE_RATE;
  }

  /**
   * Should there be any special handling for this message when a new message arrives, but there is already
   * a message waiting to be sent?
   * @param prevMsg - Previous, forwarded MQTT message
   * @param newMsg - New MQTT message that will typically replace the previous message
   * @returns - Returns an MQTT message that will be stored for forwarding
   */
  public replaceValue(prevMsg: IMQTTMessage, newMsg: IMQTTMessage): IMQTTMessage {
    return newMsg;
  }
}
