/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { DataEntry } from './dataEntries/dataEntry';
import configuration from './configuration';
import { _deps, homeAssistantDiscoveryService } from './homeAssistantDiscovery';

describe('homeAssistantDiscoveryService', () => {
  const originalPublish = _deps.publish;
  const originalForwardTopic = _deps.forwardTopic;
  const originalReplayMode = configuration.isReplayMode;

  beforeEach(() => {
    (homeAssistantDiscoveryService as any)._resetForTesting();
    configuration.isReplayMode = false;
    _deps.forwardTopic = () => 'forwarded/state/topic';
  });

  afterEach(() => {
    _deps.publish = originalPublish;
    _deps.forwardTopic = originalForwardTopic;
    configuration.isReplayMode = originalReplayMode;
    (homeAssistantDiscoveryService as any)._resetForTesting();
  });

  it('should publish retained discovery messages once per rtl_433 entity', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCalls.length).to.equal(2);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
    expect(publishCalls[1].topic).to.equal('homeassistant/sensor/A_Acurite-Tower_8623_humidity/config');
    expect(publishCalls[0].opts).to.deep.equal({ retain: true, qos: 1 });
    expect(publishCalls[1].opts).to.deep.equal({ retain: true, qos: 1 });
  });

  it('should skip discovery publish for non-rtl_433 topics', async () => {
    let publishCallCount = 0;
    _deps.publish = async () => {
      publishCallCount++;
    };

    const entry = new DataEntry(
      '433_direct/raw/some-source/not-rtl/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCallCount).to.equal(0);
  });

  it('should publish discovery entities for dual probe Maverick payloads', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Maverick-ET73x/7761',
      {
        model: 'Maverick-ET73x',
        id: '7761',
        rssi: -77,
        temperature_1_C: 88.2,
        temperature_2_C: 106.6
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCalls.length).to.equal(2);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Maverick-ET73x_7761_temperature_1_C/config');
    expect(publishCalls[1].topic).to.equal('homeassistant/sensor/Maverick-ET73x_7761_temperature_2_C/config');
    expect(publishCalls[0].payload).to.deep.equal({
      name: 'Maverick-ET73x 7761 Probe 1 Temperature',
      unique_id: 'Maverick-ET73x_7761_temperature_1_C',
      state_topic: 'forwarded/state/topic',
      value_template: '{{ value_json.temperature_1_C }}',
      device_class: 'temperature',
      unit_of_measurement: '°C',
      device: {
        identifiers: ['Maverick-ET73x_7761'],
        name: 'Maverick-ET73x 7761',
        model: 'Maverick-ET73x',
        manufacturer: 'rtl_433'
      }
    });
  });

  it('should skip discovery when rtl_433 payload has no supported metrics', async () => {
    let publishCallCount = 0;
    _deps.publish = async () => {
      publishCallCount++;
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-5n1/A/2247',
      {
        model: 'Acurite-5n1',
        id: '2247',
        rssi: -76,
        channel: 'A',
        battery_ok: 1,
        message_type: 49,
        wind_avg_km_h: 1.8,
        wind_dir_deg: 157,
        rain_mm: 139.19
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCallCount).to.equal(0);
  });

  it('should skip discovery for unknown models even when probe temperature fields are present', async () => {
    let publishCallCount = 0;
    _deps.publish = async () => {
      publishCallCount++;
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Unknown-Model/999',
      {
        model: 'Unknown-Model',
        id: '999',
        rssi: -64,
        temperature_1_C: 19.4,
        temperature_2_C: 51.8
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCallCount).to.equal(0);
  });

  it('should avoid duplicate discovery publishes when calls overlap', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    );

    await Promise.all([
      homeAssistantDiscoveryService.ensureDiscoveryForReport(entry),
      homeAssistantDiscoveryService.ensureDiscoveryForReport(entry)
    ]);

    expect(publishTopics.length).to.equal(2);
    expect(new Set(publishTopics).size).to.equal(2);
  });

  it('should retry discovery publish after a transient publish failure', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
      if (publishTopics.length === 1) {
        throw new Error('temporary publish failure');
      }
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);
      expect.fail('Expected publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('temporary publish failure');
    }

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishTopics.length).to.equal(3);
    expect(publishTopics.filter((topic) => topic.includes('temperature_C')).length).to.equal(2);
    expect(publishTopics.filter((topic) => topic.includes('humidity')).length).to.equal(1);
  });

  it('should not mark discovery as sent when replay mode is enabled', async () => {
    let publishCallCount = 0;
    _deps.publish = async () => {
      publishCallCount++;
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    );

    configuration.isReplayMode = true;
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);
    configuration.isReplayMode = false;
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCallCount).to.equal(2);
  });
});
