import { AbstractMsgMerger } from './msgMerger';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import configuration from '../configuration';
import { isOMGDevice } from '../../mqtt/mqtt.util';

const log = configuration.log.extend('forwarder:rssi');
const logVerbose = log.extend('verbose');
/**
 * Ensure we are sending a consistent RSSI value.
 */
export class MsgMergerRSSI extends AbstractMsgMerger {
  /**
   * Can this forwarder handle his specific message?
   * @param mqttMsg - MQTT Message
   * @returns - True if this message can be handled by this forwarder
   */
  public override canReplaceValue(mqttMsg: IMQTTMessage): boolean {
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
    if (isOMGDevice(prevMsg.data) && isOMGDevice(newMsg.data)) {
      const newRSSI = Math.max(prevMsg.data.rssi, newMsg.data.rssi);

      if (newRSSI !== newMsg.data.rssi) {
        logVerbose(`${newMsg.topic} normalized RSSI from ${newMsg.data.rssi} to ${newRSSI}`);
      }
      newMsg.data.rssi = newRSSI;
      result = newMsg;
    }

    return result;
  }
}
