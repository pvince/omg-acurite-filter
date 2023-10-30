import configuration from '../services/configuration';
import { OMGDevice } from './omg_devices/device.types';

const ESCAPE_LIST = ['\\', '/', '.', '*', '[', ']', '(', ')'];

/**
 * Constructs a Regex based on an MQTT topic with wildcard characters.
 * Limitations:
 * - topic may have the following MQTT wildcards: +, -
 * - topic may have the following 'regex' chars: / . * \ [ ] ( )
 * - topic should avoid any other 'regex' special chars
 * @param topic - Topic to regexify
 * @returns - Regex that will find matching topics
 */
export function buildTopicRegex(topic: string): RegExp {
  let tmpStr = topic;
  for (const char of ESCAPE_LIST) {
    tmpStr = tmpStr.replaceAll(char, `\\${char}`);
  }

  // Topic wildcards.
  tmpStr = tmpStr.replaceAll('+', '(\\w*)');
  tmpStr = tmpStr.replaceAll('#', '(.+)');
  return new RegExp(tmpStr);
}


export const SRC_TOPIC_REGEX = buildTopicRegex(configuration.mqttSrcTopic);

/**
 * Check if the specified topic includes wildcard characters.
 * @param topic - Topic to check
 * @returns - True if the topic contains wildcards, false otherwise.
 */
export function hasWildcards(topic: string): boolean {
  return topic.includes('+') || topic.includes('#');
}

/**
 * Find the next MQTT wildcard character in the input string.
 * @param input - Input string, probably an MQTT topic
 * @param start_index - Index to start the search at.
 * @returns - Returns the index of the next wildcard character, or -1 if no wildcard is f ound.
 */
function _nextWildcard(input: string, start_index: number = 0): number {
  const plus = input.indexOf('+', start_index);
  const hash = input.indexOf('#', start_index);
  if (plus !== -1 && hash !== -1) {
    return Math.min(plus, hash);
  } else if (plus !== -1) {
    return plus;
  }
  return hash;
}

/**
 * Forwards the topic
 * @param src_topic - Topic to forward
 * @returns - Forwarded topic
 */
export function forwardTopic(src_topic: string): string {
  const matches = SRC_TOPIC_REGEX.exec(src_topic);

  // Dest topic must have same number of wildcards as the src_topic
  let result = '';
  const dest_topic = configuration.mqttDestTopic;
  if (matches !== null) {
    let match_index = 1;
    let prev_plus = 0;
    let next_plus =  _nextWildcard(dest_topic);
    while (matches[match_index] !== undefined && matches[match_index] !== '0' && next_plus >= 0) {
      result += dest_topic.substring(prev_plus, next_plus);
      result += matches[match_index];

      prev_plus = next_plus + 1;
      next_plus = _nextWildcard(dest_topic, prev_plus);
      match_index++;
    }
  }

  return result;

}

/**
 * Checks if the provided object is an OMGDevice
 * @param obj - Object to check
 * @returns - True if it is an OMGDevice
 */
export function isOMGDevice(obj: object | undefined): obj is OMGDevice {
  return obj !== undefined && typeof obj === 'object' &&
    'model' in obj &&
    'id' in  obj &&
    'rssi' in obj;
}
