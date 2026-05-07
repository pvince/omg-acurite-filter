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

function buildProInEntry(): DataEntry {
  return new DataEntry(
    '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-00276rm/1/12549',
    {
      model: 'Acurite-00276rm',
      subtype: 1,
      id: '12549',
      rssi: -84,
      battery_ok: 1,
      temperature_C: 17.5,
      humidity: 54,
      water: 0
    } as any
  );
}

function buildAcurite5n1TempEntry(): DataEntry {
  return new DataEntry(
    '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-5n1/A/2247',
    {
      model: 'Acurite-5n1',
      id: '2247',
      rssi: -72,
      channel: 'A',
      battery_ok: 1,
      message_type: 56,
      temperature_C: 19.7,
      humidity: 43,
      wind_avg_km_h: 8.4
    } as any
  );
}

function buildWh51Entry(): DataEntry {
  return new DataEntry(
    '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Fineoffset-WH51/0ef616',
    {
      model: 'Fineoffset-WH51',
      id: '0ef616',
      rssi: -70,
      battery_ok: 1,
      battery_mV: 1800,
      moisture: 47,
      boost: 0,
      ad_raw: 223,
      mic: 'CRC'
    } as any
  );
}

describe('homeAssistantDiscoveryService', () => {
  const originalClearTopic = _deps.clearTopic;
  const originalPublish = _deps.publish;
  const originalSubscribe = _deps.subscribe;
  const originalUnsubscribe = _deps.unsubscribe;
  const originalReplayMode = configuration.isReplayMode;
  let savedEnv: NodeJS.ProcessEnv;
  let discoveryCallback: fnMessageCallback | null = null;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env.MQTT_SRC_TOPIC = '433_direct/raw/+/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = '433_direct/+/RTL_433toMQTT';
    configuration.isReplayMode = false;
    discoveryCallback = null;
    (homeAssistantDiscoveryService as any)._resetForTesting();
    _deps.clearTopic = async () => undefined;
    _deps.unsubscribe = async () => undefined;
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
      }
    };
  });

  afterEach(() => {
    process.env = savedEnv;
    _deps.clearTopic = originalClearTopic;
    _deps.publish = originalPublish;
    _deps.subscribe = originalSubscribe;
    _deps.unsubscribe = originalUnsubscribe;
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

  it('should subscribe to the overridden discovery root when MQTT_HADISCOVERY_TOPIC is set', async () => {
    process.env.MQTT_HADISCOVERY_TOPIC = 'customhome';
    let subscribedTopic = '';
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      subscribedTopic = topic;
      discoveryCallback = callback;
    };

    await homeAssistantDiscoveryService.initializeDiscovery();

    expect(subscribedTopic).to.equal('customhome/sensor/#');
    expect(discoveryCallback).to.not.equal(null);
  });

  it('should publish canonical discovery payloads to the overridden discovery root', async () => {
    process.env.MQTT_HADISCOVERY_TOPIC = 'customhome';
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishCalls).to.have.lengthOf(2);
    expect(publishCalls[0].topic).to.equal('customhome/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishCalls[1].topic).to.equal('customhome/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should fall back to homeassistant discovery root when MQTT_HADISCOVERY_TOPIC is empty', async () => {
    process.env.MQTT_HADISCOVERY_TOPIC = '   ';
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should honor configured source and destination topic mappings for canonical discovery', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/raw/+/subTopic/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'forwarded/+/normalized/RTL_433toMQTT';

    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
    };

    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'forwarded/+/normalized/RTL_433toMQTT/Acurite-Tower/A/8623',
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
          via_device: 'receiver_1'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      'root/raw/receiver_1/subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishCalls).to.have.lengthOf(1);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
    expect(publishCalls[0].payload).to.deep.equal({
      stat_t: 'forwarded/+/normalized/RTL_433toMQTT/Acurite-Tower/A/8623',
      dev_cla: 'humidity',
      unit_of_meas: '%',
      name: 'humidity',
      uniq_id: 'Acurite-Tower-A-8623-humidity',
      val_tpl: '{{ value_json.humidity | is_defined }}',
      state_class: 'measurement',
      device: {
        identifiers: ['Acurite-Tower-A-8623'],
        connections: [['mac', 'Acurite-Tower-A-8623']],
        model: 'Acurite-Tower',
        name: 'Acurite-Tower-A-8623',
        via_device: 'receiver_1'
      }
    });
  });

  it('should clear late legacy conflicts when retained discovery topics use empty wildcard segments', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/+/subTopic/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'root/+/subTopic/RTL_433toMQTT';

    const clearedTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };

    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'root//subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
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
          via_device: ''
        }
      }), 'utf8')
    );

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: 'root//subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearedTopics).to.include('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
  });

  it('should preserve a source hash suffix whose literal value is zero', () => {
    process.env.MQTT_SRC_TOPIC = 'root/#';

    expect((homeAssistantDiscoveryService as any).extractSourceHashSuffix('root/0')).to.equal('0');
  });

  it('should omit via_device when the configured gateway wildcard segment is empty', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/+/subTopic/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'forwarded/+/normalized/RTL_433toMQTT';

    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      'root//subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishCalls).to.have.lengthOf(2);
    expect((publishCalls[0].payload as any).device.via_device).to.equal(undefined);
    expect((publishCalls[1].payload as any).device.via_device).to.equal(undefined);
  });

  it('should honor multi-wildcard source and destination mappings for canonical discovery', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/+/bridge/+/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'forwarded/+/normalized/+/RTL_433toMQTT';

    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      'root/site-a/bridge/receiver-2/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishCalls).to.have.lengthOf(2);
    expect(publishCalls[0].payload).to.deep.equal({
      stat_t: 'forwarded/+/normalized/+/RTL_433toMQTT/Acurite-Tower/A/8623',
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
        via_device: 'receiver-2'
      }
    });
  });

  it('should skip discovery publish for canonical retained discovery topics already on the broker', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config'
    ]);
  });

  it('should ignore non-retained discovery traffic during the startup retained snapshot', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };

    const initializePromise = homeAssistantDiscoveryService.initializeDiscovery();
    await new Promise((resolve) => setTimeout(resolve, 0));

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: false } as any
    );

    await initializePromise;

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should treat post-warmup retained clears as broker-state changes even when MQTT delivers retain false', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should retry report-time canonical probes after a post-warmup refresh miss clears broker state', async () => {
    const publishTopics: string[] = [];
    const probeCounts = new Map<string, number>();
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      const count = (probeCounts.get(topic) ?? 0) + 1;
      probeCounts.set(topic, count);
      if (count !== 2) {
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
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
        }), 'utf8'), { retain: true } as any);
      }
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        callback(topic, Buffer.from(JSON.stringify({
          stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
          dev_cla: 'humidity',
          unit_of_meas: '%',
          name: 'humidity',
          uniq_id: 'Acurite-Tower-A-8623-humidity',
          val_tpl: '{{ value_json.humidity | is_defined }}',
          state_class: 'measurement',
          device: {
            identifiers: ['Acurite-Tower-A-8623'],
            connections: [['mac', 'Acurite-Tower-A-8623']],
            model: 'Acurite-Tower',
            name: 'Acurite-Tower-A-8623',
            via_device: 'OMG_lilygo_rtl_433_ESP'
          }
        }), 'utf8'), { retain: true } as any);
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config')).to.equal(2);
    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config')).to.equal(2);
    expect(publishTopics).to.deep.equal([]);
  });

  it('should republish after a post-warmup refresh subscribe failure invalidates stale canonical state', async () => {
    const publishTopics: string[] = [];
    const probeCounts = new Map<string, number>();
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      const count = (probeCounts.get(topic) ?? 0) + 1;
      probeCounts.set(topic, count);
      if (
        count === 1
        && (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config'
          || topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config')
      ) {
        throw new Error('probe subscribe failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: true } as any
    );

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config')).to.equal(3);
    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config')).to.equal(3);
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should not treat post-warmup non-retained discovery publishes as retained broker state', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: false } as any
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'receiver_a'
        }
      }), 'utf8'),
      { retain: false } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should exact-probe canonical discovery topics before first publish when startup warmup missed them', async () => {
    const publishTopics: string[] = [];
    const probedTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      probedTopics.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
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
        }), 'utf8'), { retain: true } as any);
      }
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        callback(topic, Buffer.from(JSON.stringify({
          stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
          dev_cla: 'humidity',
          unit_of_meas: '%',
          name: 'humidity',
          uniq_id: 'Acurite-Tower-A-8623-humidity',
          val_tpl: '{{ value_json.humidity | is_defined }}',
          state_class: 'measurement',
          device: {
            identifiers: ['Acurite-Tower-A-8623'],
            connections: [['mac', 'Acurite-Tower-A-8623']],
            model: 'Acurite-Tower',
            name: 'Acurite-Tower-A-8623',
            via_device: 'OMG_lilygo_rtl_433_ESP'
          }
        }), 'utf8'), { retain: true } as any);
      }
    };

    await homeAssistantDiscoveryService.initializeDiscovery();
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probedTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
    expect(publishTopics).to.deep.equal([]);
  });

  it('should suppress canonical publish when an exact-topic retained replay arrives after a short delay', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        setTimeout(() => {
          callback(topic, Buffer.from(JSON.stringify({
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
          }), 'utf8'), { retain: true } as any);
        }, 30);
      }
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        setTimeout(() => {
          callback(topic, Buffer.from(JSON.stringify({
            stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
            dev_cla: 'humidity',
            unit_of_meas: '%',
            name: 'humidity',
            uniq_id: 'Acurite-Tower-A-8623-humidity',
            val_tpl: '{{ value_json.humidity | is_defined }}',
            state_class: 'measurement',
            device: {
              identifiers: ['Acurite-Tower-A-8623'],
              connections: [['mac', 'Acurite-Tower-A-8623']],
              model: 'Acurite-Tower',
              name: 'Acurite-Tower-A-8623',
              via_device: 'OMG_lilygo_rtl_433_ESP'
            }
          }), 'utf8'), { retain: true } as any);
        }, 30);
      }
    };

    await homeAssistantDiscoveryService.initializeDiscovery();
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.deep.equal([]);
  });

  it('should retry canonical exact-topic verification when the first probe misses a slower retained replay', async () => {
    const publishTopics: string[] = [];
    const probeCounts = new Map<string, number>();
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      const count = (probeCounts.get(topic) ?? 0) + 1;
      probeCounts.set(topic, count);
      if (count !== 2) {
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
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
        }), 'utf8'), { retain: true } as any);
      }
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        callback(topic, Buffer.from(JSON.stringify({
          stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
          dev_cla: 'humidity',
          unit_of_meas: '%',
          name: 'humidity',
          uniq_id: 'Acurite-Tower-A-8623-humidity',
          val_tpl: '{{ value_json.humidity | is_defined }}',
          state_class: 'measurement',
          device: {
            identifiers: ['Acurite-Tower-A-8623'],
            connections: [['mac', 'Acurite-Tower-A-8623']],
            model: 'Acurite-Tower',
            name: 'Acurite-Tower-A-8623',
            via_device: 'OMG_lilygo_rtl_433_ESP'
          }
        }), 'utf8'), { retain: true } as any);
      }
    };

    await homeAssistantDiscoveryService.initializeDiscovery();
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config')).to.equal(2);
    expect(probeCounts.get('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config')).to.equal(2);
    expect(publishTopics).to.deep.equal([]);
  });

  it('should ignore report-time exact-probe unsubscribe failures after retained discovery is observed', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.unsubscribe = async () => {
      throw new Error('unsubscribe failed');
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
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
        }), 'utf8'), { retain: true } as any);
      }
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        callback(topic, Buffer.from(JSON.stringify({
          stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
          dev_cla: 'humidity',
          unit_of_meas: '%',
          name: 'humidity',
          uniq_id: 'Acurite-Tower-A-8623-humidity',
          val_tpl: '{{ value_json.humidity | is_defined }}',
          state_class: 'measurement',
          device: {
            identifiers: ['Acurite-Tower-A-8623'],
            connections: [['mac', 'Acurite-Tower-A-8623']],
            model: 'Acurite-Tower',
            name: 'Acurite-Tower-A-8623',
            via_device: 'OMG_lilygo_rtl_433_ESP'
          }
        }), 'utf8'), { retain: true } as any);
      }
    };

    await homeAssistantDiscoveryService.initializeDiscovery();
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.deep.equal([]);
  });

  it('should allow a later exact-topic refresh to retry after probe unsubscribe fails', async () => {
    let exactSubscribeCount = 0;
    _deps.unsubscribe = async () => {
      throw new Error('unsubscribe failed');
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        exactSubscribeCount++;
        callback(topic, Buffer.from('', 'utf8'), { retain: true } as any);
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8'),
      { retain: false } as any
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(exactSubscribeCount).to.equal(2);
  });

  it('should ignore node-scoped discovery topics when deduping canonical entities', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/third-party-node/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          name: 'Acurite-Tower-A-8623'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should not republish canonical discovery when only via_device differs across receivers', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          via_device: 'receiver_a'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'receiver_a'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      '433_direct/raw/receiver_b/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishTopics).to.deep.equal([]);
  });

  it('should repair a retained canonical payload whose via_device is an empty string', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/+/subTopic/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'forwarded/+/normalized/RTL_433toMQTT';

    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'forwarded/+/normalized/RTL_433toMQTT/Acurite-Tower/A/8623',
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
          via_device: ''
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      'root//subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should repair a retained canonical payload whose via_device still points at a stale gateway when the canonical payload should omit it', async () => {
    process.env.MQTT_SRC_TOPIC = 'root/+/subTopic/RTL_433toMQTT';
    process.env.MQTT_DST_TOPIC = 'forwarded/+/normalized/RTL_433toMQTT';

    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'forwarded/+/normalized/RTL_433toMQTT/Acurite-Tower/A/8623',
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
          via_device: 'old-receiver'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(new DataEntry(
      'root//subTopic/RTL_433toMQTT/Acurite-Tower/A/8623',
      {
        model: 'Acurite-Tower',
        id: '8623',
        rssi: -81,
        channel: 'A',
        battery_ok: 1,
        temperature_C: 21.3,
        humidity: 44
      } as any
    ));

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should repair a retained canonical payload whose expected via_device is missing', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          name: 'Acurite-Tower-A-8623'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'humidity',
        unit_of_meas: '%',
        name: 'humidity',
        uniq_id: 'Acurite-Tower-A-8623-humidity',
        val_tpl: '{{ value_json.humidity | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should republish discovery after the retained canonical topic is cleared', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should republish a cleared retained entity that this process had already sent', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('', 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics.filter((topic) => topic.includes('temperature_C')).length).to.equal(2);
    expect(publishTopics.filter((topic) => topic.includes('humidity')).length).to.equal(1);
  });

  it('should clear startup-time conflicts when canonical and legacy retained topics both exist', async () => {
    const clearedTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };

    const initializePromise = homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
      }), 'utf8')
    );

    await initializePromise;

    expect(clearedTopics).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
  });

  it('should clear a stale legacy topic when the canonical retained topic arrives after warmup', async () => {
    const clearedTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };

    const initializePromise = homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    await initializePromise;

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
          name: 'Acurite-Tower-A-8623'
        }
      }), 'utf8')
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearedTopics).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
  });

  it('should not clear alternate retained discovery topics that do not match app-owned legacy signatures', async () => {
    const clearedTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };

    const initializePromise = homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/third_party_Acurite-Tower_A_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        name: 'temperature',
        uniq_id: 'third_party_Acurite-Tower_A_8623_temperature_C',
        val_tpl: '{{ value_json.temperature_C | is_defined }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'OMG_lilygo_rtl_433_ESP'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
      }), 'utf8')
    );

    await initializePromise;

    expect(clearedTopics).to.deep.equal([]);
  });

  it('should clear legacy retained discovery topics before publishing the canonical one', async () => {
    const publishTopics: string[] = [];
    const clearedTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(clearedTopics).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should probe and clear previous app topic ids once when the startup snapshot missed them', async () => {
    const clearedTopics: string[] = [];
    const publishTopics: string[] = [];
    const probedTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      probedTopics.push(topic);
      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
          state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          name: 'Acurite-Tower A 8623 Temperature',
          unique_id: 'A_Acurite-Tower_8623_temperature_C',
          value_template: '{{ value_json.temperature_C }}',
          state_class: 'measurement',
          device: {
            identifiers: ['A_Acurite-Tower_8623'],
            name: 'Acurite-Tower A 8623',
            model: 'Acurite-Tower',
            manufacturer: 'rtl_433'
          }
        }), 'utf8'));
      }

      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config') {
        callback(topic, Buffer.from(JSON.stringify({
          state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
          device_class: 'humidity',
          unit_of_measurement: '%',
          name: 'Acurite-Tower A 8623 Humidity',
          unique_id: 'A_Acurite-Tower_8623_humidity',
          value_template: '{{ value_json.humidity }}',
          state_class: 'measurement',
          device: {
            identifiers: ['A_Acurite-Tower_8623'],
            name: 'Acurite-Tower A 8623',
            model: 'Acurite-Tower',
            manufacturer: 'rtl_433'
          }
        }), 'utf8'));
      }
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probedTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
    expect(clearedTopics).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should reprobe missing historical topic ids on later reports after the prior probe timed out', async () => {
    const probedTopics: string[] = [];
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      probedTopics.push(topic);
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(probedTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should avoid overlapping exact-topic probes for the same unverified canonical topic', async () => {
    let exactSubscribeCount = 0;
    let activeExactSubscribes = 0;
    let maxConcurrentExactSubscribes = 0;
    const publishTopics: string[] = [];
    let releaseSubscribe = (): void => {
      throw new Error('releaseSubscribe was not set');
    };
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        exactSubscribeCount++;
        activeExactSubscribes++;
        maxConcurrentExactSubscribes = Math.max(maxConcurrentExactSubscribes, activeExactSubscribes);
        if (exactSubscribeCount === 1) {
          await new Promise<void>((resolve) => {
            releaseSubscribe = resolve;
          });
        }
        activeExactSubscribes--;
      }
    };

    await homeAssistantDiscoveryService.initializeDiscovery();

    const firstEnsure = homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    const secondEnsure = homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(exactSubscribeCount).to.equal(1);
    expect(publishTopics).to.deep.equal([]);

    releaseSubscribe();
    await Promise.all([firstEnsure, secondEnsure]);
    expect(exactSubscribeCount).to.equal(2);
    expect(maxConcurrentExactSubscribes).to.equal(1);
  });

  it('should clear a previously missed legacy topic when a later report triggers a fresh exact-topic probe', async () => {
    const clearedTopics: string[] = [];
    const probeCounts = new Map<string, number>();
    _deps.publish = async () => undefined;
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      const count = (probeCounts.get(topic) ?? 0) + 1;
      probeCounts.set(topic, count);
      if (count === 2 && topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config') {
        callback(
          topic,
          Buffer.from(JSON.stringify({
            state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
            device_class: 'temperature',
            unit_of_measurement: '°C',
            name: 'Acurite-Tower A 8623 Temperature',
            unique_id: 'A_Acurite-Tower_8623_temperature_C',
            value_template: '{{ value_json.temperature_C }}',
            state_class: 'measurement',
            device: {
              identifiers: ['A_Acurite-Tower_8623'],
              name: 'Acurite-Tower A 8623',
              model: 'Acurite-Tower',
              manufacturer: 'rtl_433'
            }
          }), 'utf8'),
          { retain: true } as any
        );
      }
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearedTopics).to.include('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
  });

  it('should retry an exact-topic probe after the previous subscribe attempt failed', async () => {
    const clearedTopics: string[] = [];
    const subscribeAttempts = new Map<string, number>();
    _deps.publish = async () => undefined;
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      const attempt = (subscribeAttempts.get(topic) ?? 0) + 1;
      subscribeAttempts.set(topic, attempt);
      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config' && attempt === 1) {
        throw new Error('probe subscribe failed');
      }
      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config' && attempt === 2) {
        callback(
          topic,
          Buffer.from(JSON.stringify({
            state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
            device_class: 'temperature',
            unit_of_measurement: '°C',
            name: 'Acurite-Tower A 8623 Temperature',
            unique_id: 'A_Acurite-Tower_8623_temperature_C',
            value_template: '{{ value_json.temperature_C }}',
            state_class: 'measurement',
            device: {
              identifiers: ['A_Acurite-Tower_8623'],
              name: 'Acurite-Tower A 8623',
              model: 'Acurite-Tower',
              manufacturer: 'rtl_433'
            }
          }), 'utf8'),
          { retain: true } as any
        );
      }
    };

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected probe subscribe failure');
    } catch (err) {
      expect((err as Error).message).to.equal('probe subscribe failed');
    }

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeAttempts.get('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config')).to.equal(2);
    expect(clearedTopics).to.include('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
  });

  it('should not clear a probed historical topic id when the retained payload is not app-owned', async () => {
    const clearedTopics: string[] = [];
    const publishTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearedTopics.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config') {
        callback(topic, Buffer.from(JSON.stringify({
          state_topic: '433_direct/third_party_bridge/RTL_433toMQTT/Acurite-Tower/A/8623',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          name: 'temperature',
          unique_id: 'A_Acurite-Tower_8623_temperature_C',
          value_template: '{{ value_json.temperature_C | float }}',
          state_class: 'measurement',
          device: {
            identifiers: ['third-party-acurite-tower-8623'],
            model: 'Acurite-Tower',
            name: 'Acurite Tower Third Party',
            via_device: 'third_party_bridge'
          }
        }), 'utf8'));
      }
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(clearedTopics).to.deep.equal([]);
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

  it('should publish discovery for Fineoffset-WH51 moisture payloads', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts?: object }> = [];
    _deps.publish = async (topic: string, payload: object | string, opts?: object) => {
      publishCalls.push({ topic, payload, opts });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildWh51Entry());

    expect(publishCalls).to.have.lengthOf(1);
    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Fineoffset-WH51-0ef616-moisture/config');
    expect(publishCalls[0].opts).to.deep.equal({ retain: true, qos: 1 });
    expect(publishCalls[0].payload).to.deep.equal({
      stat_t: '433_direct/+/RTL_433toMQTT/Fineoffset-WH51/0ef616',
      dev_cla: 'moisture',
      unit_of_meas: '%',
      name: 'moisture',
      uniq_id: 'Fineoffset-WH51-0ef616-moisture',
      val_tpl: '{{ value_json.moisture | is_defined }}',
      state_class: 'measurement',
      device: {
        identifiers: ['Fineoffset-WH51-0ef616'],
        connections: [['mac', 'Fineoffset-WH51-0ef616']],
        model: 'Fineoffset-WH51',
        name: 'Fineoffset-WH51-0ef616',
        via_device: 'OMG_lilygo_rtl_433_ESP'
      }
    });
  });

  it('should publish canonical subtype-based identities for Acurite ProIn payloads', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildProInEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-00276rm-1-12549-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-00276rm-1-12549-humidity/config');
  });

  it('should collapse Acurite-5n1 temperature discovery onto the canonical device identity', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
    };

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcurite5n1TempEntry());

    expect(publishCalls[0].topic).to.equal('homeassistant/sensor/Acurite-5n1-A-2247-temperature_C/config');
    expect((publishCalls[0].payload as any).stat_t).to.equal('433_direct/+/RTL_433toMQTT/Acurite-5n1/A/2247');
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

  it('should skip discovery for unknown models even when moisture is present', async () => {
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
        moisture: 55
      } as any
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(entry);

    expect(publishCallCount).to.equal(0);
  });

  it('should skip Fineoffset-WH51 discovery when moisture is not numeric', async () => {
    let publishCallCount = 0;
    _deps.publish = async () => {
      publishCallCount++;
    };

    const entry = new DataEntry(
      '433_direct/raw/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Fineoffset-WH51/0ef616',
      {
        model: 'Fineoffset-WH51',
        id: '0ef616',
        rssi: -70,
        moisture: '47'
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

  it('should restore cleared legacy discovery topics when canonical publish fails', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        throw new Error('canonical publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected canonical publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('canonical publish failed');
    }

    expect(publishCalls.map((call) => call.topic)).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
    expect(publishCalls[1].payload).to.deep.equal({
      state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
      device_class: 'temperature',
      unit_of_measurement: '°C',
      name: 'Acurite-Tower A 8623 Temperature',
      unique_id: 'A_Acurite-Tower_8623_temperature_C',
      value_template: '{{ value_json.temperature_C }}',
      state_class: 'measurement',
      device: {
        identifiers: ['A_Acurite-Tower_8623'],
        name: 'Acurite-Tower A 8623',
        model: 'Acurite-Tower',
        manufacturer: 'rtl_433'
      }
    });
  });

  it('should restore a legacy topic discovered by exact probe when the canonical replacement publish fails', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        throw new Error('canonical publish failed');
      }
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config') {
        callback(
          topic,
          Buffer.from(JSON.stringify({
            state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
            device_class: 'temperature',
            unit_of_measurement: '°C',
            name: 'Acurite-Tower A 8623 Temperature',
            unique_id: 'A_Acurite-Tower_8623_temperature_C',
            value_template: '{{ value_json.temperature_C }}',
            state_class: 'measurement',
            device: {
              identifiers: ['A_Acurite-Tower_8623'],
              name: 'Acurite-Tower A 8623',
              model: 'Acurite-Tower',
              manufacturer: 'rtl_433'
            }
          }), 'utf8'),
          { retain: true } as any
        );
      }
    };

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected canonical publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('canonical publish failed');
    }

    expect(publishTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
  });

  it('should restore legacy topics when a canonical exact probe also replays through the wildcard subscriber', async () => {
    const clearCalls: string[] = [];
    const publishTopics: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    _deps.subscribe = async (topic: string, callback: fnMessageCallback) => {
      if (topic === 'homeassistant/sensor/#') {
        discoveryCallback = callback;
        return;
      }

      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        const payload = Buffer.from(JSON.stringify({
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
            name: 'Acurite-Tower-A-8623'
          }
        }), 'utf8');
        discoveryCallback?.(topic, payload, { retain: true } as any);
        callback(topic, payload, { retain: true } as any);
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8'),
      { retain: true } as any
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.include('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config');
  });

  it('should preserve the original canonical publish error when legacy restore also fails', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        throw new Error('canonical publish failed');
      }
      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config') {
        throw new Error('restore failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected canonical publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('canonical publish failed');
    }

    expect(publishTopics).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config'
    ]);
  });

  it('should not clear a canonical publish on rollback when prior retained state was never verified', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.deep.equal([]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config'
    ]);
  });

  it('should not clear a canonical publish on rollback when prior same-topic retained payload was malformed', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from('{bad-json', 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.deep.equal([]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config'
    ]);
  });

  it('should restore a repaired canonical payload when a later metric publish fails', async () => {
    const clearCalls: string[] = [];
    const publishCalls: Array<{ topic: string; payload: object | string }> = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string, payload: object | string) => {
      publishCalls.push({ topic, payload });
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'wrong/topic',
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
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.deep.equal([]);
    expect(publishCalls.map((call) => call.topic)).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config'
    ]);
    expect(publishCalls[2].payload).to.deep.equal({
      stat_t: 'wrong/topic',
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

  it('should roll back earlier canonical metrics when a later metric publish fails for the same report', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'humidity',
        unit_of_measurement: '%',
        name: 'Acurite-Tower A 8623 Humidity',
        unique_id: 'A_Acurite-Tower_8623_humidity',
        value_template: '{{ value_json.humidity }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config'
    ]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
  });

  it('should roll back report changes when stale legacy cleanup fails before a later canonical publish', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
      if (topic === 'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config') {
        throw new Error('legacy clear failed');
      }
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'humidity',
        unit_of_measurement: '%',
        name: 'Acurite-Tower A 8623 Humidity',
        unique_id: 'A_Acurite-Tower_8623_humidity',
        value_template: '{{ value_json.humidity }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected legacy clear failure');
    } catch (err) {
      expect((err as Error).message).to.equal('legacy clear failed');
    }

    expect(clearCalls).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config'
    ]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
  });

  it('should restore legacy topics even when canonical rollback clearing fails', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config') {
        throw new Error('canonical clear failed');
      }
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'humidity',
        unit_of_measurement: '%',
        name: 'Acurite-Tower A 8623 Humidity',
        unique_id: 'A_Acurite-Tower_8623_humidity',
        value_template: '{{ value_json.humidity }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearCalls).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config'
    ]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
  });

  it('should restore legacy topics cleared for skipped canonical metrics when a later metric fails', async () => {
    const clearCalls: string[] = [];
    const publishCalls: string[] = [];
    _deps.clearTopic = async (topic: string) => {
      clearCalls.push(topic);
    };
    _deps.publish = async (topic: string) => {
      publishCalls.push(topic);
      if (topic === 'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config') {
        throw new Error('humidity publish failed');
      }
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
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
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: 'Acurite-Tower A 8623 Temperature',
        unique_id: 'A_Acurite-Tower_8623_temperature_C',
        value_template: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );
    discoveryCallback?.(
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config',
      Buffer.from(JSON.stringify({
        state_topic: '433_direct/OMG_lilygo_rtl_433_ESP/RTL_433toMQTT/Acurite-Tower/A/8623',
        device_class: 'humidity',
        unit_of_measurement: '%',
        name: 'Acurite-Tower A 8623 Humidity',
        unique_id: 'A_Acurite-Tower_8623_humidity',
        value_template: '{{ value_json.humidity }}',
        state_class: 'measurement',
        device: {
          identifiers: ['A_Acurite-Tower_8623'],
          name: 'Acurite-Tower A 8623',
          model: 'Acurite-Tower',
          manufacturer: 'rtl_433'
        }
      }), 'utf8')
    );

    try {
      await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());
      expect.fail('Expected humidity publish failure');
    } catch (err) {
      expect((err as Error).message).to.equal('humidity publish failed');
    }

    expect(clearCalls).to.deep.equal([
      'homeassistant/sensor/A_Acurite-Tower_8623_temperature_C/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
    expect(publishCalls).to.deep.equal([
      'homeassistant/sensor/Acurite-Tower-A-8623-humidity/config',
      'homeassistant/sensor/A_Acurite-Tower_8623_humidity/config'
    ]);
  });

  it('should repair non-canonical retained discovery payloads', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: 'wrong/topic',
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
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
  });

  it('should repair retained payloads whose value template drifted from the canonical form', async () => {
    const publishTopics: string[] = [];
    _deps.publish = async (topic: string) => {
      publishTopics.push(topic);
    };
    await homeAssistantDiscoveryService.initializeDiscovery();

    discoveryCallback?.(
      'homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config',
      Buffer.from(JSON.stringify({
        stat_t: '433_direct/+/RTL_433toMQTT/Acurite-Tower/A/8623',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        name: 'temperature',
        uniq_id: 'Acurite-Tower-A-8623-temperature_C',
        val_tpl: '{{ value_json.temperature_C }}',
        state_class: 'measurement',
        device: {
          identifiers: ['Acurite-Tower-A-8623'],
          connections: [['mac', 'Acurite-Tower-A-8623']],
          model: 'Acurite-Tower',
          name: 'Acurite-Tower-A-8623',
          via_device: 'OMG_lilygo_rtl_433_ESP'
        }
      }), 'utf8')
    );

    await homeAssistantDiscoveryService.ensureDiscoveryForReport(buildAcuriteTowerEntry());

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-humidity/config');
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

    expect(publishTopics).to.include('homeassistant/sensor/Acurite-Tower-A-8623-temperature_C/config');
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
