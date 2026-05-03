/* eslint-disable @typescript-eslint/no-magic-numbers */
import configuration from './services/configuration';
import { IDataModelMqttMsg } from './services/database/database.types';
import { IMQTTMessage } from './mqtt/IMQTTMessage';
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
  // Delay loading app so importing replay.ts does not trigger app startup side effects.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const appModule = require('./app') as typeof import('./app');
  const mqtt_msg: IMQTTMessage = JSON.parse(mqttMsgDataModel.msg);
  const topic = mqtt_msg.topic;
  const message = mqtt_msg.message;
  const buffer = Buffer.from(message, 'utf8');

  configuration.dateOverride = new Date(mqttMsgDataModel.timestamp);
  appModule.processTopic(topic, buffer);
}

export { processLogLine };

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

    log(`Read ${rows.length} rows, min processing time = ${ (rows.length / MS_IN_MINUTE).toFixed(2)} minutes.`);

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

export { replay };

/**
 * Write out the statistics
 */
function writeStats(): void {
  console.log(JSON.stringify(statistics.getStats(), null, 2));
}

export { writeStats };

/**
 * Run a replay cycle and emit final statistics.
 * @param startTimestamp - Optional start timestamp for replay window.
 * @param endTimestamp - Optional end timestamp for replay window.
 */
export async function runReplay(
  startTimestamp = new Date('2023-12-09T08:35:45.900Z'),
  endTimestamp = new Date('2023-12-10T08:43:29.942Z')
): Promise<void> {
  const previousReplayMode = configuration.isReplayMode;
  const previousThrottleRate = configuration.throttleRateMinutes;
  const previousDateOverride = configuration.dateOverride;
  configuration.isReplayMode = true;
  configuration.throttleRateMinutes = 0.01;

  try {
    await replay(startTimestamp, endTimestamp);
    writeStats();
    await sleepPromise(100);
  } finally {
    await dataStore.close();
    stopScheduler();
    configuration.dateOverride = previousDateOverride;
    configuration.isReplayMode = previousReplayMode;
    configuration.throttleRateMinutes = previousThrottleRate;
  }
}

if (require.main === module) {
  runReplay()
    .catch((err) => {
      log(`Error: ${err}`);
    });
}
