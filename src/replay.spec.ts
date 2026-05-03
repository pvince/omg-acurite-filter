/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import configuration from './services/configuration';
import * as databaseModule from './services/database/database';
import dataStore from './services/database/dataStore';
import statistics from './services/statistics';
import * as schedulerModule from './services/jobScheduler';
import * as constantsModule from './constants';
import { IDataModelMqttMsg } from './services/database/database.types';

function requireApp(): typeof import('./app') {
  configuration.isReplayMode = true;
  delete require.cache[require.resolve('./app')];
  return require('./app');
}

function requireReplay(): typeof import('./replay') {
  delete require.cache[require.resolve('./replay')];
  return require('./replay');
}

describe('replay', () => {
  const originalReplayMode = configuration.isReplayMode;
  const originalLoadDB = databaseModule.loadDB;
  const originalInitialize = dataStore.initialize;
  const originalClose = dataStore.close;
  const originalGetStats = statistics.getStats;
  const originalStopScheduler = schedulerModule.stopScheduler;
  const originalSleepPromise = constantsModule.sleepPromise;
  const originalDateOverride = configuration.dateOverride;
  const originalThrottleRate = configuration.throttleRateMinutes;
  let appModule: typeof import('./app');
  let originalProcessTopic: typeof import('./app').processTopic;

  beforeEach(() => {
    configuration.dateOverride = null;
    appModule = requireApp();
    originalProcessTopic = appModule.processTopic;
  });

  afterEach(() => {
    (appModule as any).processTopic = originalProcessTopic;
    (databaseModule as any).loadDB = originalLoadDB;
    (dataStore as any).initialize = originalInitialize;
    (dataStore as any).close = originalClose;
    (statistics as any).getStats = originalGetStats;
    (schedulerModule as any).stopScheduler = originalStopScheduler;
    (constantsModule as any).sleepPromise = originalSleepPromise;
    configuration.dateOverride = originalDateOverride;
    configuration.throttleRateMinutes = originalThrottleRate;
    configuration.isReplayMode = originalReplayMode;
  });

  it('should parse a row and pass topic/message buffer to processTopic', async () => {
    const replayModule = requireReplay();

    let receivedTopic = '';
    let receivedMessage = '';
    (appModule as any).processTopic = (topic: string, message: Buffer) => {
      receivedTopic = topic;
      receivedMessage = message.toString('utf8');
    };

    const row = {
      timestamp: new Date('2024-01-01T00:00:00.000Z').getTime(),
      msg: JSON.stringify({ topic: 'a/b', message: '{"x":1}' }),
      device_id: null
    } as IDataModelMqttMsg;

    await replayModule.processLogLine(row);

    expect(receivedTopic).to.equal('a/b');
    expect(receivedMessage).to.equal('{"x":1}');
    expect(configuration.dateOverride?.toISOString()).to.equal('2024-01-01T00:00:00.000Z');
  });

  it('should initialize datastore, process db rows, and close the db', async () => {
    const replayModule = requireReplay();

    let initialized = false;
    let closed = false;
    let processedCount = 0;

    (dataStore as any).initialize = async () => {
      initialized = true;
    };
    (appModule as any).processTopic = () => {
      processedCount++;
    };
    (databaseModule as any).loadDB = async () => ({
      all: async () => [
        {
          timestamp: new Date('2024-01-01T00:00:00.000Z').getTime(),
          msg: JSON.stringify({ topic: 'one', message: '1' }),
          device_id: null
        },
        {
          timestamp: new Date('2024-01-01T00:00:01.000Z').getTime(),
          msg: JSON.stringify({ topic: 'two', message: '2' }),
          device_id: null
        }
      ],
      close: async () => {
        closed = true;
      }
    });

    await replayModule.replay(new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:01:00.000Z'));

    expect(initialized).to.equal(true);
    expect(processedCount).to.equal(2);
    expect(closed).to.equal(true);
  });

  it('should close the db and rethrow when query fails', async () => {
    const replayModule = requireReplay();

    let closed = false;
    (dataStore as any).initialize = async () => undefined;
    (databaseModule as any).loadDB = async () => ({
      all: async () => {
        throw new Error('db failed');
      },
      close: async () => {
        closed = true;
      }
    });

    let error: Error | null = null;
    try {
      await replayModule.replay(new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:01:00.000Z'));
    } catch (err) {
      error = err as Error;
    }

    expect(error?.message).to.equal('db failed');
    expect(closed).to.equal(true);
  });

  it('should print stats as formatted json', () => {
    const replayModule = requireReplay();

    const output: string[] = [];
    const originalConsoleLog = console.log;

    (statistics as any).getStats = () => ({ sample: 1 });
    console.log = (msg: string) => {
      output.push(msg);
    };

    try {
      replayModule.writeStats();
    } finally {
      console.log = originalConsoleLog;
    }

    expect(output).to.have.length(1);
    expect(output[0]).to.contain('"sample": 1');
  });

  it('should run replay workflow and call scheduler stop and sleep', async () => {
    const replayModule = requireReplay();

    let stopped = false;
    let slept = 0;
    let datastoreClosed = false;

    (dataStore as any).initialize = async () => undefined;
    (dataStore as any).close = async () => {
      datastoreClosed = true;
    };
    (databaseModule as any).loadDB = async () => ({
      all: async () => [],
      close: async () => undefined
    });
    (schedulerModule as any).stopScheduler = () => {
      stopped = true;
    };
    (constantsModule as any).sleepPromise = async (ms: number) => {
      slept = ms;
    };
    (statistics as any).getStats = () => ({ ok: true });

    await replayModule.runReplay(new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:01:00.000Z'));

    expect(stopped).to.equal(true);
    expect(slept).to.equal(100);
    expect(datastoreClosed).to.equal(true);
  });

  it('should restore replay config and stop scheduler when replay fails', async () => {
    const replayModule = requireReplay();

    let stopped = false;
    let datastoreClosed = false;
    configuration.dateOverride = new Date('2026-01-01T00:00:00.000Z');
    configuration.throttleRateMinutes = 3;
    configuration.isReplayMode = false;

    (dataStore as any).initialize = async () => undefined;
    (dataStore as any).close = async () => {
      datastoreClosed = true;
    };
    (databaseModule as any).loadDB = async () => ({
      all: async () => {
        throw new Error('replay failed');
      },
      close: async () => undefined
    });
    (schedulerModule as any).stopScheduler = () => {
      stopped = true;
    };

    let error: Error | null = null;
    try {
      await replayModule.runReplay(new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:01:00.000Z'));
    } catch (err) {
      error = err as Error;
    }

    expect(error?.message).to.equal('replay failed');
    expect(stopped).to.equal(true);
    expect(datastoreClosed).to.equal(true);
    expect(configuration.isReplayMode).to.equal(false);
    expect(configuration.throttleRateMinutes).to.equal(3);
    expect(configuration.dateOverride?.toISOString()).to.equal('2026-01-01T00:00:00.000Z');
  });
});
