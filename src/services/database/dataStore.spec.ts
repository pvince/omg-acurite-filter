/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import configuration from '../configuration';
import dataStore from './dataStore';
import * as database from './database';

describe('dataStore', () => {
  afterEach(() => {
    (dataStore as any).database = null;
    configuration.isReplayMode = false;
  });

  it('should throw from add when datastore is not initialized', async () => {
    configuration.isReplayMode = false;

    let err: unknown;
    try {
      await dataStore.add({ topic: 'x', message: '{}', data: {} } as any);
    } catch (ex) {
      err = ex;
    }

    expect(`${err}`).to.contain('Datastore is not initialized');
  });

  it('should no-op add when replay mode is enabled', async () => {
    configuration.isReplayMode = true;

    await dataStore.add({ topic: 'x', message: '{}', data: {} } as any);
  });

  it('should throw from getByDeviceID when datastore is not initialized', async () => {
    let err: unknown;
    try {
      await dataStore.getByDeviceID('abc');
    } catch (ex) {
      err = ex;
    }

    expect(`${err}`).to.contain('Datastore is not initialized');
  });

  it('should call insertMqttMsg when initialized', async () => {
    configuration.isReplayMode = false;
    const originalInsert = (database as any).insertMqttMsg;

    let insertCalled = false;
    (database as any).insertMqttMsg = async () => {
      insertCalled = true;
    };

    (dataStore as any).database = { run: async () => undefined };

    try {
      await dataStore.add({ topic: 'x', message: '{}', data: {} } as any);
      expect(insertCalled).to.equal(true);
    } finally {
      (database as any).insertMqttMsg = originalInsert;
    }
  });

  it('should call deleteOldMqttMsgs during purge when initialized', async () => {
    const originalDelete = (database as any).deleteOldMqttMsgs;
    let called = false;

    (database as any).deleteOldMqttMsgs = async () => {
      called = true;
      return 1;
    };

    (dataStore as any).database = {};

    try {
      await (dataStore as any).purgeOldMsgs();
      expect(called).to.equal(true);
    } finally {
      (database as any).deleteOldMqttMsgs = originalDelete;
    }
  });
});
