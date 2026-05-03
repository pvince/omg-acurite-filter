/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { MsgMergerRSSI } from './msgMergerRSSI';
import { ThrottlerMaverick } from './throttlerMaverick';
import { get_replacement_value, get_throttle_rate } from './index';

const originalHasCustomRate = ThrottlerMaverick.prototype.hasCustomRate;
const originalGetCustomRate = ThrottlerMaverick.prototype.getCustomRate;
const originalCanReplaceValue = MsgMergerRSSI.prototype.canReplaceValue;
const originalReplaceValue = MsgMergerRSSI.prototype.replaceValue;

describe('forwarders index', () => {
  afterEach(() => {
    ThrottlerMaverick.prototype.hasCustomRate = originalHasCustomRate;
    ThrottlerMaverick.prototype.getCustomRate = originalGetCustomRate;
    MsgMergerRSSI.prototype.canReplaceValue = originalCanReplaceValue;
    MsgMergerRSSI.prototype.replaceValue = originalReplaceValue;
  });

  it('should use custom throttle rate when a throttler matches', () => {
    ThrottlerMaverick.prototype.hasCustomRate = () => true;
    ThrottlerMaverick.prototype.getCustomRate = () => 12345;

    const result = get_throttle_rate({ topic: 'x', message: '{}', data: {} } as any);

    expect(result).to.equal(12345);
  });

  it('should return transformed replacement value when merger matches', () => {
    const replacement = { topic: 'dst', message: '{}', data: { id: '1', model: 'Acurite-Tower', rssi: -20 } };

    MsgMergerRSSI.prototype.canReplaceValue = () => true;
    MsgMergerRSSI.prototype.replaceValue = () => replacement as any;

    const result = get_replacement_value(
      { topic: 'a', message: '{}', data: { id: '1', model: 'Acurite-Tower', rssi: -40 } } as any,
      { topic: 'b', message: '{}', data: { id: '1', model: 'Acurite-Tower', rssi: -30 } } as any
    );

    expect(result).to.equal(replacement);
  });
});
