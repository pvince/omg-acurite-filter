/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import configuration from './configuration';
import { forwarderStats } from './statistics/passiveStatistics';
import { messageForwardingService } from './messageForwardingService';

describe('messageForwardingService', () => {
  afterEach(() => {
    configuration.isReplayMode = false;
    for (const job of (messageForwardingService as any).jobStore.values()) {
      if (job && typeof job.stop === 'function') {
        job.stop();
      }
    }
    (messageForwardingService as any).messages.clear();
    (messageForwardingService as any).jobStore.clear();
  });

  it('should return null for missing queued message', () => {
    expect(messageForwardingService.getMessage('missing')).to.equal(null);
  });

  it('should queue a throttled message', () => {
    configuration.isReplayMode = true;

    messageForwardingService.throttleMessage('dev-1', { topic: 'src/t', message: '{}', data: {} } as any);

    expect(messageForwardingService.getJobCount()).to.equal(1);
  });

  it('should remove queued message after forwardThrottledMessage', async () => {
    configuration.isReplayMode = true;

    (messageForwardingService as any).setMessage('dev-1', { topic: 'src/t', message: '{}', data: {} });

    await (messageForwardingService as any).forwardThrottledMessage('dev-1');

    expect(messageForwardingService.getMessage('dev-1')).to.equal(null);
  });

  it('should stop and remove job when no queued message exists', async () => {
    const endedBefore = forwarderStats.ended;

    (messageForwardingService as any).jobStore.set('dev-1', {
      stop: () => undefined
    });

    await (messageForwardingService as any).forwardThrottledMessage('dev-1');

    expect((messageForwardingService as any).jobStore.has('dev-1')).to.equal(false);
    expect(forwarderStats.ended).to.equal(endedBefore + 1);
  });
});
