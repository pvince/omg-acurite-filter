import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import configuration from '../configuration';
import _ from 'lodash';
import { IDataStoreEntry } from './dataStore.types';

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
   * Hey! The database says it is the current version! vCurrent should always be the 'current' database version.
   * When upgrading, add what _was_ the current version as a new DB_VERSION number, eg: v1
   */
  vCurrent
}

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
      } else if (dbVersion < DB_VERSION.vCurrent) {
        err_msg = `Database is an old version [${DB_VERSION[dbVersion]}`;
        result = dbVersion;
      } else if (dbVersion > DB_VERSION.vCurrent) {
        err_msg = `Database version [${dbVersion}] is newer than this applications supported database version [${DB_VERSION.vCurrent}].`;
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
      msg       TEXT     not null
    );
  
    create index mqtt_msgs_timestamp_index
        on mqtt_msgs (timestamp desc);

    insert into info (version) values (${DB_VERSION.vCurrent})
  `;

  await db.exec(script);

}

/**
 * Load the database & return a reference to it.
 * @returns - Reference to the database.
 */
export async function loadDB():  Promise<Database> {
  const dbFilePath = getDbFilePath();
  log(`Loading ${dbFilePath}`);

  const db = await open({
    filename: dbFilePath,
    driver: sqlite3.Database
  });

  const [dbVersion, err_msg] = await getDbVersion(db);

  if (dbVersion === DB_VERSION.uninitialized) {
    await initializeDb(db);
  } else if (dbVersion !== DB_VERSION.vCurrent) {
    log(err_msg ?? 'Unknown error');
    throw new Error(err_msg ?? 'Unknown error');
  }

  return db;
}

/**
 * Inserts a new MQTT message into the database.
 * @param db - Database to insert into
 * @param dataStoreEntry - dataStoreEntry to save.
 */
export async function insertMqttMsg(db: Database, dataStoreEntry: IDataStoreEntry): Promise<void> {
  await db.run(
    'INSERT INTO mqtt_msgs ("timestamp", msg) VALUES (?, ?)',
    dataStoreEntry.timestamp,
    JSON.stringify(dataStoreEntry));
}

/**
 * Deletes old MQTT messages from the database.
 * @param db - Database to delete from
 * @param ageCutoff - Max age cutoff for messages.
 */
export async function deleteOldMqttMsgs(db: Database, ageCutoff: Date): Promise<void> {
  await db.run(
    'DELETE FROM mqtt_msgs where timestamp < ?', ageCutoff
  );
}
