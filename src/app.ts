
import * as mqttComms from './mqtt/mqttComms';
import configuration from './services/configuration';
import dataCache from './services/dataCache';
import { messageForwardingService } from './services/messageForwardingService';
import { DataEntry } from './services/dataEntries/dataEntry';
import { OMGDevice } from './mqtt/omg_devices/device.types';
import { dumpMessage } from './mqtt/dumper';
import { startWebService } from './services/webService';
import { mqttRecRate, mqttStats } from './services/statistics/passiveStatistics';
import dataStore from './services/database/dataStore';
import { IMQTTMessage } from './mqtt/IMQTTMessage';

const log = configuration.log.extend('app');
const logVerbose = log.extend('verbose');

/**
 * Log received messages.
 * @param msg - Message to log
 */
function logMsg(msg: IMQTTMessage): void {
  if (configuration.DUMP_MQTT_MSGS) {
    dumpMessage(msg);
  }
  dataStore.add(msg)
    .catch((err) => {
      log(`dataStore: Failed to save ${msg.topic}: ${err}`);
    });
}

/**
 * Initialize the data storage
 */
async function initializeDataStore(): Promise<void> {
  await dataStore.initialize();
}

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
  mqttStats.received.total++;
  mqttRecRate.mark();
  try {
    const messageObj = JSON.parse(jsonConfig);

    if (Object.hasOwn(messageObj as object, 'id')) {
      mqttStats.received.omg++;

      logMsg({ topic, message: jsonConfig });

      // Assume it is a known, OMGDevice.
      // We could clamp this down to only KnownTypes with:
      //  Object.values(KnownTypes).includes(messageObj.model)
      const device = messageObj as OMGDevice;
      const dataEntry = new DataEntry(topic, device);
      logVerbose(`[${topic}] => IOMGDevice: ${device.model}\t${device.id}`);

      if (dataCache.add(topic, dataEntry)) {
        messageForwardingService.throttleMessage(dataEntry.get_unique_id(), dataEntry);
      } else {
        mqttStats.received.omg_invalid++;
      }
    } else {
      log(`Unknown Message Type! [${topic}] => ${jsonConfig}`);
      messageForwardingService.throttleMessage(topic, { topic, message: jsonConfig, data: messageObj });
      mqttStats.received.unknown++;
    }
  } catch (e) {
    log(`Failed to parse [${topic}] => ${jsonConfig}]`);
    mqttStats.received.unparseable++;
    messageForwardingService.forwardMessage({ topic, message: jsonConfig })
      .catch((err) => {
        log(`Failed to send unparsed message  [${topic}] => ${jsonConfig}] - ${err}`);
      });
  }

}

/**
 * Subscribe to the configured MQTT topic
 */
async function subscribe(): Promise<void> {
  if (mqttComms.isConnected()) {
    log('Subscribing to ' + configuration.mqttSrcTopic);
    await mqttComms.subscribe(configuration.mqttSrcTopic, processTopic);
  }
}

/**
 * Main startup function
 */
async function startup(): Promise<void> {
  if ( configuration.DUMP_MQTT_MSGS ) {
    log(`Dumping all received MQTT messages to ${configuration.MQTT_MSG_LOG_FILE}...`);
  }

  log('Loading the data store...');
  await initializeDataStore();

  log('Starting MQTT client...');
  await startMQTT();

  log('Subscribing...');
  await subscribe();

  await startWebService();
}

startup()
  .catch((err) => {
    console.error(`Error: ${err}`);
  });

