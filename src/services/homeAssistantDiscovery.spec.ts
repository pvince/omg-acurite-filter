/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import type { fnMessageCallback } from '../mqtt/mqttComms';
import { DataEntry } from './dataEntries/dataEntry';
import configuration from './configuration';
import { _deps, homeAssistantDiscoveryService } from './homeAssistantDiscovery';

function buildAcuriteTowerEntry(): DataEntry {
  return new DataEntry(
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
}

function buildMaverickEntry(): DataEntry {
  return new DataEntry(
    '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Maverick-ET73x/7761',
    {
      model: 'Maverick-ET73x',
      id: '7761',
      rssi: -77,
      temperature_1_C: 88.2,
      temperature_2_C: 106.6
    } as any
  );
}

describe('homeAssistantDiscoveryService', () => {
  const originalPublish = _deps.publish;
  const originalSubscribe = _deps.subscribe;
  const originalReplayMode = configuration.isReplayMode;
  let savedEnv: NodeJS.ProcessEnv;
  let discoveryCallback: fnMessageCallback | null = null;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env.MQTT_DST_TOPIC = '433_direct/+/RTL_433toMQTT';
    configuration.isReplayMode = false;
    discoveryCallback = null;
    (homeAssistantDiscoveryService as any)._resetForTesting();
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
      }
    };
  });

  afterEach(() => {
    process.env = savedEnv;
    _deps.publish = originalPublish;
    _deps.subscribe = originalSubscribe;
    configuration.isReplayMode = originalReplayMode;
    discoveryCallback = null;
    (homeAssistantDiscoveryService as any)._resetForTesting();
  });

  it('should publish OMG-compatible retained discovery messages once per rtl_433 entity', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    const entry = buildAcuriteTowerEntry();

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCalls.length).to.equal(2);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishCalls[1].topic).to.equal('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
    expect(publishCalls[0].opts).to.deep.equal({ retain: true, qos: 1 });
    expect(publishCalls[0].payload).to.deep.equal({
      stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
      dev_cla: 'temperature',
      unit_of_meas: '°C',
      name: 'temperature',
      uniq_id: 'Acurite-Tower-A-8623-temperature_C',
      val_tpl: '{{ value_json.temperature_C | is_defined }}',
      state_class: 'measurement',
      device: {
        identifiers: ['Acurite-Tower-A-8623'],
        connections: [['mac', 'Acurite-Tower-A-8623']],
        model: 'Acurite-Tower',
        name: 'Acurite-Tower-A-8623',
        via_device: 'OMG_lilygo_rtl_433_ESP'
      }
    });
  });

  it('should subscribe to homeassistant sensor discovery topics during initialization', async () => {
    let subscribedTopic = '';
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      subscribedTopic = topic;
      discoveryCallback = callback;
    };

    await homeAssistantDiscoveryService.initializeDiscovery();

    expect(subscribedTopic).to.equal('homeassistant/sensor/#');
    expect(discoveryCallback).to.not.equal(null);
  });

  it('should skip discovery publish for canonical retained discovery topics already on the broker', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('{"uniq_id":"Acurite-Tower-A-8623-temperature_C"}', 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config'
    ]);
  });

  it('should republish discovery after the retained canonical topic is cleared', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('{"uniq_id":"Acurite-Tower-A-8623-temperature_C"}', 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
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

  it('should publish discovery entities for dual probe Maverick payloads using canonical ids', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildMaverickEntry());

    expect(publishCalls.length).to.equal(2);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Maverick-ET73x-7761-temperature_1_C/config');
    expect(publishCalls[1].topic).to.equal('homeassistant/sensor/Maverick-ET73x-7761-temperature_2_C/config');
    expect((publishCalls[0].payload as any).stat_t).to.equal('433_direct/+/RTL_433toMQTT/Maverick-ET73x/7761');
    expect((publishCalls[0].payload as any).uniq_id).to.equal('Maverick-ET73x-7761-temperature_1_C');
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

    await Promise.all([
      homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry()),
      homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry())
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

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('temporary publish failure');
    }

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics.length).to.equal(3);
    expect(publishTopics.filter((topic) => topic.includes('temperature_C')).length).to.equal(2);
    expect(publishTopics.filter((topic) => topic.includes('humidity')).length).to.equal(1);
  });

  it('should ignore malformed or empty retained payloads without crashing', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.('homeassistant/sensor/not-a-config-topic/state', Buffer.from('oops', 'utf8'));
    discoveryCallback?.('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config', Buffer.from('{bad-json', 'utf8'));

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.not.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should not initialize or publish discovery in replay mode', async () => {
    let subscribeCallCount = 0;
    let publishCallCount = 0;
    _deps.subscribe = async () => {
      subscribeCallCount++;
    };
    _deps.publish = async () => {
      publishCallCount++;
    };

    configuration.isReplayMode = true;
    await homeAssistantDiscoveryService.initializeDiscovery();
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(subscribeCallCount).to.equal(0);
    expect(publishCallCount).to.equal(0);
  });
});
