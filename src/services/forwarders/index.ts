import { Forwarder, THROTTLE_RATE } from './forwarder';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';

const forwarderInstances = [
  new Forwarder() // This should be the last forwarder, because it is the most generic.
];

/**
 * At what rate will a message matching this forwarder be throttled? This value is the minimum amount of time
 * between forwarding messages that match this forwarder.
 * @returns - Returns throttle rate in milliseconds.
 */
export function get_throttle_rate(mqttMsg: IMQTTMessage):  number {
  let result = THROTTLE_RATE;
  for (const forwarder of forwarderInstances) {
    if (forwarder.canHandle(mqttMsg)) {
      result = forwarder.throttleRateInMs;
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

  for (const forwarder of forwarderInstances) {
    if (forwarder.canHandle(newMsg)) {
      result = forwarder.replaceValue(prevMsg, newMsg);
      break;
    }
  }

  return result;
}
