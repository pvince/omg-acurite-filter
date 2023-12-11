
import * as mqttComms from './mqtt/mqttComms';
import configuration from './services/configuration';
import dataCache from './services/dataCache';
import { messageForwardingService } from './services/messageForwardingService';
import { buildDataEntry } from './services/dataEntries/dataEntry';
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
 * @param blockSending - Used when replaying messages to block sending messages.
 */
export function processTopic(topic: string, message: Buffer): void {
  const jsonConfig = message.toString();
  mqttStats.received.total++;
  mqttRecRate.mark();
  const msg: IMQTTMessage | null = { topic,  message: jsonConfig };
  try {
    msg.data = JSON.parse(jsonConfig);

    const dataEntry = buildDataEntry(msg);
    if (dataEntry !== null) {
      mqttStats.received.omg++;

      if (configuration.DUMP_MQTT_MSGS) {
        dumpMessage(msg);
      }

      logVerbose(`[${topic}] => IOMGDevice: ${dataEntry.get_unique_id()}`);

      if (dataCache.add(topic, dataEntry)) {
        messageForwardingService.throttleMessage(dataEntry.get_unique_id(), dataEntry);
      } else {
        mqttStats.received.omg_invalid++;
      }
    } else {
      log(`Unknown Message Type! [${topic}] => ${jsonConfig}`);
      messageForwardingService.throttleMessage(topic, msg);
      mqttStats.received.unknown++;
    }
  } catch (e) {
    log(`Failed to parse [${topic}] => ${jsonConfig}]`);
    mqttStats.received.unparseable++;
    messageForwardingService.forwardMessage({ topic, message: jsonConfig })
      .catch((err) => {
        log(`Failed to send unparsed message  [${topic}] => ${jsonConfig}] - ${err}`);
      });
  } finally {
    logMsg(msg);
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

// If the configuration says we are in replay mode, do not start the service.
if (!configuration.isReplayMode) {
  startup()
    .catch((err) => {
      console.error(`Error: ${err}`);
    });
}
