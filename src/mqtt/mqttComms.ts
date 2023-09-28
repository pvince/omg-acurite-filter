import * as mqtt from 'mqtt';
import debug from 'debug';
import { IClientOptions, IClientPublishOptions, MqttClient } from 'mqtt';

/**
 * Callback function invoked when a message is received.
 */
export type fnMessageCallback = (topic: string, message: Buffer) => void;

const log = debug('omg-acurite-filter:mqttComms');

let client: MqttClient | null = null;

function hasWildcards(topic: string): boolean {
  return topic.includes("+") || topic.includes("#");
}

function buildRegex(topic: string): RegExp {
  let tmpStr = topic;
  tmpStr = tmpStr.replaceAll("/", "\\/");
  tmpStr = tmpStr.replaceAll("+", "\\w*");
  tmpStr = tmpStr.replaceAll("#", ".+");
  return new RegExp(tmpStr);
}

class MqttTopicCallbackPair {
  public readonly topic: string;
  public readonly isWildcard: boolean;
  public readonly callback: fnMessageCallback;

  private readonly topic_re: RegExp;

  constructor(topic: string, callback: fnMessageCallback) {
    this.topic = topic;
    this.isWildcard = hasWildcards(topic);
    this.callback = callback;
    this.topic_re = buildRegex(topic);
  }

  isMatch(topic: string): boolean {
    if (!this.isWildcard) {
      return this.topic === topic;
    } else {
      return this.topic_re.test(topic);
    }
  }
}

class SubscriptionCache {
  private readonly cacheMap = new Map<string, MqttTopicCallbackPair>();
  private wildcardTopicCount = 0;

  public add(topic: string, callback: fnMessageCallback) {
    // If the topic has wildcards, life gets more complicated. Multiple callbacks can be triggered, multiple topics
    // will map to the same callback. We only need to run the 'complicated' handling if there are any wildcard topics.
    if (hasWildcards(topic) && !this.has(topic)) {
      this.wildcardTopicCount++;
    }
    this.cacheMap.set(topic, new MqttTopicCallbackPair(topic, callback));
  }

  public has(topic: string): boolean {
    return this.cacheMap.has(topic);
  }

  public get(topic: string): fnMessageCallback[] {
    let result: fnMessageCallback[] = [];

    if (this.hasWildcardTopics()) {
      // We know we have some wildcards, which means we need to scan all the subscriptions for any that might match
      // this topic.
      result = this.gatherCallbacks(topic);
    } else {
      // This is the simple case, we can just check to see if a specific topic is in our cache and return the callback.
      const topicCallbackPair = this.cacheMap.get(topic);
      if (topicCallbackPair !== undefined) {
        result = [topicCallbackPair.callback];
      }
    }

    return result;
  }

  public remove(topic: string) {
    if (hasWildcards(topic) && this.has(topic) ) {
      this.wildcardTopicCount--;
    }
    this.cacheMap.delete(topic);
  }

  private hasWildcardTopics() {
    return this.wildcardTopicCount > 0;
  }

  private gatherCallbacks(topic: string): fnMessageCallback[] {
    const result: fnMessageCallback[] = [];
    for (const topicCallbackPair of this.cacheMap.values())  {
      if (topicCallbackPair.isMatch(topic)) {
        result.push(topicCallbackPair.callback);
      }
    }
    return result;
  }

}

const subscriptionCache = new SubscriptionCache();

/**
 * Retrieves the current MQTT Client.
 *
 * @returns - Current MQTT client
 * @throws {Error} Throws an error if the client is not initialized by {@link startClient}
 */
function getClient(): MqttClient {
  if (!client) {
    throw new Error('MQTT Client is not initialized. Call startClient first.');
  }
  return client;
}

/**
 * Starts the MQTT client, starts listening to error events on mqtt as well.
 *
 * @param host - Host to connect too
 * @param opts - Connection options
 */
export async function startClient(host: string, opts?: IClientOptions): Promise<void> {
  try {
    // Connect to the MQTT broker
    log('Starting mqtt client connecting to %s', host);
    client = await mqtt.connectAsync(host, opts);
    log('mqtt client started!');

    // Listen for global errors
    client.on('error', (err) => {
      log(`Error: ${err.message} ${err.stack}`);
    });

    // If we receive a message, direct it to the configured handler.
    client.on('message', (topic, message) => {
      const callbackArray = subscriptionCache.get(topic);
      if (callbackArray !== undefined) {
        try {
          for (const callback of callbackArray) {
            callback(topic, message);
          }
        } catch (err) {
          log('Subscription to %s triggered an error: %s', topic, err);
        }
      } else {
        log("Unhandled message for topic %s", topic);
      }
    });

  } catch (err) {
    log(`Error: ${err}`);
  }

}

/**
 * Stops the MQTT client.
 */
export async function stopClient(): Promise<void> {
  if (client) {
    await client.endAsync()
  }
}

/**
 * Publishes an MQTT topic
 *
 * @param topic - Topic to publish too
 * @param data - Object to JSON-ify & send
 * @param opts - MQTT options for this publish
 */
export async function publish(topic: string, data: object | string, opts: IClientPublishOptions = {}): Promise<void> {
  await getClient().publishAsync(topic, JSON.stringify(data), opts);
}

/**
 * Allows for code to subscribe to MQTT topics.
 *
 * @param topic - Topic to subscribe too
 * @param callback - Callback function to invoke with any messages received.
 */
export async function subscribe(topic: string, callback: fnMessageCallback): Promise<void> {
  subscriptionCache.add(topic, callback);

  await getClient().subscribeAsync(topic);
}


/**
 * Removes a subscription from MQTT topics.
 *
 * @param topic - Topic to unsubscribe from.
 */
export async function unsubscribe(topic: string): Promise<void> {
  await getClient().unsubscribeAsync(topic);
  subscriptionCache.remove(topic);
}

/**
 * Clear //  delete the specified MQTT topic.
 *
 * @param topic - Topic to clear
 */
export async function clearTopic(topic: string): Promise<void> {
  await client?.publishAsync(topic, '', { retain: true });
}

/**
 * Is the MQTT client connected?
 *
 * @returns True if it is connected, false otherwise.
 */
export function isConnected(): boolean {
  return client?.connected ?? false;
}
