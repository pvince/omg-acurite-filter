/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import dataStore from '../services/database/dataStore';
import { handleMsgsByDeviceID } from './dataRouter';

interface IMockResponse extends Response {
  payload?: unknown;
}

function createResponse(): IMockResponse {
  const res: IMockResponse = { statusCode: StatusCodes.OK } as IMockResponse;

  res.json = (payload: unknown) => {
    res.payload = payload;
    return res;
  };

  return res;
}

describe('dataRouter', () => {
  it('should return device messages when lookup succeeds', async () => {
    const originalGetByDeviceID = dataStore.getByDeviceID;
    const expected = [
      {
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        topic: 'x/y',
        msg: { id: '1', model: 'Acurite-Tower' },
        device_id: 'Acurite-Tower:1'
      }
    ];

    dataStore.getByDeviceID = (async () => expected) as any;

    const req = {
      params: { device_id: 'Acurite-Tower:1' },
      query: {}
    } as unknown as Request;
    const res = createResponse();

    try {
      await handleMsgsByDeviceID(req, res);
      expect(res.statusCode).to.equal(StatusCodes.OK);
      expect(res.payload).to.equal(expected);
    } finally {
      dataStore.getByDeviceID = originalGetByDeviceID;
    }
  });

  it('should reject when max_age is smaller than min_age', async () => {
    const originalGetByDeviceID = dataStore.getByDeviceID;
    let called = false;

    dataStore.getByDeviceID = (async () => {
      called = true;
      return [];
    }) as any;

    const req = {
      params: { device_id: 'Acurite-Tower:1' },
      query: { max_age: '5', min_age: '10' }
    } as unknown as Request;
    const res = createResponse();

    try {
      await handleMsgsByDeviceID(req, res);

      expect(called).to.equal(false);
      expect(res.statusCode).to.equal(StatusCodes.BAD_REQUEST);
      expect(res.payload).to.deep.equal({
        code: StatusCodes.BAD_REQUEST,
        message: 'max_age must be greater than min_age'
      });
    } finally {
      dataStore.getByDeviceID = originalGetByDeviceID;
    }
  });

  it('should return not found when data store returns null', async () => {
    const originalGetByDeviceID = dataStore.getByDeviceID;

    dataStore.getByDeviceID = (async () => null) as any;

    const req = {
      params: { device_id: 'missing' },
      query: {}
    } as unknown as Request;
    const res = createResponse();

    try {
      await handleMsgsByDeviceID(req, res);

      expect(res.statusCode).to.equal(StatusCodes.NOT_FOUND);
      expect(res.payload).to.deep.equal({
        code: StatusCodes.NOT_FOUND,
        message: 'Device with id missing not found.'
      });
    } finally {
      dataStore.getByDeviceID = originalGetByDeviceID;
    }
  });

  it('should parse numeric query values before calling data store', async () => {
    const originalGetByDeviceID = dataStore.getByDeviceID;

    let parsedMax: number | undefined;
    let parsedMin: number | undefined;

    dataStore.getByDeviceID = (async (_device_id: string, max_age?: number, min_age?: number) => {
      parsedMax = max_age;
      parsedMin = min_age;
      return [];
    }) as any;

    const req = {
      params: { device_id: 'Acurite-Tower:1' },
      query: { max_age: '15', min_age: '3' }
    } as unknown as Request;
    const res = createResponse();

    try {
      await handleMsgsByDeviceID(req, res);

      expect(parsedMax).to.equal(15);
      expect(parsedMin).to.equal(3);
    } finally {
      dataStore.getByDeviceID = originalGetByDeviceID;
    }
  });
});
