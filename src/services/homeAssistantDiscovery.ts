import { IClientPublishOptions } from 'mqtt';
import * as mqttComms from '../mqtt/mqttComms';
import { forwardTopic } from '../mqtt/mqtt.util';
import { DataEntry } from './dataEntries/dataEntry';
import configuration from './configuration';

const RTL_433_TOPIC_SEGMENT = 'RTL_433toMQTT';
const DISCOVERY_BASE_TOPIC = 'homeassistant/sensor';
const DISCOVERY_PUBLISH_OPTIONS: IClientPublishOptions = { retain: true, qos: 1 };

export const _deps = {
  publish: mqttComms.publish,
  forwardTopic
};

/**
 * Discovery metric configuration.
 */
interface IMetricDiscoveryConfig {
  /**
   * Source field used in value_template and unique id suffix.
   */
  readonly field: string;
  /**
   * Home Assistant device class.
   */
  readonly deviceClass: string;
  /**
   * Home Assistant unit_of_measurement.
   */
  readonly unitOfMeasurement: string;
  /**
   * Human readable label appended to the entity name.
   */
  readonly label: string;
}

/**
 * Discovery payload for Home Assistant MQTT integration.
 */
interface IHomeAssistantDiscoveryPayload {
  /**
   * Entity display name.
   */
  readonly name: string;
  /**
   * Stable unique entity id.
   */
  readonly unique_id: string;
  /**
   * Destination MQTT state topic.
   */
  readonly state_topic: string;
  /**
   * Jinja value template for parsing JSON payloads.
   */
  readonly value_template: string;
  /**
   * Entity class in Home Assistant.
   */
  readonly device_class: string;
  /**
   * Unit string shown in Home Assistant.
   */
  readonly unit_of_measurement: string;
  /**
   * Device metadata used to group entities under one device.
   */
  readonly device: {
    /**
     * Device identifiers list.
     */
    readonly identifiers: string[];
    /**
     * Device display name.
     */
    readonly name: string;
    /**
     * Device model value.
     */
    readonly model: string;
    /**
     * Source/manufacturer marker.
     */
    readonly manufacturer: string;
  };
}

/**
 * Generated discovery message details.
 */
interface IDiscoveryMessage {
  /**
   * Unique id for one discovery entity.
   */
  readonly uniqueId: string;
  /**
   * Topic where the discovery payload should be published.
   */
  readonly topic: string;
  /**
   * Discovery payload body.
   */
  readonly payload: IHomeAssistantDiscoveryPayload;
}

const METRIC_DISCOVERY_CONFIGS: ReadonlyArray<IMetricDiscoveryConfig> = [
  {
    field: 'temperature_C',
    deviceClass: 'temperature',
    unitOfMeasurement: '°C',
    label: 'Temperature'
  },
  {
    field: 'humidity',
    deviceClass: 'humidity',
    unitOfMeasurement: '%',
    label: 'Humidity'
  }
];

/**
 * Publishes Home Assistant auto-discovery entities for rtl_433 device reports.
 */
class HomeAssistantDiscoveryService {
  /**
   * Track which discovery entities have already been sent in this process runtime.
   */
  private readonly sentUniqueIds = new Set<string>();

  /**
   * Ensure Home Assistant discovery messages exist for this sensor report.
   * @param dataEntry - Parsed sensor report.
   */
  public async ensureDiscoveryForReport(dataEntry: DataEntry): Promise<void> {
    if (!this.isRtl433Topic(dataEntry.topic)) {
      return;
    }

    const discoveryMessages = this.buildDiscoveryMessages(dataEntry);
    for (const discoveryMessage of discoveryMessages) {
      if (this.sentUniqueIds.has(discoveryMessage.uniqueId)) {
        continue;
      }

      if (configuration.isReplayMode) {
        continue;
      }

      await _deps.publish(discoveryMessage.topic, discoveryMessage.payload, DISCOVERY_PUBLISH_OPTIONS);
      this.sentUniqueIds.add(discoveryMessage.uniqueId);
    }
  }

  /**
   * Clear module state for test isolation.
   */
  public _resetForTesting(): void {
    this.sentUniqueIds.clear();
  }

  /**
   * Checks if the topic belongs to a rtl_433 report.
   * @param topic - MQTT source topic.
   * @returns - True when the topic includes rtl_433 marker segment.
   */
  private isRtl433Topic(topic: string): boolean {
    const segments = topic.split('/');
    return segments.includes(RTL_433_TOPIC_SEGMENT);
  }

  /**
   * Build all discovery entities for one report.
   * @param dataEntry - Parsed sensor report.
   * @returns - Discovery messages to publish.
   */
  private buildDiscoveryMessages(dataEntry: DataEntry): IDiscoveryMessage[] {
    const stateTopic = _deps.forwardTopic(dataEntry.topic);
    if (stateTopic.length === 0) {
      return [];
    }

    const deviceModel = String(dataEntry.data.model);
    const deviceIdentifier = this.sanitizeIdentifier(dataEntry.get_unique_id());
    const deviceName = this.buildDeviceName(dataEntry);

    const discoveryMessages: IDiscoveryMessage[] = [];
    const valueByMetric = new Map<string, number | null>([
      ['temperature_C', dataEntry.get_temperature()],
      ['humidity', dataEntry.get_humidity()]
    ]);

    for (const metricConfig of METRIC_DISCOVERY_CONFIGS) {
      if (valueByMetric.get(metricConfig.field) === null) {
        continue;
      }

      const uniqueId = `${deviceIdentifier}_${metricConfig.field}`;
      discoveryMessages.push({
        uniqueId,
        topic: `${DISCOVERY_BASE_TOPIC}/${uniqueId}/config`,
        payload: {
          name: `${deviceName} ${metricConfig.label}`,
          unique_id: uniqueId,
          state_topic: stateTopic,
          value_template: `{{ value_json.${metricConfig.field} }}`,
          device_class: metricConfig.deviceClass,
          unit_of_measurement: metricConfig.unitOfMeasurement,
          device: {
            identifiers: [deviceIdentifier],
            name: deviceName,
            model: deviceModel,
            manufacturer: 'rtl_433'
          }
        }
      });
    }

    return discoveryMessages;
  }

  /**
   * Build a readable device name from model, optional channel, and id.
   * @param dataEntry - Parsed sensor report.
   * @returns - Device display name.
   */
  private buildDeviceName(dataEntry: DataEntry): string {
    let result = `${dataEntry.data.model} ${dataEntry.data.id}`;
    if ('channel' in dataEntry.data) {
      result = `${dataEntry.data.model} ${String(dataEntry.data.channel)} ${dataEntry.data.id}`;
    }
    return result;
  }

  /**
   * Convert an id to Home Assistant-safe object id characters.
   * @param input - Raw id.
   * @returns - Sanitized id.
   */
  private sanitizeIdentifier(input: string): string {
    let result = input.replace(/[^A-Za-z0-9_-]/g, '_');
    result = result.replace(/_+/g, '_');
    return result;
  }
}

export const homeAssistantDiscoveryService = new HomeAssistantDiscoveryService();
