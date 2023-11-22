/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-magic-numbers */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { forwardTopic } from './mqtt.util';

describe('mqtt.util', () => {
  describe('forwardTopic', () => {
    let backupSrc: string | undefined = undefined;
    let backupDst: string | undefined = undefined;
    before(() => {
      backupSrc = process.env.MQTT_SRC_TOPIC;
      backupDst = process.env.MQTT_DST_TOPIC;

      process.env.MQTT_SRC_TOPIC = '433_direct/raw/+/RTL_433toMQTT';
      process.env.MQTT_DST_TOPIC = '433_direct/+/RTL_433toMQTT';
    });

    after(() => {
        process.env.MQTT_SRC_TOPIC = backupSrc;
        process.env.MQTT_DST_TOPIC = backupDst;
    });

    it('should create forwarded topic', () => {
      const src_topic = '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623';
      const expected_result = '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623';
      const result = forwardTopic(src_topic);
      expect(result).to.eq(expected_result);
    });
  });
});
