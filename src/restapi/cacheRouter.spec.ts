/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import dataCache from '../services/dataCache';
import { DataEntry } from '../services/dataEntries/dataEntry';
import { handleCache, handleCacheEntry, handleCleanup } from './cacheRouter';

interface IMockResponse extends Response {
  payload?: unknown;
  statusCodeSent?: number;
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

  res.sendStatus = (statusCode: number) => {
    res.statusCodeSent = statusCode;
    return res;
  };

  return res;
}

describe('cacheRouter', () => {
  it('should return cache summary sorted by oldest timestamp', () => {
    const originalGetEntries = dataCache.getEntries;

    const firstEntry = { timestamp: new Date('2026-01-01T00:00:00.000Z') } as DataEntry;
    const secondEntry = { timestamp: new Date('2026-01-01T02:00:00.000Z') } as DataEntry;

    dataCache.getEntries = () => {
      return new Map<string, DataEntry[]>([
        ['newer', [secondEntry]],
        ['older', [firstEntry, secondEntry]]
      ]).entries();
    };

    const req = {} as Request;
    const res = createResponse();

    try {
      handleCache(req, res);

      const payload = res.payload as Array<{id: string; count: number}>;
      expect(payload.length).to.equal(2);
      expect(payload[0].id).to.equal('older');
      expect(payload[0].count).to.equal(2);
      expect(payload[1].id).to.equal('newer');
      expect(res.sendCalled).to.not.equal(true);
    } finally {
      dataCache.getEntries = originalGetEntries;
    }
  });

  it('should return cache entry array when id exists', () => {
    const originalGetByID = dataCache.getByID;
    const expected = [{ timestamp: new Date('2026-01-01T00:00:00.000Z') }] as DataEntry[];

    dataCache.getByID = () => expected;

    const req = {
      params: {
        id: 'sensor-1'
      }
    } as unknown as Request;
    const res = createResponse();

    try {
      handleCacheEntry(req, res);

      expect(res.payload).to.equal(expected);
      expect(res.statusCodeSent).to.equal(undefined);
    } finally {
      dataCache.getByID = originalGetByID;
    }
  });

  it('should return not found when cache entry does not exist', () => {
    const originalGetByID = dataCache.getByID;
    dataCache.getByID = () => null;

    const req = {
      params: {
        id: 'missing'
      }
    } as unknown as Request;
    const res = createResponse();

    try {
      handleCacheEntry(req, res);

      expect(res.statusCodeSent).to.equal(StatusCodes.NOT_FOUND);
    } finally {
      dataCache.getByID = originalGetByID;
    }
  });

  it('should return cleanup summary counts', () => {
    const originalCleanup = dataCache.cleanup;
    const originalCountDescriptor = Object.getOwnPropertyDescriptor(dataCache, 'count');

    let countValue = 2;

    Object.defineProperty(dataCache, 'count', {
      configurable: true,
      get: () => countValue
    });

    dataCache.cleanup = () => {
      countValue = 1;
      return 1;
    };

    const req = {} as Request;
    const res = createResponse();

    try {
      handleCleanup(req, res);

      expect(res.payload).to.deep.equal({
        initialCount: 2,
        deleted: 1,
        finalCount: 1
      });
      expect(res.sendCalled).to.not.equal(true);
    } finally {
      dataCache.cleanup = originalCleanup;
      if (originalCountDescriptor) {
        Object.defineProperty(dataCache, 'count', originalCountDescriptor);
      } else {
        Reflect.deleteProperty(dataCache, 'count');
      }
    }
  });
});
