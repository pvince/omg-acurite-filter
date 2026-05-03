/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { KnownType } from '../../mqtt/omg_devices/device';
import configuration from '../configuration';
import { ThrottlerMaverick } from './throttlerMaverick';

function getMaverick(t1: number, t2: number): any {
  return {
    topic: 'src/topic',
    message: '{}',
    data: {
      id: '1',
      model: KnownType.MaverickET73,
      rssi: -40,
      temperature_1_C: t1,
      temperature_2_C: t2
    }
  };
}

describe('ThrottlerMaverick', () => {
  it('should report custom rate support for maverick messages', () => {
    const throttler = new ThrottlerMaverick();
    const msg = getMaverick(10, 20);

    expect(throttler.hasCustomRate(msg)).to.equal(true);
  });

  it('should not report custom rate support for non-maverick messages', () => {
    const throttler = new ThrottlerMaverick();
    const msg = {
      topic: 'src/topic',
      message: '{}',
      data: {
        id: '1',
        model: KnownType.AcuriteTower,
        rssi: -40
      }
    };

    expect(throttler.hasCustomRate(msg as any)).to.equal(false);
  });

  it('should return fast throttle rate when any probe reaches threshold', () => {
    const throttler = new ThrottlerMaverick();
    const msg = getMaverick(150, 20);

    expect(throttler.getCustomRate(msg)).to.equal(30000);
  });

  it('should return default throttle rate when probes are below threshold', () => {
    const throttler = new ThrottlerMaverick();
    const msg = getMaverick(149, 149);

    expect(throttler.getCustomRate(msg)).to.equal(configuration.throttleRate);
  });
});
