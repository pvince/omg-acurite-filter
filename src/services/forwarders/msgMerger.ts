import { IMQTTMessage } from '../../mqtt/IMQTTMessage';

/**
 * Allows customizing forwarded messages
 */
export abstract class AbstractMsgMerger {
  /**
   * Can this forwarder handle his specific message?
   * @param msg - MQTT Message
   * @returns - True if this message can be handled by this forwarder
   */
  public abstract canReplaceValue(msg: IMQTTMessage): boolean;

  /**
   * Should there be any special handling for this message when a new message arrives, but there is already
   * a message waiting to be sent?
   * @param prevMsg - Previous, forwarded MQTT message
   * @param newMsg - New MQTT message that will typically replace the previous message
   * @returns - Returns an MQTT message that will be stored for forwarding
   */
  public abstract replaceValue(prevMsg: IMQTTMessage, newMsg: IMQTTMessage): IMQTTMessage;
}
