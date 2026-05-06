import configuration from '../services/configuration';
import { OMGDevice } from './omg_devices/device.types';

const ESCAPE_LIST = ['\\', '/', '.', '*', '[', ']', '(', ')'];

/**
 * Constructs a Regex based on an MQTT topic with wildcard characters.
 * Limitations:
 * - topic may have the following MQTT wildcards: +, #
 * - topic may have the following 'regex' chars: / . * \ [ ] ( )
 * - topic should avoid any other 'regex' special chars
 * @param topic - Topic to regexify
 * @returns - Regex that will find matching topics
 */
export function buildTopicRegex(topic: string): RegExp {
  const pattern = topic.split('/').map((segment, index) => {
    const prefix = index === 0 ? '' : '\\/';

    if (segment === '+') {
      return `${prefix}([^/]*)`;
    }
    if (segment === '#') {
      return index === 0 ? '(.*)' : '(?:\\/(.*))?';
    }

    let escapedSegment = segment;
    for (const char of ESCAPE_LIST) {
      escapedSegment = escapedSegment.replaceAll(char, `\\${char}`);
    }
    return `${prefix}${escapedSegment}`;
  }).join('');

  return new RegExp(`^${pattern}$`);
}


let _cached_src_topic = configuration.mqttSrcTopic;
let _SRC_TOPIC_REGEX = buildTopicRegex(configuration.mqttSrcTopic);

/**
 * Returns the regex for the MQTT source topic.
 * @returns - Returns the regex for the MQTT source topic.
 */
export function getSrcTopicRegex(): RegExp {
  if (_cached_src_topic !== configuration.mqttSrcTopic) {
    _SRC_TOPIC_REGEX = buildTopicRegex(configuration.mqttSrcTopic);
    _cached_src_topic = configuration.mqttSrcTopic;
  }
  return _SRC_TOPIC_REGEX;
}

/**
 * Check if the specified topic includes wildcard characters.
 * @param topic - Topic to check
 * @returns - True if the topic contains wildcards, false otherwise.
 */
export function hasWildcards(topic: string): boolean {
  return topic.includes('+') || topic.includes('#');
}

/**
 * Forwards the topic
 * @param src_topic - Topic to forward
 * @returns - Forwarded topic
 */
export function forwardTopic(src_topic: string): string {
  if (getSrcTopicRegex().exec(src_topic) === null) {
    return '';
  }

  const srcSegments = configuration.mqttSrcTopic.split('/');
  const topicSegments = src_topic.split('/');
  const wildcardValues: string[] = [];
  let topicIndex = 0;
  for (const srcSegment of srcSegments) {
    if (srcSegment === '+') {
      wildcardValues.push(topicSegments[topicIndex] ?? '');
      topicIndex++;
      continue;
    }
    if (srcSegment === '#') {
      wildcardValues.push(topicSegments.slice(topicIndex).join('/'));
      break;
    }

    topicIndex++;
  }

  const resultSegments: string[] = [];
  let wildcardIndex = 0;
  for (const destSegment of configuration.mqttDestTopic.split('/')) {
    if (destSegment === '+') {
      resultSegments.push(wildcardValues[wildcardIndex] ?? '');
      wildcardIndex++;
      continue;
    }
    if (destSegment === '#') {
      const suffix = wildcardValues[wildcardIndex] ?? '';
      wildcardIndex++;
      if (suffix.length > 0) {
        resultSegments.push(...suffix.split('/'));
      }
      continue;
    }

    resultSegments.push(destSegment);
  }

  return resultSegments.join('/');
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
