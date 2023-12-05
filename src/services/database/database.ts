import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import configuration from '../configuration';
import _ from 'lodash';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { buildDataEntry } from '../dataEntries/dataEntry';
import { IDataModelMqttMsg } from './database.types';
import { IDataStoreOMGMsg } from './dataStore.types';
import { convertMqttMsg } from './dataStore.util';
import { MS_IN_MINUTE } from '../../constants';
import * as fs from 'fs';

const log = configuration.log.extend('db');


/**
 * Database versions
 */
export enum DB_VERSION {
  /**
   * Database version is not one of our known versions. We found the info table, but the version was bad for
   * some reason.
   */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  unknown = -1,
  /**
   * There is no info table, and therefore we are assuming the database is uninitialized.
   */
  uninitialized,
  /**
   * msg_mqtt was just timestamp, msg in v2 it was modified
   */
  v1,
  /**
   * Changes in v2:
   * - Added device_id column which can be null.
   */
  v2
}

const vCurrent = DB_VERSION.v2;

/**
 * List of expected database tables
 */
enum TABLE {
  info = 'info',
  mqtt_msgs = 'mqtt_msgs'
}

/**
 * Database filename on disk.
 * @returns - Database filename on disk.
 */
function getDbFilename(): string {
  return 'database.db';
}

/**
 * Path to the database file
 * @returns - Path to the database file
 */
function getDbFilePath(): string {
  return path.join(configuration.dataDir, getDbFilename());
}

/**
 * Does the specified table exist in the database?
 * @param db - Database
 * @param table - Table
 * @returns - True if the table exists.
 */
async function doesTableExist(db: Database, table: TABLE): Promise<boolean> {
  let result = false;
  try {
    const row = await db.get('SELECT name FROM sqlite_master WHERE type=\'table\' and name=?', table);
    if (row?.name)  {
      result = true;
    }
  } catch (ex) {
    log(`doesTableExist(${table}): ${ex}`);

  }
  return result;
}

/**
 * Get the version of the database.
 * @param db - Database to check the version of.
 * @returns - The database version, and possibly an error message that can be displayed to the end user.
 */
export async function getDbVersion(db: Database): Promise<[DB_VERSION, null | string]> {
  let result = DB_VERSION.uninitialized;
  let err_msg: null | string = null;

  if (await doesTableExist(db, TABLE.info)) {
    try {
      const row = await db.get('SELECT version FROM info');

      const dbVersion = row?.version;
      if (!_.isNumber(dbVersion) || dbVersion < DB_VERSION.unknown ) {
        err_msg = `Unknown database version: ${dbVersion}`;
        result = DB_VERSION.unknown;
      } else if (dbVersion === DB_VERSION.unknown || dbVersion === DB_VERSION.uninitialized) {
        err_msg = `Database version set to an invalid value: [${DB_VERSION[dbVersion]}]`;
        result = DB_VERSION.unknown;
      } else if (dbVersion < vCurrent) {
        err_msg = `Database is an old version [${DB_VERSION[dbVersion]}`;
        result = dbVersion;
      } else if (dbVersion > vCurrent) {
        err_msg = `Database version [${dbVersion}] is newer than this applications supported database version [${vCurrent}].`;
        result = dbVersion;
      } else {
        result = dbVersion; // Hey! We are probably loading the current database version, which is good.
      }
    } catch (ex) {
      err_msg = `Failed to query database version from the info table. ${ex}`;
    }
  }

  return [result, err_msg];
}

/**
 * Initialize the database with its default structure.
 * @param db - Database to initialize
 */
export async function initializeDb(db: Database): Promise<void> {
  log('Initializing database with new tables...');
  const script =  `
      create table info
      (
          version integer
      );

      create table mqtt_msgs
      (
          timestamp DATETIME not null,
          msg       TEXT     not null,
          device_id text
      );

      create index mqtt_msgs_device_id_msg_index
          on mqtt_msgs (device_id, msg);

      create index mqtt_msgs_timestamp_index
          on mqtt_msgs (timestamp desc);

      insert into info (version) values (${vCurrent})
  `;

  await db.exec(script);

}

/**
 * Database upgrade logic. Upgrades database to v2.
 * @param db - Database to upgrade.
 */
export async function upgradeToV2(db: Database): Promise<void> {
  log(`Upgrading database to ${DB_VERSION[DB_VERSION.v2]}`);
  const script = `
    alter table mqtt_msgs
      add device_id text;

    create index mqtt_msgs_device_id_msg_index
        on mqtt_msgs (device_id, msg);

    update info set version = ${DB_VERSION.v2};
  `;

  await db.exec(script);
  log(`Upgrade to ${DB_VERSION[DB_VERSION.v2]} complete.`);
}

/**
 * Load the database & return a reference to it.
 * @returns - Reference to the database.
 */
export async function loadDB():  Promise<Database> {
  const dbFilePath = getDbFilePath();
  log(`Loading ${dbFilePath}...`);

  await fs.promises.mkdir(configuration.dataDir, { recursive: true });

  const db = await open({
    filename: dbFilePath,
    driver: sqlite3.Database
  });

  let [dbVersion, err_msg] = await getDbVersion(db);

  // Check if we need to upgrade the database.
  if (dbVersion === DB_VERSION.v1) {
    await upgradeToV2(db);
    [dbVersion, err_msg] = await getDbVersion(db);
  }

  // Check if we need to initialize the database, or if we failed to load it.
  if (dbVersion === DB_VERSION.uninitialized) {
    await initializeDb(db);
  } else if (dbVersion !== vCurrent) {
    log(err_msg ?? 'Unknown error');
    throw new Error(err_msg ?? 'Unknown error');
  }

  log('Database loaded.');
  return db;
}

/**
 * Inserts a new MQTT message into the database.
 * @param db - Database to insert into
 * @param mqtt_msg - MQTT Message to save.
 */
export async function insertMqttMsg(db: Database, mqtt_msg: IMQTTMessage): Promise<void> {
  const dataEntry = buildDataEntry(mqtt_msg);

  await db.run(
    'INSERT INTO mqtt_msgs (timestamp, device_id, msg) VALUES (?, ?, ?)',
    new Date(),
    dataEntry?.get_unique_id() ?? null,
    JSON.stringify(mqtt_msg));
}

/**
 * Deletes old MQTT messages from the database.
 * @param db - Database to delete from
 * @param ageCutoff - Max age cutoff for messages.
 * @returns - Number of messages deleted.
 */
export async function deleteOldMqttMsgs(db: Database, ageCutoff: Date): Promise<number> {
  const result = await db.run(
    'DELETE FROM mqtt_msgs where timestamp < ?', ageCutoff
  );
  return result?.changes ?? 0;
}

const DEFAULT_MAX_AGE_MINUTES = 5;

/**
 * Retrieve MQTT messages from the database by device ID
 * @param db - Database to query
 * @param device_id - Device ID to look for
 * @param max_age_minutes - Maximum age for the messages
 * @param min_age_minutes - Minimum age for hte messages.
 * @returns - Array of the objects found in the database.
 */
export async function getMqttMsgsByDevice(
  db: Database,
  device_id: string,
  max_age_minutes?: number,
  min_age_minutes?: number
): Promise<IDataStoreOMGMsg[]> {
  const result: IDataStoreOMGMsg[] = [];

  // Possible:
  // 1. Have Min, Have Max
  //  - Done
  // 2. Have Min, No Max
  //  - Max = Min + Default
  // 3. No Min, No Max
  //  - Max & Min = Default
  // 4. No Min, Have Max
  //  - Min = Max - Default

  let _tmpMaxAge = max_age_minutes;
  let _tmpMinAge = min_age_minutes;
  if (_tmpMinAge === undefined && _tmpMaxAge === undefined) {
    _tmpMinAge = 0;
    _tmpMaxAge = _tmpMinAge + DEFAULT_MAX_AGE_MINUTES;
  } else if (_tmpMaxAge) {
    // Have max
    _tmpMinAge = _tmpMaxAge - DEFAULT_MAX_AGE_MINUTES;
  } else if (_tmpMinAge) {
    // Have Min
    _tmpMaxAge = _tmpMinAge + DEFAULT_MAX_AGE_MINUTES;
  }

  // Make typescript happy...
  if (!_tmpMaxAge || !_tmpMinAge) {
    _tmpMinAge = 0;
    _tmpMaxAge = _tmpMinAge + DEFAULT_MAX_AGE_MINUTES;
  }

  const max_age = new Date(Date.now() - _tmpMaxAge * MS_IN_MINUTE);
  const min_age = new Date(Date.now() - _tmpMinAge * MS_IN_MINUTE);

  // eslint-disable-next-line no-useless-catch
  try {
    await db.each(
      `SELECT timestamp, msg, device_id 
        FROM mqtt_msgs 
        WHERE device_id == ? AND timestamp > ? AND timestamp < ?
        ORDER BY timestamp DESC`,
      device_id, max_age, min_age,
      (err, row: IDataModelMqttMsg) => {
        if (err) {
          throw err;
        }
        result.push(convertMqttMsg(row));
      });
  } catch (err) {
    throw err;
  }
  return result;
}
