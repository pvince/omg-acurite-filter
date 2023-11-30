/**
 * Goals
 * 1. Long term storage of all received MQTT messages.
 * 2. Ability to 'Replay' a log of messages for diagnostic purposes
 * 3. Store a fixed quantity of data, eg: 7 days of data, auto-remove old data.
 * 4. Ability to retrieve a zipped up archive of all log files via REST API
 * 5. Ability to replay an archive of log files. Maybe a startup flag?
 */

/**
 * Short term goals
 * 1. Ability to simply log an MQTT message & topic to a file
 *      - Timestamp
 *      - Topic
 *      - String formatted data
 * 2. Filename = YYYY.mm.dd_mqtt.log
 * 3. File contents = JSON formatted line for each log entry
 * 4. When writing a 'new file'....
 *      - Compress the old file to YYYY.mm.dd_mqtt.log.gz
 *      - Delete any log file older than X days
 * 5. Ability to retrieve a zipped up archive of all current log files via
 *    REST API.
 * 6. Ability to replay an archive of log files via REST API?
 */

import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import * as fs from 'fs';
import path from 'path';

/**
 * Returns the directory where logs are stored.
 * @returns - Log directory
 */
function getLogDirectory(): string {
    return '';
}

/**
 * Returns the current log file name, eg: YYYY.mm.dd_mqtt.log
 * @returns - Log filename
 */
function getLogFilename(): string {
    return '';
}

/**
 * Get the full path to the log file.
 * @returns - Full path to the current log file.
 */
function getLogFilePath(): string {
    return path.join(getLogDirectory(), getLogFilename());
}

/**
 * Data storage class for interacting with the data store.
 */
class DataStore {
    /**
     * Add a message to the log.
     * @param msg - Msg to log
     * @returns - Promise that resolves when finished.
     */
    public async add(msg: IMQTTMessage): Promise<void> {
        const logLine = {
            timestamp: new Date(),
            topic: msg.topic,
            message: msg.message
        };

        await fs.promises.writeFile(getLogFilePath(), JSON.stringify(logLine));
    }
}

const dataStore = new DataStore();

export default dataStore;
