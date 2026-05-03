/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import dataCache from '../dataCache';
import { messageForwardingService } from '../messageForwardingService';
import configuration from '../configuration';
import { appStats, mqttRecRate, mqttSendRate, mqttStats } from './passiveStatistics';
import statistics from './index';

describe('statistics service', () => {
  afterEach(() => {
    configuration.dateOverride = null;
  });

  it('should gather cache and forwarder stats', () => {
    const originalGetJobCount = messageForwardingService.getJobCount;
    const originalCountDescriptor = Object.getOwnPropertyDescriptor(dataCache, 'count');

    messageForwardingService.getJobCount = () => 3;
    Object.defineProperty(dataCache, 'count', {
      configurable: true,
      get: () => 7
    });

    try {
      expect(statistics.forwarderStats().active).to.equal(3);
      expect(statistics.cacheStats().devices).to.equal(7);
    } finally {
      messageForwardingService.getJobCount = originalGetJobCount;
      if (originalCountDescriptor) {
        Object.defineProperty(dataCache, 'count', originalCountDescriptor);
      }
    }
  });

  it('should compute mqtt percentages and rates', () => {
    mqttStats.received.total = 10;
    mqttStats.sent.total = 4;

    mqttRecRate.mark();
    mqttSendRate.mark();

    const result = statistics.mqttStats();

    expect(result.sent.pct_fwded).to.equal(40);
    expect(result.sent.rates.perSec).to.be.greaterThan(0);
    expect(result.received.rates.perMin).to.be.greaterThan(0);
  });

  it('should build app stats including uptime and memory', () => {
    configuration.dateOverride = new Date(appStats.startTime.getTime() + 10000);

    const result = statistics.appStats();

    expect(result.uptime.length).to.be.greaterThan(0);
    expect(result.memory.totalBytes).to.be.greaterThan(0);
    expect(result.memory.usedBytes).to.be.greaterThan(0);
  });
});
