import * as mqtt from 'mqtt';
import debug from 'debug';
import { IClientOptions, IClientPublishOptions, MqttClient } from 'mqtt';
import _ from 'lodash';
import { buildTopicRegex, hasWildcards } from './mqtt.util';
import { mqttSendRate, mqttStats } from '../services/statistics/passiveStatistics';

/**
 * Callback function invoked when a message is received.
 */
export type fnMessageCallback = (topic: string, message: Buffer) => void;

const log = debug('omg-acurite-filter:mqttComms');

let client: MqttClient | null = null;


/**
 * Class that wraps up some of the complexity that can exist when a topic contains wildcard characters.
 */
class SubscriptionCacheEntry {
  /**
   * MQTT Topic we are subscribed too. This may contain wildcard characters, and should match whatever is the key in the
   * cache.
   */
  public readonly topic: string;

  /**
   * Does this topic contain wildcards?
   */
  public readonly isWildcard: boolean;

  /**
   * The callback that will be triggered when a topic is received that matches the topic string.
   */
  public readonly callback: fnMessageCallback;

  /**
   * Internal RegExp object used to verify incoming topics match this topic. Only
   * @private
   */
  private readonly topic_re: RegExp | null;

  /**
   * Constructor
   * @param topic - Topic that is being monitored, may have wildcard characters.
   * @param callback - Callback that should be triggered if we receive a message that matches this topic.
   */
  public constructor(topic: string, callback: fnMessageCallback) {
    this.topic = topic;
    this.isWildcard = hasWildcards(topic);
    this.callback = callback;

    // Only setup the topic_re if the topic has wildcards.
    if (this.isWildcard) {
      this.topic_re = buildTopicRegex(topic);
    } else {
      this.topic_re = null;
    }
  }

  /**
   * Does the received topic match this wildcard?
   * @param topic - Topic received from the MQTT broker. This SHOULD NOT contain wildcards.
   * @returns - True if the incoming topic matches the stored topic.
   */
  public isMatch(topic: string): boolean {
    if (!this.isWildcard || this.topic_re === null) {
      return this.topic === topic;
    } else {
      return this.topic_re.test(topic);
    }
  }
}

/**
 * Cache of MQTT topic subscriptions.
 */
class SubscriptionCache {
  /**
   * Internal cache of topic subscriptions.
   * @private
   */
  private readonly cacheMap = new Map<string, SubscriptionCacheEntry>();

  /**
   * Internal count of how many wildcard topics we are monitoring. This value should never be less than 0.
   * @private
   */
  private wildcardTopicCount = 0;

  /**
   * Add a new subscription to a topic. The topic may contain "+" or "#" wildcard characters.
   * @param topic - Topic to subscribe to. This may be a wildcard topic.
   * @param callback - Callback to trigger if an MQTT message is received with a topic that matches the provided 'topic'
   * pattern.
   */
  public add(topic: string, callback: fnMessageCallback): void {
    // If the topic has wildcards, life gets more complicated. Multiple callbacks can be triggered, multiple topics
    // will map to the same callback. We only need to run the 'complicated' handling if there are any wildcard topics.
    if (hasWildcards(topic) && !this.has(topic)) {
      this.wildcardTopicCount++;
    }
    this.cacheMap.set(topic, new SubscriptionCacheEntry(topic, callback));
  }

  /**
   * Does the provided topic specifically exist in the cache? This is an exact match check. The 'pattern' of the topic
   * is not taken into account.
   * @param topic - Topic to look for. The cached topic must be an exact match.
   * @returns - True if the exact topic is found.
   */
  public has(topic: string): boolean {
    return this.cacheMap.has(topic);
  }

  /**
   * Get a list of callback functions to invoke for the provided topic. The provided topic MAY NOT contain wildcard
   * characters.
   * @param topic - Topic from a received MQTT message that DOES NOT contain wildcard characters.
   * @returns - List of callback functions for this topic
   * @throws Error If the topic contains wildcard characters
   */
  public get(topic: string): fnMessageCallback[] {
    let result: fnMessageCallback[] = [];

    if (hasWildcards(topic)) {
      throw new Error('topic may not contain wildcard characters.');
    }

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

  /**
   * Removes the topic from our cache.
   * @param topic - Remove this topic from our cache.
   */
  public remove(topic: string): void {
    if (hasWildcards(topic) && this.has(topic) ) {
      this.wildcardTopicCount--;
    }
    this.cacheMap.delete(topic);
  }

  /**
   * Are we currently caching any wildcard topics?
   * @returns - True if we are caching wildcard topics.
   * @private
   */
  private hasWildcardTopics(): boolean {
    return this.wildcardTopicCount > 0;
  }

  /**
   * Searches our cache for any cached entries that match the provided topic. The provided topic must not contain any
   * wildcard characters and should be from a received MQTT message.
   * @param topic - Topic received from the MQTT broker. Should not contain any wildcard characters.
   * @returns - An array of callback functions to invoke for that topic.
   * @private
   */
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

/**
 * Subscription cache to keep track of topics & callback functions.
 */
const subscriptionCache = new SubscriptionCache();

/**
 * Retrieves the current MQTT Client.
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
        log('Unhandled message for topic %s', topic);
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
    await client.endAsync();
  }
}

/**
 * Publishes an MQTT topic
 * @param topic - Topic to publish too
 * @param data - Object to JSON-ify & send
 * @param opts - MQTT options for this publish
 */
export async function publish(topic: string, data: object | string, opts: IClientPublishOptions = {}): Promise<void> {
  let message = data;
  if (!_.isString(message)) {
    message = JSON.stringify(data);
  }
  mqttStats.sent.total++;
  mqttSendRate.mark();
  await getClient().publishAsync(topic, message, opts);
}

/**
 * Allows for code to subscribe to MQTT topics.
 * @param topic - Topic to subscribe too
 * @param callback - Callback function to invoke with any messages received.
 */
export async function subscribe(topic: string, callback: fnMessageCallback): Promise<void> {
  subscriptionCache.add(topic, callback);

  await getClient().subscribeAsync(topic);
}


/**
 * Removes a subscription from MQTT topics.
 * @param topic - Topic to unsubscribe from.
 */
export async function unsubscribe(topic: string): Promise<void> {
  await getClient().unsubscribeAsync(topic);
  subscriptionCache.remove(topic);
}

/**
 * Clear //  delete the specified MQTT topic.
 * @param topic - Topic to clear
 */
export async function clearTopic(topic: string): Promise<void> {
  await client?.publishAsync(topic, '', { retain: true });
}

/**
 * Is the MQTT client connected?
 * @returns True if it is connected, false otherwise.
 */
export function isConnected(): boolean {
  return client?.connected ?? false;
}
