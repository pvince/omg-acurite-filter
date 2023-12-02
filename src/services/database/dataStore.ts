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
import { deleteOldMqttMsgs, getMqttMsgsByDevice, insertMqttMsg, loadDB } from './database';
import { MS_IN_DAY } from '../../constants';
import configuration from '../configuration';
import { getScheduler } from '../jobScheduler';
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler';
import { IDataStoreOMGMsg } from './dataStore.util';

const log = configuration.log.extend('dataStore');

const MAX_MSG_AGE_IN_DAYS = 7;
const MAX_MSG_AGE_IN_MS = MAX_MSG_AGE_IN_DAYS * MS_IN_DAY;

const PURGE_FREQUENCY_IN_DAYS = 1;

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
     * Initialize the dataStore. Must be called before any other functions.
     */
    public async initialize():  Promise<void> {
        if (!this.database) {
            this.database = await loadDB();

            const taskFunc = async (): Promise<void>=> (this.purgeOldMsgs());
            const task = new AsyncTask('purgeOldMsgs', taskFunc, (err) => {
                log(`Error: purgeOldMsgs - ${err}`);
            });
            const job = new SimpleIntervalJob(
              { days: PURGE_FREQUENCY_IN_DAYS, runImmediately: true },
              task);
            getScheduler().addSimpleIntervalJob(job);
        } else {
            log('Error: initialize called,  but database is already initialized.');
        }
    }

    /**
     * Add a message to the log.
     * @param msg - Msg to log
     * @returns - Promise that resolves when finished.
     */
    public async add(msg: IMQTTMessage): Promise<void> {
        if (!this.database) {
            throw new Error('add() - Datastore is not initialized');
        } else {
            await insertMqttMsg(this.database, msg);
        }
    }

    public async getByDeviceID(device_id: string, max_age_minutes?: number, min_age_minutes?: number): Promise<IDataStoreOMGMsg[]> {
        if (!this.database) {
            throw new Error('getByDeviceID() - Datastore is not initialized');
        } else {
            return getMqttMsgsByDevice(this.database, device_id, max_age_minutes, min_age_minutes);
        }
    }

    /**
     * Cleanup any MQTT messages that are older than MAX_MSG_AGE_IN_DAYS
     * @protected
     */
    protected async purgeOldMsgs(): Promise<void> {
        if (!this.database) {
            throw new Error('purgeOldMsgs() - Datastore is not initialized');
        } else {
            try {
                const cutoff_timestamp = new Date(Date.now() - MAX_MSG_AGE_IN_MS);
                log(`Purging messages older than ${cutoff_timestamp.toISOString()}...`);
                const deleted = await deleteOldMqttMsgs(this.database, cutoff_timestamp);

                log(`Purge complete. Deleted ${deleted} messages.`);
            } catch (err) {
                log(`Error: purgeOldMsgs - ${err}`);
            }
        }
    }
}

const dataStore = new DataStore();

export default dataStore;
