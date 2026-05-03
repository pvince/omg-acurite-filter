import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Request, Response } from 'express';
import msgLog from '../services/msgLog';
import { handleLogs } from './logsRouter';

describe('logsRouter', () => {
  it('should write logged messages to the response', () => {
    const expected = [
      {
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        device_id: 'dev-1',
        msg: 'test message'
      }
    ];

    const original = msgLog.getMsgs;
    let jsonPayload: unknown;
    let sendCalled = false;

    msgLog.getMsgs = () => expected;

    const req = {} as Request;
    const res = {
      json: (payload: unknown) => {
        jsonPayload = payload;
        return res;
      },
      send: () => {
        sendCalled = true;
        return res;
      }
    } as unknown as Response;

    try {
      handleLogs(req, res);

      expect(jsonPayload).to.deep.equal(expected);
      expect(sendCalled).to.equal(true);
    } finally {
      msgLog.getMsgs = original;
    }
  });
});
