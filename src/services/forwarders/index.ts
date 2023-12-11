import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { MsgMergerRSSI } from './msgMergerRSSI';
import { ThrottlerMaverick } from './throttlerMaverick';
import configuration from '../configuration';

/**
 * All the custom message forwarding mergers. All forwarders will be called in order here with the result
 * of each merger being passed forward as the 'new message' to the next one.
 */
const mergerInstances = [
  new MsgMergerRSSI()
];

/**
 * All the custom message throttlers. First one that can handle the supplied message will be used.
 */
const throttlerInstances = [
  new ThrottlerMaverick()
];

/**
 * At what rate will a message matching this forwarder be throttled? This value is the minimum amount of time
 * between forwarding messages that match this forwarder.
 * @param mqttMsg - MQTT Message to check throttle rate for.
 * @returns - Returns throttle rate in milliseconds.
 */
export function get_throttle_rate(mqttMsg: IMQTTMessage):  number {
  let result = configuration.throttleRate;
  for (const throttler of throttlerInstances) {
    if (throttler.hasCustomRate(mqttMsg)) {
      result = throttler.getCustomRate(mqttMsg);
      break;
    }
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
export function get_replacement_value(prevMsg: IMQTTMessage, newMsg: IMQTTMessage): IMQTTMessage {
  let result = newMsg;

  // Run all the forwarders
  for (const forwarder of mergerInstances) {
    if (forwarder.canReplaceValue(newMsg)) {
      result = forwarder.replaceValue(prevMsg, result);
    }
  }

  return result;
}
