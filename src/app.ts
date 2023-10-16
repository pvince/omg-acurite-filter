
import * as mqttComms from './mqtt/mqttComms';
import configuration from './services/configuration';
import dataCache, { DataEntry } from './services/dataCache';
import { IOMGDeviceBase } from './mqtt/omg_devices/device';

const log = configuration.log.extend('app');

/**
 * Starts the MQTT client
 * @returns - A promise that resolves when finished.
 */
async function startMQTT(): Promise<void> {
  await mqttComms.startClient(configuration.mqttHost, {
    username: configuration.mqttUser,
    password: configuration.mqttPass
  });
}

/**
 * Process the provided MQTT message.
 * @param topic - Topic for the message
 * @param message - Received MQTT message
 */
function processTopic(topic: string, message: Buffer): void {
  const jsonConfig = message.toString();
  try {
    const messageObj = JSON.parse(jsonConfig);

    if (Object.hasOwn(messageObj, 'id')) {
      const device = messageObj as  IOMGDeviceBase;
      const dataEntry = new DataEntry(topic, device);
      log(`[${topic}] => IOMGDevice: ${device.model}\t${device.id}`);

      dataCache.add(topic, dataEntry);
    } else {
      log(`Unknown Message Type! [${topic}] => ${jsonConfig}`);
    }
  } catch (e) {
    log(`Failed to parse [${topic}] => ${jsonConfig}`);
  }

}

/**
 * Subscribe to the configured MQTT topic
 */
async function subscribe(): Promise<void> {
  if (mqttComms.isConnected()) {
    const topic = configuration.mqttSrcTopic + '/#';
    log('Subscribing to ' + topic);
    await mqttComms.subscribe(topic, processTopic);
  }
}

/**
 * Main startup function
 */
async function startup(): Promise<void> {
  log('Starting MQTT client');
  await startMQTT();

  log('Subscribing...');
  await subscribe();
}

startup()
  .catch((err) => {
    console.error(`Error: ${err}`);
  });

