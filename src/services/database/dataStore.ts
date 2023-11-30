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

import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { Database } from 'sqlite';
import { deleteOldMqttMsgs, insertMqttMsg, loadDB } from './database';
import { IDataStoreEntry } from './dataStore.types';
import { MS_IN_DAY } from '../../constants';
import configuration from '../configuration';

const log = configuration.log.extend('dataStore');

const MAX_MSG_AGE_IN_DAYS = 7;
const MAX_MSG_AGE_IN_MS = MAX_MSG_AGE_IN_DAYS * MS_IN_DAY;

const PURGE_FREQUENCY_IN_DAYS = 1;
const PURGE_FREQUENCY_IN_MS = PURGE_FREQUENCY_IN_DAYS * MS_IN_DAY;

/**
 * Data storage class for interacting with the data store.
 */
class DataStore {
    /**
     * Reference to the database
     * @private
     */
    private database: Database | null = null;

    /**
     * When was the last time the database was cleaned?
     * This is not going to be accurate, but that is OK. Wor
     * @private
     */
    private last_purge: Date = new Date();

    /**
     * Initialize the dataStore. Must be called before any other functions.
     */
    public async initialize():  Promise<void> {
        this.database = await loadDB();
    }

    /**
     * Add a message to the log.
     * @param msg - Msg to log
     * @returns - Promise that resolves when finished.
     */
    public async add(msg: IMQTTMessage): Promise<void> {
        if (!this.database) {
            log('Error! Database not initialized.');
        } else {
            const timestamp = new Date();
            const logLine: IDataStoreEntry = { timestamp, msg };
            await insertMqttMsg(this.database, logLine);

            //todo: This should really be done via a scheduler. This is going to cause a hang each time it is invoked.
            await this.purgeOldMsgs();
        }
    }

    /**
     * Cleanup any MQTT messages that are older than MAX_MSG_AGE_IN_DAYS
     * @protected
     */
    protected async purgeOldMsgs(): Promise<void> {
        if (!this.database) {
            log('Error! Database not initialized.');
        } else {
            const new_purge_timestamp = Date.now();
            const purge_due_date = new_purge_timestamp - PURGE_FREQUENCY_IN_MS;
            if (this.last_purge.getTime() < purge_due_date) {
                log('Purging old messages from the database...');
                const cutoff_timestamp = new Date(new_purge_timestamp - MAX_MSG_AGE_IN_MS);

                await deleteOldMqttMsgs(this.database, cutoff_timestamp);

                this.last_purge = new Date(new_purge_timestamp);
                log('Purge complete.');
            }
        }

    }
}

const dataStore = new DataStore();

export default dataStore;
