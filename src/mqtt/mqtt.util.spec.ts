/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-magic-numbers */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { forwardTopic } from './mqtt.util';

describe('mqtt.util', () => {
  describe('forwardTopic', () => {
    it('should create forwarded topic', () => {
      const src_topic = '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623';
      const expected_result = '';
      const result = forwardTopic(src_topic);
      expect(result).to.eq(expected_result);
    });
  });
});
