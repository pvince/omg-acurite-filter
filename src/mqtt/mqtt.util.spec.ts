/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-magic-numbers */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildTopicRegex, forwardTopic } from './mqtt.util';

describe('mqtt.util', () => {
  describe('buildTopicRegex', () => {
    it('should match a bare prefix when the topic filter ends with a hash wildcard', () => {
      const result = buildTopicRegex('devices/#').test('devices');
      expect(result).to.equal(true);
    });
  });

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

    it('should create forwarded topic when wildcard segments contain hyphens', () => {
      const src_topic = '433_direct/raw/OMG-lilygo-rtl-433-ESP/RTL_433toMQTT/Acurite-Tower/A/8623';
      const expected_result = '433_direct/OMG-lilygo-rtl-433-ESP/RTL_433toMQTT/Acurite-Tower/A/8623';
      const result = forwardTopic(src_topic);
      expect(result).to.eq(expected_result);
    });

    it('should create forwarded topic when wildcard segments are empty', () => {
      const src_topic = '433_direct/raw//RTL_433toMQTT/Acurite-Tower/A/8623';
      const expected_result = '433_direct//RTL_433toMQTT/Acurite-Tower/A/8623';
      const result = forwardTopic(src_topic);
      expect(result).to.eq(expected_result);
    });

    it('should create forwarded topic when wildcard segments equal zero', () => {
      const src_topic = '433_direct/raw/0/RTL_433toMQTT/Acurite-Tower/A/8623';
      const expected_result = '433_direct/0/RTL_433toMQTT/Acurite-Tower/A/8623';
      const result = forwardTopic(src_topic);
      expect(result).to.eq(expected_result);
    });

    it('should create forwarded topic when the source hash wildcard matches no trailing segments', () => {
      process.env.MQTT_SRC_TOPIC = 'devices/#';
      process.env.MQTT_DST_TOPIC = 'forwarded/#';

      const result = forwardTopic('devices');

      expect(result).to.eq('forwarded');
    });
  });
});
