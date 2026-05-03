/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Request, Response } from 'express';
import statistics from '../services/statistics';
import {
  handleAppStats,
  handleCacheStats,
  handleForwarderStats,
  handleMqttStats,
  handleStats
} from './statsRouter';

interface IMockResponse extends Response {
  payload?: unknown;
  sendCalled?: boolean;
}

function createResponse(): IMockResponse {
  const res: IMockResponse = {} as IMockResponse;
  res.json = (payload: unknown) => {
    res.payload = payload;
    return res;
  };
  res.send = () => {
    res.sendCalled = true;
    return res;
  };
  return res;
}

describe('statsRouter', () => {
  it('should return full statistics payload', () => {
    const originalGetStats = statistics.getStats;
    const expected = { forwarders: { active: 1 } };

    statistics.getStats = () => expected as any;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleStats(req, res);
      expect(res.payload).to.equal(expected);
      expect(res.sendCalled).to.equal(true);
    } finally {
      statistics.getStats = originalGetStats;
    }
  });

  it('should return forwarder statistics', () => {
    const original = statistics.forwarderStats;
    const expected = { active: 3 };
    statistics.forwarderStats = () => expected as any;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleForwarderStats(req, res);
      expect(res.payload).to.equal(expected);
    } finally {
      statistics.forwarderStats = original;
    }
  });

  it('should return mqtt statistics', () => {
    const original = statistics.mqttStats;
    const expected = { sent: { total: 9 } };
    statistics.mqttStats = () => expected as any;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleMqttStats(req, res);
      expect(res.payload).to.equal(expected);
    } finally {
      statistics.mqttStats = original;
    }
  });

  it('should return cache statistics', () => {
    const original = statistics.cacheStats;
    const expected = { devices: 5 };
    statistics.cacheStats = () => expected as any;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleCacheStats(req, res);
      expect(res.payload).to.equal(expected);
    } finally {
      statistics.cacheStats = original;
    }
  });

  it('should return app statistics', () => {
    const original = statistics.appStats;
    const expected = { uptime: '1 second' };
    statistics.appStats = () => expected as any;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleAppStats(req, res);
      expect(res.payload).to.equal(expected);
    } finally {
      statistics.appStats = original;
    }
  });
});
