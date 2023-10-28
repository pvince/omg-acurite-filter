import { Forwarder } from './forwarder';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import configuration from '../configuration';

const log = configuration.log.extend('forwarder:rssi');

/**
 * Basic interface of an object that has RSSI.
 */
interface IHasRSSI {
  /**
   * Signal strength number.
   */
  rssi: number;
}

/**
 * Ensure we are sending a consistent RSSI value.
 */
export class ForwardMergeRSSI extends Forwarder {
  /**
   * Can this forwarder handle his specific message?
   * @param mqttMsg - MQTT Message
   * @returns - True if this message can be handled by this forwarder
   */
  public override canHandle(mqttMsg: IMQTTMessage): boolean {
    let result = false;
    if (mqttMsg.data && Object.hasOwn(mqttMsg.data, 'rssi')) {
      result = true;
    }
    return result;
  }

  /**
   * Should there be any special handling for this message when a new message arrives, but there is already
   * a message waiting to be sent?
   * @param prevMsg - Previous, forwarded MQTT message
   * @param newMsg - New MQTT message that will typically replace the previous message
   * @returns - Returns an MQTT message that will be stored for forwarding
   */
  public override replaceValue(prevMsg: IMQTTMessage, newMsg: IMQTTMessage): IMQTTMessage {
    let result = newMsg;
    if (prevMsg.data && Object.hasOwn(prevMsg.data, 'rssi') &&
        newMsg.data && Object.hasOwn(newMsg.data, 'rssi')) {
      const prevWithRSSI = prevMsg.data as IHasRSSI;
      const newWithRSSI = newMsg.data as IHasRSSI;
      const newRSSI = Math.max(prevWithRSSI.rssi, newWithRSSI.rssi);

      if (newRSSI !== newWithRSSI.rssi) {
        log(`${newMsg.topic} normalized RSSI from ${newWithRSSI.rssi} to ${newRSSI}`);
      }
      // @ts-ignore
      newMsg.data.rssi = newRSSI;
      result = newMsg;
    }

    return result;
  }
}
