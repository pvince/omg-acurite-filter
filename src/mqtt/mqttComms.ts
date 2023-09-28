import * as mqtt from 'mqtt';
import debug from 'debug';
import { IClientOptions, IClientPublishOptions, MqttClient } from 'mqtt';

/**
 * Callback function invoked when a message is received.
 */
export type fnMessageCallback = (message: Buffer) => void;

const log = debug('omg-acurite-filter:mqttComms');

let client: MqttClient | null = null;

const subscriptionCache = new Map<string, fnMessageCallback>();

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
      const callback = subscriptionCache.get(topic);
      if (callback !== undefined) {
        try {
          callback(message);
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
  subscriptionCache.set(topic, callback);

  await getClient().subscribeAsync(topic);
}


/**
 * Removes a subscription from MQTT topics.
 *
 * @param topic - Topic to unsubscribe from.
 */
export async function unsubscribe(topic: string): Promise<void> {
  await getClient().unsubscribeAsync(topic);
  subscriptionCache.delete(topic);
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
