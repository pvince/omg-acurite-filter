/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import * as mqttComms from '../mqtt/mqttComms';
import { DataEntry } from './dataEntries/dataEntry';
import configuration from './configuration';
import { homeAssistantDiscoveryService } from './homeAssistantDiscovery';

describe('homeAssistantDiscoveryService', () => {
  const originalPublish = mqttComms.publish;
  const originalReplayMode = configuration.isReplayMode;

  beforeEach(() => {
    (homeAssistantDiscoveryService as any)._resetForTesting();
    configuration.isReplayMode = false;
  });

  afterEach(() => {
    (mqttComms as any).publish = originalPublish;
    configuration.isReplayMode = originalReplayMode;
    (homeAssistantDiscoveryService as any)._resetForTesting();
  });

  it('should publish retained discovery messages once per rtl_433 entity', async () => {
    const publishCalls: Array<{ topic: string; payload: object | string; opts: object }> = [];
    (mqttComms as any).publish = async (topic: string, payload: object | string, opts: object) => {
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
    (mqttComms as any).publish = async () => {
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

  it('should not mark discovery as sent when replay mode is enabled', async () => {
    let publishCallCount = 0;
    (mqttComms as any).publish = async () => {
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
