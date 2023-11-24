import * as fs from 'fs';
import configuration from '../services/configuration';
import { IMQTTMessage } from './IMQTTMessage';

const log = configuration.log.extend('dumper');

/**
 * Dumps an MQTT message to a log file.
 * @param mqttMsg - Topic for the received message
 */
export function dumpMessage(mqttMsg: IMQTTMessage): void {
  try {
    const strObj = JSON.stringify(mqttMsg) + '\n';

    fs.writeFileSync(configuration.MQTT_MSG_LOG_FILE, strObj, { flag: 'a' });
  } catch (ex) {
    log(`Failed to dump MQTT message to [${configuration.MQTT_MSG_LOG_FILE}] for topic [${mqttMsg.topic}]: ${ex}`);
  }
}

