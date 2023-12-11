/* eslint-disable @typescript-eslint/no-magic-numbers */
import configuration from './services/configuration';
configuration.isReplayMode = true;
configuration.throttleRateMinutes = 0.01;


import { IDataModelMqttMsg } from './services/database/database.types';
import { IMQTTMessage } from './mqtt/IMQTTMessage';
import { processTopic } from './app';
import dataStore from './services/database/dataStore';
import { loadDB } from './services/database/database';
import statistics from './services/statistics';
import { stopScheduler } from './services/jobScheduler';
import { MS_IN_MINUTE, sleepPromise } from './constants';

const log = configuration.log.extend('replay');

/**
 * Process an individual log line
 * @param mqttMsgDataModel - Log line to process
 */
async function processLogLine(mqttMsgDataModel: IDataModelMqttMsg ): Promise<void> {
  const mqtt_msg: IMQTTMessage = JSON.parse(mqttMsgDataModel.msg);
  const topic = mqtt_msg.topic;
  const message = mqtt_msg.message;
  const buffer = Buffer.from(message, 'utf8');

  configuration.dateOverride = new Date(mqttMsgDataModel.timestamp);
  processTopic(topic, buffer);
}

/**
 * Replay the log from the specified timestamp.
 * @param startTimestamp - Start timestamp
 * @param endTimestamp - End timestamp
 */
async function replay(startTimestamp: Date, endTimestamp: Date): Promise<void> {
  await dataStore.initialize();

  const db = await loadDB();

  // eslint-disable-next-line no-useless-catch
  try {
    log('Reading all rows from the database...');
    const rows = await db.all(
      `SELECT timestamp, msg, device_id
    FROM mqtt_msgs
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC`,
      startTimestamp, endTimestamp);

    log(`Read ${rows.length} rows, min processing time = ${rows.length / MS_IN_MINUTE} minutes.`);

    let i = 0;
    for (const row of rows) {
      await processLogLine(row as IDataModelMqttMsg);
      i++;
      if (i % 1000 === 0) {
        log(`\tProcessed ${i}/${rows.length} - ${(Math.round((i / rows.length) * 100))}%`);
      }
      if (i % 100 === 0) {
        // Allow the process to come up for air & let async tasks to run periodically.
        await sleepPromise(0);
      }
    }

    // eslint-disable-next-line no-useless-catch
  } catch (err) {
    throw err;
  } finally {
    await db.close();
  }

}

/**
 * Write out the statistics
 */
function writeStats(): void {
  console.log(JSON.stringify(statistics.getStats(), null, 2));
}

const startTimestamp = new Date('2023-12-10T08:35:45.900Z');
const endTimestamp = new Date('2023-12-10T08:43:29.942Z');

replay(startTimestamp, endTimestamp)
  .then(() => (writeStats()))
  .then(() => stopScheduler())
  .catch((err) => {
    log(`Error: ${err}`);
  });
