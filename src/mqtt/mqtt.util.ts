import configuration from '../services/configuration';

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
 * Forwards the topic
 * @param src_topic - Topic to forward
 * @returns - Forwarded topic
 */
export function forwardTopic(src_topic: string): string {
  const matches = SRC_TOPIC_REGEX.exec(src_topic);

  let result = '';
  if (matches !== null) {
    for (const match of matches) {
      result = match;
    }
  }

  return result;

}
