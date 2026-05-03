/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { KnownType } from '../../mqtt/omg_devices/device';
import { MsgMergerRSSI } from './msgMergerRSSI';

function getMsg(rssi: number): any {
  return {
    topic: 'src/topic',
    message: '{}',
    data: {
      id: '1',
      model: KnownType.AcuriteTower,
      rssi
    }
  };
}

describe('MsgMergerRSSI', () => {
  it('should detect when message can replace value by rssi presence', () => {
    const merger = new MsgMergerRSSI();

    expect(merger.canReplaceValue(getMsg(-40))).to.equal(true);
    expect(merger.canReplaceValue({ topic: 'x', message: '{}', data: { id: '1', model: KnownType.AcuriteTower } } as any)).to.equal(false);
  });

  it('should keep the stronger rssi value', () => {
    const merger = new MsgMergerRSSI();
    const prevMsg = getMsg(-35);
    const newMsg = getMsg(-50);

    const result = merger.replaceValue(prevMsg, newMsg) as any;

    expect(result).to.equal(newMsg);
    expect(result.data.rssi).to.equal(-35);
  });

  it('should keep incoming rssi when it is already stronger', () => {
    const merger = new MsgMergerRSSI();
    const prevMsg = getMsg(-60);
    const newMsg = getMsg(-45);

    const result = merger.replaceValue(prevMsg, newMsg) as any;

    expect(result.data.rssi).to.equal(-45);
  });
});
