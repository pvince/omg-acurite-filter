/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { convertMqttMsg } from './dataStore.util';

describe('dataStore.util', () => {
  it('should convert data model row into datastore object', () => {
    const model = {
      timestamp: Date.parse('2026-01-01T00:00:00.000Z'),
      device_id: 'Maverick-ET73x:1',
      msg: JSON.stringify({
        topic: 'src/topic',
        message: '{}',
        data: {
          id: '1',
          model: 'Maverick-ET73x',
          rssi: -40
        }
      })
    };

    const result = convertMqttMsg(model as any);

    expect(result.topic).to.equal('src/topic');
    expect(result.device_id).to.equal('Maverick-ET73x:1');
    expect(result.timestamp.toISOString()).to.equal('2026-01-01T00:00:00.000Z');
    expect((result.msg as any).rssi).to.equal(-40);
  });
});
