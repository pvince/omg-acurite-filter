/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import configuration from './services/configuration';
import dataCache from './services/dataCache';
import { homeAssistantDiscoveryService } from './services/homeAssistantDiscovery';
import { messageForwardingService } from './services/messageForwardingService';
import { mqttStats } from './services/statistics/passiveStatistics';

function requireApp(): typeof import('./app') {
  configuration.isReplayMode = true;
  delete require.cache[require.resolve('./app')];
  return require('./app');
}

describe('app processTopic', () => {
  const originalDataCacheAdd = dataCache.add;
  const originalEnsureDiscoveryForReport = homeAssistantDiscoveryService.ensureDiscoveryForReport;
  const originalThrottleMessage = messageForwardingService.throttleMessage;
  const originalForwardMessage = messageForwardingService.forwardMessage;
  const originalReplayMode = configuration.isReplayMode;

  beforeEach(() => {
    configuration.isReplayMode = true;
  });

  afterEach(() => {
    dataCache.add = originalDataCacheAdd;
    homeAssistantDiscoveryService.ensureDiscoveryForReport = originalEnsureDiscoveryForReport;
    messageForwardingService.throttleMessage = originalThrottleMessage;
    messageForwardingService.forwardMessage = originalForwardMessage;
    configuration.isReplayMode = originalReplayMode;
  });

  it('should ensure discovery before throttling valid rtl_433 sensor reports', async () => {
    const app = requireApp();

    const raw = {
      model: 'Acurite-Tower',
      id: '8623',
      rssi: -81,
      channel: 'A',
      battery_ok: 1,
      temperature_C: 21.3,
      humidity: 44
    };

    let ensureCallCount = 0;
    let throttleCallCount = 0;

    dataCache.add = () => true;
    homeAssistantDiscoveryService.ensureDiscoveryForReport = async () => {
      ensureCallCount++;
    };
    messageForwardingService.throttleMessage = () => {
      throttleCallCount++;
    };

    app.processTopic('433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      Buffer.from(JSON.stringify(raw), 'utf8'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ensureCallCount).to.equal(1);
    expect(throttleCallCount).to.equal(1);
  });

  it('should forward unknown message types via throttleMessage', () => {
    const app = requireApp();

    const beforeUnknown = mqttStats.received.unknown;
    let forwardedTopic = '';
    let forwardedMsg: any = null;

    messageForwardingService.throttleMessage = (topic: string, msg: any) => {
      forwardedTopic = topic;
      forwardedMsg = msg;
    };

    app.processTopic('unknown/topic', Buffer.from('{"foo":"bar"}', 'utf8'));

    expect(forwardedTopic).to.equal('unknown/topic');
    expect(forwardedMsg.topic).to.equal('unknown/topic');
    expect(forwardedMsg.message).to.equal('{"foo":"bar"}');
    expect(mqttStats.received.unknown).to.equal(beforeUnknown + 1);
  });

  it('should forward unparseable payloads through forwardMessage', () => {
    const app = requireApp();

    const beforeUnparseable = mqttStats.received.unparseable;
    let forwarded: any = null;

    messageForwardingService.forwardMessage = async (msg: any) => {
      forwarded = msg;
    };

    app.processTopic('bad/topic', Buffer.from('{bad-json', 'utf8'));

    expect(forwarded).to.deep.equal({ topic: 'bad/topic', message: '{bad-json' });
    expect(mqttStats.received.unparseable).to.equal(beforeUnparseable + 1);
  });
});

describe('app startup', () => {
  const originalReplayMode = configuration.isReplayMode;

  afterEach(() => {
    configuration.isReplayMode = originalReplayMode;
  });

  it('should initialize discovery before source topic subscription', async () => {
    const app = requireApp();
    const originalDeps = { ...app._deps };
    const callOrder: string[] = [];

    app._deps.initializeDataStore = async () => {
      callOrder.push('dataStore');
    };
    app._deps.startMQTT = async () => {
      callOrder.push('mqtt');
    };
    app._deps.initializeDiscovery = async () => {
      callOrder.push('discovery');
    };
    app._deps.subscribe = async () => {
      callOrder.push('subscribe');
    };
    app._deps.startWebService = async () => {
      callOrder.push('web');
    };

    try {
      await app.startup();
    } finally {
      Object.assign(app._deps, originalDeps);
    }

    expect(callOrder).to.deep.equal(['dataStore', 'mqtt', 'discovery', 'subscribe', 'web']);
  });
});
