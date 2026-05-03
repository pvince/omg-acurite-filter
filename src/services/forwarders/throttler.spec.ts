import { expect } from 'chai';
import { describe, it } from 'mocha';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { AbstractThrottler } from './throttler';

class TestThrottler extends AbstractThrottler {
  public hasCustomRate(msg: IMQTTMessage): boolean {
    return msg.topic.startsWith('custom/');
  }

  public getCustomRate(msg: IMQTTMessage): number {
    return msg.topic.length;
  }
}

describe('AbstractThrottler', () => {
  it('should support concrete implementations for custom-rate matching', () => {
    const throttler = new TestThrottler();
    const hasCustomRate = throttler.hasCustomRate({ topic: 'custom/device', message: '{}' });

    expect(hasCustomRate).to.equal(true);
  });

  it('should return custom throttle rates from concrete implementations', () => {
    const throttler = new TestThrottler();
    const rate = throttler.getCustomRate({ topic: 'abc', message: '{}' });

    expect(rate).to.equal(3);
  });
});
