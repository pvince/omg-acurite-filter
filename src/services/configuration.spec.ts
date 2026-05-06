/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import configuration from './configuration';

describe('configuration', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    configuration.dateOverride = null;
  });

  afterEach(() => {
    process.env = savedEnv;
    configuration.dateOverride = null;
  });

  describe('mqttHost', () => {
    it('should return env value when set', () => {
      process.env.MQTT_HOST = 'mqtt://test-host';
      expect(configuration.mqttHost).to.equal('mqtt://test-host');
    });

    it('should return UNSET placeholder when env is missing', () => {
      delete process.env.MQTT_HOST;
      expect(configuration.mqttHost).to.equal('<unset>');
    });
  });

  describe('mqttUser / mqttPass', () => {
    it('should return UNSET placeholders when mqtt credentials are missing', () => {
      delete process.env.MQTT_USER;
      delete process.env.MQTT_PASS;

      expect(configuration.mqttUser).to.equal('<unset>');
      expect(configuration.mqttPass).to.equal('<unset>');
    });
  });

  describe('mqttSrcTopic', () => {
    it('should append /# when topic has no trailing slash or hash', () => {
      process.env.MQTT_SRC_TOPIC = 'home/sensors';
      expect(configuration.mqttSrcTopic).to.equal('home/sensors/#');
    });

    it('should append # when topic ends with a slash', () => {
      process.env.MQTT_SRC_TOPIC = 'home/sensors/';
      expect(configuration.mqttSrcTopic).to.equal('home/sensors/#');
    });

    it('should not modify topic that already ends with /#', () => {
      process.env.MQTT_SRC_TOPIC = 'home/sensors/#';
      expect(configuration.mqttSrcTopic).to.equal('home/sensors/#');
    });

    it('should return UNSET placeholder when env is missing', () => {
      delete process.env.MQTT_SRC_TOPIC;
      expect(configuration.mqttSrcTopic).to.equal('<unset>');
    });
  });

  describe('mqttDestTopic', () => {
    it('should append /# to destination topic', () => {
      process.env.MQTT_DST_TOPIC = 'home/forwarded';
      expect(configuration.mqttDestTopic).to.equal('home/forwarded/#');
    });
  });

  describe('mqttHADiscoveryTopic', () => {
    it('should return the trimmed env value when set', () => {
      process.env.MQTT_HADISCOVERY_TOPIC = ' customhome ';
      expect(configuration.mqttHADiscoveryTopic).to.equal('customhome');
    });

    it('should return UNSET placeholder when env is missing', () => {
      delete process.env.MQTT_HADISCOVERY_TOPIC;
      expect(configuration.mqttHADiscoveryTopic).to.equal('<unset>');
    });

    it('should return UNSET placeholder when env is empty or whitespace', () => {
      process.env.MQTT_HADISCOVERY_TOPIC = '   ';
      expect(configuration.mqttHADiscoveryTopic).to.equal('<unset>');
    });
  });

  describe('isDebug', () => {
    it('should return true when ISDEBUG is "true"', () => {
      process.env.ISDEBUG = 'true';
      expect(configuration.isDebug).to.be.true;
    });

    it('should return false when ISDEBUG is not "true"', () => {
      process.env.ISDEBUG = 'false';
      expect(configuration.isDebug).to.be.false;
    });
  });

  describe('newDate / dateNow', () => {
    it('should return current date when no override is set', () => {
      const before = Date.now();
      const result = configuration.newDate().getTime();
      const after = Date.now();
      expect(result).to.be.within(before, after);
    });

    it('should return the override date when one is set', () => {
      const fixed = new Date('2026-01-01T00:00:00Z');
      configuration.dateOverride = fixed;
      expect(configuration.newDate()).to.equal(fixed);
      expect(configuration.dateNow()).to.equal(fixed.getTime());
    });
  });

  describe('throttleRate', () => {
    it('should compute rate from throttleRateMinutes in ms', () => {
      const originalRate = configuration.throttleRateMinutes;
      configuration.throttleRateMinutes = 2;
      expect(configuration.throttleRate).to.equal(2 * 60 * 1000);
      configuration.throttleRateMinutes = originalRate;
    });
  });

  describe('paths', () => {
    it('should build dataDir from appDir', () => {
      expect(configuration.dataDir).to.contain('data');
    });
  });
});
