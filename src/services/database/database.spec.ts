/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { KnownType } from '../../mqtt/omg_devices/device';
import {
  DB_VERSION,
  deleteOldMqttMsgs,
  getDbVersion,
  initializeDb,
  insertMqttMsg,
  upgradeToV2
} from './database';

describe('database', () => {
  async function createDb(): Promise<Database> {
    return open({ filename: ':memory:', driver: sqlite3.Database });
  }

  it('should report uninitialized version on empty database', async () => {
    const db = await createDb();
    try {
      const [version, err] = await getDbVersion(db);
      expect(version).to.equal(DB_VERSION.uninitialized);
      expect(err).to.equal(null);
    } finally {
      await db.close();
    }
  });

  it('should initialize schema and set current version', async () => {
    const db = await createDb();
    try {
      await initializeDb(db);

      const [version, err] = await getDbVersion(db);
      expect(version).to.equal(DB_VERSION.v2);
      expect(err).to.equal(null);

      const row = await db.get("SELECT name FROM sqlite_master WHERE type='table' and name='mqtt_msgs'");
      expect(row?.name).to.equal('mqtt_msgs');
    } finally {
      await db.close();
    }
  });

  it('should upgrade v1 schema to v2', async () => {
    const db = await createDb();
    try {
      await db.exec(`
        create table info (version integer);
        create table mqtt_msgs (timestamp DATETIME not null, msg TEXT not null);
        insert into info(version) values (${DB_VERSION.v1});
      `);

      await upgradeToV2(db);

      const [version] = await getDbVersion(db);
      expect(version).to.equal(DB_VERSION.v2);

      const col = await db.get("PRAGMA table_info(mqtt_msgs)");
      expect(col).to.exist;
    } finally {
      await db.close();
    }
  });

  it('should insert messages with derived device id', async () => {
    const db = await createDb();
    try {
      await initializeDb(db);

      const msg = {
        topic: 'src/topic',
        message: JSON.stringify({ id: '1' }),
        data: {
          id: '1',
          model: KnownType.MaverickET73,
          rssi: -30
        }
      };

      await insertMqttMsg(db, msg as any);

      const row = await db.get('SELECT device_id, msg FROM mqtt_msgs LIMIT 1');
      expect(row.device_id).to.equal(`${KnownType.MaverickET73}:1`);
      expect(row.msg).to.be.a('string');
    } finally {
      await db.close();
    }
  });

  it('should delete messages older than cutoff timestamp', async () => {
    const db = await createDb();
    try {
      await initializeDb(db);

      const oldTs = Date.parse('2025-01-01T00:00:00.000Z');
      const newTs = Date.parse('2026-01-01T00:00:00.000Z');
      const payload = JSON.stringify({ topic: 'x', message: '{}', data: { id: '1', model: KnownType.MaverickET73, rssi: -40 } });

      await db.run('INSERT INTO mqtt_msgs (timestamp, device_id, msg) VALUES (?, ?, ?)', oldTs, 'old', payload);
      await db.run('INSERT INTO mqtt_msgs (timestamp, device_id, msg) VALUES (?, ?, ?)', newTs, 'new', payload);

      const deleted = await deleteOldMqttMsgs(db, new Date('2025-06-01T00:00:00.000Z'));
      expect(deleted).to.equal(1);

      const count = await db.get('SELECT count(*) as count FROM mqtt_msgs');
      expect(count.count).to.equal(1);
    } finally {
      await db.close();
    }
  });
});
