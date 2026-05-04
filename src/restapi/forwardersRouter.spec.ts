/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Request, Response } from 'express';
import { JobStatus } from 'toad-scheduler';
import { messageForwardingService } from '../services/messageForwardingService';
import { buildForwarder, gatherForwarders, handleForwarders } from './forwardersRouter';

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

describe('forwardersRouter', () => {
  it('should build a forwarder payload from a job', () => {
    const originalGetMessage = messageForwardingService.getMessage;
    const queuedMessage = { topic: 'src/topic', message: '{}', data: {} };

    messageForwardingService.getMessage = () => queuedMessage;

    const job = {
      getStatus: () => JobStatus.RUNNING
    } as any;

    try {
      const result = buildForwarder('device-1', job);

      expect(result.id).to.equal('device-1');
      expect(result.status).to.equal(JobStatus.RUNNING);
      expect(result.queuedMessage).to.equal(queuedMessage);
    } finally {
      messageForwardingService.getMessage = originalGetMessage;
    }
  });

  it('should gather all forwarders from the forwarding service', () => {
    const originalJobEntries = messageForwardingService.jobEntries;
    const originalGetMessage = messageForwardingService.getMessage;

    const queued = { topic: 'src/topic', message: '{}', data: {} };

    messageForwardingService.jobEntries = () => {
      const runningJob = { getStatus: () => JobStatus.RUNNING } as any;
      const stoppedJob = { getStatus: () => JobStatus.STOPPED } as any;
      return new Map<string, any>([
        ['device-a', runningJob],
        ['device-b', stoppedJob]
      ]).entries();
    };

    messageForwardingService.getMessage = (device_id: string) => {
      return device_id === 'device-a' ? queued as any : null;
    };

    try {
      const result = gatherForwarders();

      expect(result.length).to.equal(2);
      expect(result[0].id).to.equal('device-a');
      expect(result[0].status).to.equal(JobStatus.RUNNING);
      expect(result[0].queuedMessage).to.equal(queued);
      expect(result[1].id).to.equal('device-b');
      expect(result[1].status).to.equal(JobStatus.STOPPED);
      expect(result[1].queuedMessage).to.equal(null);
    } finally {
      messageForwardingService.jobEntries = originalJobEntries;
      messageForwardingService.getMessage = originalGetMessage;
    }
  });

  it('should write gathered forwarders to the response', () => {
    const originalJobEntries = messageForwardingService.jobEntries;
    const originalGetMessage = messageForwardingService.getMessage;

    messageForwardingService.jobEntries = () => {
      const job = { getStatus: () => JobStatus.RUNNING } as any;
      return new Map<string, any>([['device-1', job]]).entries();
    };

    messageForwardingService.getMessage = () => null;

    const req = {} as Request;
    const res = createResponse();

    try {
      handleForwarders(req, res);

      const payload = res.payload as Array<{ id: string }>;
      expect(payload.length).to.equal(1);
      expect(payload[0].id).to.equal('device-1');
      expect(res.sendCalled).to.not.equal(true);
    } finally {
      messageForwardingService.jobEntries = originalJobEntries;
      messageForwardingService.getMessage = originalGetMessage;
    }
  });
});
