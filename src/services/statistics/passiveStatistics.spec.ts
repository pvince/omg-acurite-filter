/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { getRates } from './passiveStatistics';

describe('passiveStatistics', () => {
  it('should return per-second and per-minute rates from rate meter', () => {
    const meter = {
      getRatePerSecond: () => 2.5,
      getRatePerMinute: () => 150
    };

    const result = getRates(meter as any);

    expect(result).to.deep.equal({
      perSec: 2.5,
      perMin: 150
    });
  });
});
