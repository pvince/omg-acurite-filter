import { IClientPublishOptions, IPublishPacket } from 'mqtt';
import * as mqttComms from '../mqtt/mqttComms';
import { getSrcTopicRegex } from '../mqtt/mqtt.util';
import { KnownType } from '../mqtt/omg_devices/device';
import { DataEntry } from './dataEntries/dataEntry';
import configuration from './configuration';

const RTL_433_TOPIC_SEGMENT = 'RTL_433toMQTT';
const DISCOVERY_BASE_TOPIC = 'homeassistant/sensor';
const DISCOVERY_SUBSCRIPTION_TOPIC = `${DISCOVERY_BASE_TOPIC}/#`;
const DISCOVERY_PUBLISH_OPTIONS: IClientPublishOptions = { retain: true, qos: 1 };
const DISCOVERY_STATE_CLASS = 'measurement';
const DISCOVERY_WARMUP_SETTLE_MS = 50;
const CANONICAL_PROBE_ATTEMPTS = 2;
const UNSET_CONFIG_VALUE = '<unset>';

export const _deps = {
  publish: mqttComms.publish,
  subscribe: mqttComms.subscribe,
  unsubscribe: mqttComms.unsubscribe,
  clearTopic: mqttComms.clearTopic
};

/**
 * Discovery metric configuration.
 */
interface IMetricDiscoveryConfig {
  /**
   * Source field used in the value template and unique id suffix.
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
   * Home Assistant entity name.
   */
  readonly entityName: string;
  /**
   * Legacy entity label used by the original app-owned discovery payloads.
   */
  readonly legacyLabel: string;
}

/**
 * Home Assistant discovery device payload.
 */
interface IHomeAssistantDiscoveryDevice {
  /**
   * Canonical device identifiers.
   */
  readonly identifiers: string[];
  /**
   * OMG-compatible connections payload.
   */
  readonly connections: string[][];
  /**
   * Device model.
   */
  readonly model: string;
  /**
   * Device name.
   */
  readonly name: string;
  /**
   * Gateway that forwarded the triggering report.
   */
  readonly via_device?: string;
}

/**
 * OMG-compatible Home Assistant discovery payload.
 */
interface IHomeAssistantDiscoveryPayload {
  /**
   * Wildcard-capable state topic.
   */
  readonly stat_t: string;
  /**
   * Home Assistant device class.
   */
  readonly dev_cla: string;
  /**
   * Unit of measurement.
   */
  readonly unit_of_meas: string;
  /**
   * Entity display name.
   */
  readonly name: string;
  /**
   * Stable unique id.
   */
  readonly uniq_id: string;
  /**
   * Jinja value template.
   */
  readonly val_tpl: string;
  /**
   * Home Assistant state class.
   */
  readonly state_class: string;
  /**
   * Device metadata.
   */
  readonly device: IHomeAssistantDiscoveryDevice;
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
  /**
   * Legacy discovery topic ids previously emitted by this app for the same entity.
   */
  readonly legacyTopicUniqueIds: string[];
}

/**
 * Retained discovery topic cleared ahead of a canonical replacement publish.
 */
interface IClearedDiscoveryTopic {
  /**
   * Topic id encoded in the discovery topic path.
   */
  readonly topicUniqueId: string;
  /**
   * Retained payload that was cleared and can be restored if replacement publish fails.
   */
  readonly payload: Record<string, unknown>;
}

/**
 * Canonical discovery payload published during the current report and any retained canonical payload it replaced.
 */
interface IPublishedCanonicalDiscovery {
  /**
   * Canonical discovery message published during the current report.
   */
  readonly discoveryMessage: IDiscoveryMessage;
  /**
   * Previously retained canonical payload replaced by the publish, if any.
   */
  readonly replacedPayload: Record<string, unknown> | null;
  /**
   * Legacy discovery topics cleared before this canonical publish.
   */
  readonly clearedTopics: IClearedDiscoveryTopic[];
  /**
   * True when it is safe to clear the published canonical topic during rollback.
   */
  readonly shouldClearOnRollback: boolean;
}

/**
 * Result from rolling back canonical publishes after a later failure.
 */
interface IRollbackCanonicalDiscoveryResult {
  /**
   * Legacy topics that should be restored after canonical rollback completes.
   */
  readonly clearedTopicsToRestore: IClearedDiscoveryTopic[];
  /**
   * Rollback errors collected while attempting cleanup.
   */
  readonly errors: string[];
}

const METRIC_DISCOVERY_CONFIGS: ReadonlyArray<IMetricDiscoveryConfig> = [
  {
    field: 'temperature_C',
    deviceClass: 'temperature',
    unitOfMeasurement: '°C',
    entityName: 'temperature',
    legacyLabel: 'Temperature'
  },
  {
    field: 'humidity',
    deviceClass: 'humidity',
    unitOfMeasurement: '%',
    entityName: 'humidity',
    legacyLabel: 'Humidity'
  },
  {
    field: 'temperature_1_C',
    deviceClass: 'temperature',
    unitOfMeasurement: '°C',
    entityName: 'probe_1_temperature',
    legacyLabel: 'Probe 1 Temperature'
  },
  {
    field: 'temperature_2_C',
    deviceClass: 'temperature',
    unitOfMeasurement: '°C',
    entityName: 'probe_2_temperature',
    legacyLabel: 'Probe 2 Temperature'
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
   * Track which canonical discovery entities are already retained on the broker.
   */
  private readonly brokerOccupiedUniqueIds = new Set<string>();

  /**
   * Track retained discovery payloads keyed by canonical entity id.
   */
  private readonly brokerDiscoveryPayloads = new Map<string, Record<string, unknown>>();

  /**
   * Track the last retained payload observed on each discovery topic, even when it is not canonical.
   */
  private readonly retainedDiscoveryPayloadsByTopicUniqueId = new Map<string, Record<string, unknown>>();

  /**
   * Map retained discovery topic ids back to their canonical entity identity.
   */
  private readonly canonicalUniqueIdByTopicUniqueId = new Map<string, string>();

  /**
   * Track all retained discovery topic ids seen for one canonical entity.
   */
  private readonly brokerTopicIdsByCanonicalUniqueId = new Map<string, Set<string>>();

  /**
   * Retained discovery topic ids that match this app's legacy cleanup signatures.
   */
  private readonly autoClearTopicUniqueIds = new Set<string>();

  /**
   * Discovery topic ids whose current retained state has already been observed or probed this process.
   */
  private readonly verifiedTopicUniqueIds = new Set<string>();

  /**
   * Discovery topic ids whose retained broker payload was observed but cannot be restored safely.
   */
  private readonly unrestorableTopicUniqueIds = new Set<string>();

  /**
   * Exact discovery topics currently being probed for missed retained payloads.
   */
  private readonly activeProbeTopicUniqueIds = new Set<string>();

  /**
   * In-flight exact-topic probe promises keyed by discovery topic id.
   */
  private readonly probePromisesByTopicUniqueId = new Map<string, Promise<boolean>>();

  /**
   * Promise tracking one-time broker discovery subscription initialization.
   */
  private initializePromise: Promise<void> | null = null;

  /**
   * Promise that resolves after retained discovery delivery goes quiescent.
   */
  private warmupPromise: Promise<void> | null = null;

  /**
   * Resolver for the warm-up promise.
   */
  private warmupResolve: (() => void) | null = null;

  /**
   * Timer used to detect a quiet period after retained discovery delivery.
   */
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Indicates whether the warm-up settle timer is active.
   */
  private warmupActive = false;

  /**
   * Subscribe to retained Home Assistant discovery topics so canonical entities already on the broker are suppressed.
   * @returns - A promise that resolves when the discovery subscription is registered.
   */
  public async initializeDiscovery(): Promise<void> {
    if (configuration.isReplayMode) {
      return;
    }

    if (this.initializePromise === null) {
      this.initializePromise = this.bootstrapDiscoveryCache().catch((err) => {
        this.initializePromise = null;
        throw err;
      });
    }

    await this.initializePromise;
  }

  /**
   * Ensure Home Assistant discovery messages exist for this sensor report.
   * @param dataEntry - Parsed sensor report.
   */
  public async ensureDiscoveryForReport(dataEntry: DataEntry): Promise<void> {
    if (!this.isRtl433Topic(dataEntry.topic) || configuration.isReplayMode) {
      return;
    }

    await this.initializeDiscovery();

    const discoveryMessages = this.buildDiscoveryMessages(dataEntry);
    const publishedMessagesForReport: IPublishedCanonicalDiscovery[] = [];
    const skippedClearedTopicsForReport: IClearedDiscoveryTopic[] = [];
    for (const discoveryMessage of discoveryMessages) {
      const clearedTopicsForMetric: IClearedDiscoveryTopic[] = [];
      try {
        await this.clearStaleDiscoveryTopics(discoveryMessage, clearedTopicsForMetric);

        if (this.hasCanonicalBrokerPayload(discoveryMessage) || this.sentUniqueIds.has(discoveryMessage.uniqueId)) {
          skippedClearedTopicsForReport.push(...clearedTopicsForMetric);
          continue;
        }

        const replacedPayload = this.retainedDiscoveryPayloadsByTopicUniqueId.get(discoveryMessage.uniqueId) ?? null;
        const hadVerifiedTopicState = this.verifiedTopicUniqueIds.has(discoveryMessage.uniqueId);
        const hadUnrestorableTopicState = this.unrestorableTopicUniqueIds.has(discoveryMessage.uniqueId);
        this.sentUniqueIds.add(discoveryMessage.uniqueId);
        await _deps.publish(discoveryMessage.topic, discoveryMessage.payload, DISCOVERY_PUBLISH_OPTIONS);
        this.recordPublishedCanonicalDiscovery(discoveryMessage);
        publishedMessagesForReport.push({
          discoveryMessage,
          replacedPayload,
          clearedTopics: [...clearedTopicsForMetric],
          shouldClearOnRollback: (hadVerifiedTopicState && !hadUnrestorableTopicState) || clearedTopicsForMetric.length > 0
        });
      } catch (err) {
        this.sentUniqueIds.delete(discoveryMessage.uniqueId);
        const rollbackErrors: string[] = [];
        let clearedTopicsToRestore = [...skippedClearedTopicsForReport, ...clearedTopicsForMetric];
        const rollbackResult = await this.rollbackPublishedCanonicalDiscovery(publishedMessagesForReport);
        clearedTopicsToRestore = [...rollbackResult.clearedTopicsToRestore, ...clearedTopicsToRestore];
        if (rollbackResult.errors.length > 0) {
          rollbackErrors.push(`canonical cleanup: ${rollbackResult.errors.join('; ')}`);
        }
        try {
          await this.restoreClearedDiscoveryTopics(clearedTopicsToRestore);
        } catch (restoreErr) {
          rollbackErrors.push(`legacy restore: ${restoreErr}`);
        }
        if (rollbackErrors.length > 0) {
          configuration.log.extend('homeAssistantDiscovery')(
            `Failed to roll back discovery changes after publish error: ${rollbackErrors.join('; ')}`
          );
        }
        throw err;
      }
    }
  }

  /**
   * Clear module state for test isolation.
   */
  public _resetForTesting(): void {
    this.sentUniqueIds.clear();
    this.brokerOccupiedUniqueIds.clear();
    this.brokerDiscoveryPayloads.clear();
    this.retainedDiscoveryPayloadsByTopicUniqueId.clear();
    this.canonicalUniqueIdByTopicUniqueId.clear();
    this.brokerTopicIdsByCanonicalUniqueId.clear();
    this.autoClearTopicUniqueIds.clear();
    this.verifiedTopicUniqueIds.clear();
    this.unrestorableTopicUniqueIds.clear();
    this.activeProbeTopicUniqueIds.clear();
    this.probePromisesByTopicUniqueId.clear();
    this.initializePromise = null;
    this.clearWarmupState();
  }

  /**
   * Subscribe to discovery topics, wait for the initial retained delivery to settle, then clean up startup-time conflicts.
   */
  private async bootstrapDiscoveryCache(): Promise<void> {
    this.beginWarmup();
    await _deps.subscribe(DISCOVERY_SUBSCRIPTION_TOPIC, (topic: string, message: Buffer, packet?: IPublishPacket) => {
      if (this.warmupActive) {
        this.handleDiscoveryTopic(topic, message, packet?.retain !== false);
        return;
      }

      if (packet?.retain === false) {
        const topicUniqueId = this.extractDiscoveryUniqueId(topic);
        if (topicUniqueId !== null && !this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
          void this.refreshDiscoveryTopicState(topicUniqueId)
            .catch((err) => {
              configuration.log.extend('homeAssistantDiscovery')(
                `Failed to refresh retained discovery topic ${topicUniqueId}: ${err}`
              );
            });
        }
        return;
      }

      const topicUniqueId = this.extractDiscoveryUniqueId(topic);
      this.handleDiscoveryTopic(topic, message, true, topicUniqueId === null || !this.activeProbeTopicUniqueIds.has(topicUniqueId));
    });
    this.startWarmupSettleWindow();
    if (this.warmupPromise !== null) {
      await this.warmupPromise;
    }
    await this.clearStartupConflictingTopics();
  }

  /**
   * Start a quiescence window that resolves after retained delivery has been quiet for a short period.
   */
  private beginWarmup(): void {
    if (this.warmupPromise !== null) {
      return;
    }

    this.warmupPromise = new Promise<void>((resolve) => {
      this.warmupResolve = resolve;
    });
  }

  /**
   * Start the warm-up settle window after the subscription is active.
   */
  private startWarmupSettleWindow(): void {
    this.warmupActive = true;
    this.touchWarmup();
  }

  /**
   * Extend the warm-up settle timer after observing discovery traffic.
   */
  private touchWarmup(): void {
    if (!this.warmupActive || this.warmupPromise === null || this.warmupResolve === null) {
      return;
    }

    if (this.warmupTimer !== null) {
      clearTimeout(this.warmupTimer);
    }

    this.warmupTimer = setTimeout(() => {
      const resolve = this.warmupResolve;
      this.clearWarmupState();
      resolve?.();
    }, DISCOVERY_WARMUP_SETTLE_MS);
  }

  /**
   * Reset all warm-up state.
   */
  private clearWarmupState(): void {
    if (this.warmupTimer !== null) {
      clearTimeout(this.warmupTimer);
    }
    this.warmupPromise = null;
    this.warmupResolve = null;
    this.warmupTimer = null;
    this.warmupActive = false;
  }

  /**
   * Update broker cache state from a retained discovery topic notification.
   * @param topic - Discovery config topic.
   * @param message - Retained discovery payload.
   * @param isRetained - True when the MQTT packet was retained.
   * @param scheduleConflictCleanup - True when stale legacy conflicts should be auto-cleared.
   */
  private handleDiscoveryTopic(
    topic: string,
    message: Buffer,
    isRetained: boolean = true,
    scheduleConflictCleanup: boolean = true
  ): void {
    if (!isRetained) {
      return;
    }

    const topicUniqueId = this.extractDiscoveryUniqueId(topic);
    if (topicUniqueId === null) {
      return;
    }

    this.verifiedTopicUniqueIds.add(topicUniqueId);

    if (message.length === 0) {
      this.unrestorableTopicUniqueIds.delete(topicUniqueId);
      if (this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
        this.stopProbeDiscoveryTopicSafely(topicUniqueId);
      }
      this.removeBrokerTopicState(topicUniqueId);
      this.touchWarmup();
      return;
    }

    const payload = this.parseDiscoveryPayload(message);
    if (payload === null || !this.isDiscoveryPayloadForUniqueId(topicUniqueId, payload)) {
      this.unrestorableTopicUniqueIds.add(topicUniqueId);
      if (this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
        this.stopProbeDiscoveryTopicSafely(topicUniqueId);
      }
      this.removeBrokerTopicState(topicUniqueId);
      this.touchWarmup();
      return;
    }

    this.retainedDiscoveryPayloadsByTopicUniqueId.set(topicUniqueId, payload);

    const canonicalUniqueId = this.deriveCanonicalUniqueId(topicUniqueId, payload);
    this.unrestorableTopicUniqueIds.delete(topicUniqueId);
    if (canonicalUniqueId === null) {
      if (this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
        this.stopProbeDiscoveryTopicSafely(topicUniqueId);
      }
      this.removeCanonicalBrokerTopicState(topicUniqueId);
      this.touchWarmup();
      return;
    }

    this.removeCanonicalBrokerTopicState(topicUniqueId);
    this.brokerOccupiedUniqueIds.add(topicUniqueId);
    this.brokerDiscoveryPayloads.set(topicUniqueId, payload);
    this.canonicalUniqueIdByTopicUniqueId.set(topicUniqueId, canonicalUniqueId);
    if (!this.brokerTopicIdsByCanonicalUniqueId.has(canonicalUniqueId)) {
      this.brokerTopicIdsByCanonicalUniqueId.set(canonicalUniqueId, new Set<string>());
    }
    this.brokerTopicIdsByCanonicalUniqueId.get(canonicalUniqueId)?.add(topicUniqueId);
    if (this.isAppOwnedLegacyTopic(topicUniqueId, canonicalUniqueId, payload)) {
      this.autoClearTopicUniqueIds.add(topicUniqueId);
    }
    if (scheduleConflictCleanup && this.brokerTopicIdsByCanonicalUniqueId.get(canonicalUniqueId)?.has(canonicalUniqueId) === true) {
      void this.clearStartupConflictingTopicsForCanonical(canonicalUniqueId, true)
        .catch((err) => {
          configuration.log.extend('homeAssistantDiscovery')(
            `Failed to clear conflicting discovery topics for ${canonicalUniqueId}: ${err}`
          );
        });
    }
    if (this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
      this.stopProbeDiscoveryTopicSafely(topicUniqueId);
    }
    this.touchWarmup();
  }

  /**
   * Record the canonical retained discovery payload that this process has just published.
   * @param discoveryMessage - Canonical discovery message published by this process.
   */
  private recordPublishedCanonicalDiscovery(discoveryMessage: IDiscoveryMessage): void {
    this.removeBrokerTopicState(discoveryMessage.uniqueId);
    this.brokerOccupiedUniqueIds.add(discoveryMessage.uniqueId);
    this.brokerDiscoveryPayloads.set(discoveryMessage.uniqueId, discoveryMessage.payload as unknown as Record<string, unknown>);
    this.retainedDiscoveryPayloadsByTopicUniqueId.set(
      discoveryMessage.uniqueId,
      discoveryMessage.payload as unknown as Record<string, unknown>
    );
    this.canonicalUniqueIdByTopicUniqueId.set(discoveryMessage.uniqueId, discoveryMessage.uniqueId);
    this.verifiedTopicUniqueIds.add(discoveryMessage.uniqueId);
    this.unrestorableTopicUniqueIds.delete(discoveryMessage.uniqueId);
    if (!this.brokerTopicIdsByCanonicalUniqueId.has(discoveryMessage.uniqueId)) {
      this.brokerTopicIdsByCanonicalUniqueId.set(discoveryMessage.uniqueId, new Set<string>());
    }
    this.brokerTopicIdsByCanonicalUniqueId.get(discoveryMessage.uniqueId)?.add(discoveryMessage.uniqueId);
  }

  /**
   * Remove canonical cache state for one retained discovery topic while preserving the raw retained payload.
   * @param topicUniqueId - Entity id encoded in the discovery topic path.
   */
  private removeCanonicalBrokerTopicState(topicUniqueId: string): void {
    this.brokerOccupiedUniqueIds.delete(topicUniqueId);
    this.brokerDiscoveryPayloads.delete(topicUniqueId);
    this.sentUniqueIds.delete(topicUniqueId);
    this.autoClearTopicUniqueIds.delete(topicUniqueId);

    const canonicalUniqueId = this.canonicalUniqueIdByTopicUniqueId.get(topicUniqueId);
    if (canonicalUniqueId !== undefined) {
      const topicIds = this.brokerTopicIdsByCanonicalUniqueId.get(canonicalUniqueId);
      topicIds?.delete(topicUniqueId);
      if (topicIds?.size === 0) {
        this.brokerTopicIdsByCanonicalUniqueId.delete(canonicalUniqueId);
      }
      this.sentUniqueIds.delete(canonicalUniqueId);
    }

    this.canonicalUniqueIdByTopicUniqueId.delete(topicUniqueId);
  }

  /**
   * Remove all local cache state for one retained discovery topic.
   * @param topicUniqueId - Entity id encoded in the discovery topic path.
   */
  private removeBrokerTopicState(topicUniqueId: string): void {
    this.removeCanonicalBrokerTopicState(topicUniqueId);
    this.retainedDiscoveryPayloadsByTopicUniqueId.delete(topicUniqueId);
  }

  /**
   * Clear stale retained discovery topics that point at the same canonical entity.
   * @param discoveryMessage - Canonical discovery message we are about to publish.
   * @param clearedTopics - Report-level accumulator of legacy topics that have been cleared.
   */
  private async clearStaleDiscoveryTopics(
    discoveryMessage: IDiscoveryMessage,
    clearedTopics: IClearedDiscoveryTopic[]
  ): Promise<void> {
    await this.ensureCanonicalTopicState(discoveryMessage.uniqueId);

    const pendingCanonicalProbe = this.probePromisesByTopicUniqueId.get(discoveryMessage.uniqueId);
    if (pendingCanonicalProbe !== undefined) {
      await pendingCanonicalProbe;
    }

    const topicIds = new Set<string>([
      ...(this.brokerTopicIdsByCanonicalUniqueId.get(discoveryMessage.uniqueId) ?? []),
      ...discoveryMessage.legacyTopicUniqueIds
    ]);
    for (const topicUniqueId of topicIds) {
      if (topicUniqueId === discoveryMessage.uniqueId) {
        continue;
      }

      const isDeterministicLegacyTopic = discoveryMessage.legacyTopicUniqueIds.includes(topicUniqueId);
      if (!this.autoClearTopicUniqueIds.has(topicUniqueId) && isDeterministicLegacyTopic && !this.verifiedTopicUniqueIds.has(topicUniqueId)) {
        await this.ensureProbeDiscoveryTopic(topicUniqueId);
      } else {
        const pendingProbe = this.probePromisesByTopicUniqueId.get(topicUniqueId);
        if (pendingProbe !== undefined) {
          await pendingProbe;
        }
      }

      if (!this.autoClearTopicUniqueIds.has(topicUniqueId)) {
        continue;
      }

      const retainedPayload = this.brokerDiscoveryPayloads.get(topicUniqueId);
      if (retainedPayload !== undefined) {
        clearedTopics.push({ topicUniqueId, payload: retainedPayload });
      }

      await _deps.clearTopic(`${DISCOVERY_BASE_TOPIC}/${topicUniqueId}/config`);
      this.removeBrokerTopicState(topicUniqueId);
    }
  }

  /**
   * Force the broker to replay the retained config for one discovery topic so ownership can be verified.
   * @param topicUniqueId - Discovery topic id to probe.
   */
  private async probeDiscoveryTopic(topicUniqueId: string): Promise<boolean> {
    const topic = `${DISCOVERY_BASE_TOPIC}/${topicUniqueId}/config`;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let resolveProbe: (() => void) | null = null;
    let observedTopic = false;

    this.activeProbeTopicUniqueIds.add(topicUniqueId);
    try {
      await _deps.subscribe(topic, (receivedTopic: string, message: Buffer, packet?: IPublishPacket) => {
        if (packet?.retain === false) {
          return;
        }

        observedTopic = true;
        this.handleDiscoveryTopic(receivedTopic, message, true, false);
        if (settleTimer !== null) {
          clearTimeout(settleTimer);
        }
        settleTimer = setTimeout(() => {
          settleTimer = null;
          resolveProbe?.();
        }, DISCOVERY_WARMUP_SETTLE_MS);
      });
    } catch (err) {
      this.activeProbeTopicUniqueIds.delete(topicUniqueId);
      throw err;
    }

    try {
      await new Promise<void>((resolve) => {
        resolveProbe = resolve;
        settleTimer = setTimeout(() => {
          settleTimer = null;
          resolve();
        }, DISCOVERY_WARMUP_SETTLE_MS);
      });
    } finally {
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
      }
      if (this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
        await this.stopProbeDiscoveryTopic(topicUniqueId)
          .catch((err) => {
            configuration.log.extend('homeAssistantDiscovery')(
              `Failed to stop probing discovery topic ${topicUniqueId}: ${err}`
            );
          });
      }
    }

    return observedTopic;
  }

  /**
   * Re-read one discovery topic from the broker after live retain-false traffic so cache state stays tied to retained data.
   * @param topicUniqueId - Discovery topic id to refresh.
   */
  private async refreshDiscoveryTopicState(topicUniqueId: string): Promise<void> {
    try {
      const observedTopic = await this.ensureProbeDiscoveryTopic(topicUniqueId);
      if (observedTopic) {
        return;
      }

      this.verifiedTopicUniqueIds.delete(topicUniqueId);
      this.unrestorableTopicUniqueIds.delete(topicUniqueId);
      this.removeBrokerTopicState(topicUniqueId);
    } catch (err) {
      this.verifiedTopicUniqueIds.delete(topicUniqueId);
      this.removeBrokerTopicState(topicUniqueId);
      throw err;
    }
  }

  /**
   * Reuse any in-flight exact-topic probe for the same discovery topic so concurrent callers share one broker read.
   * @param topicUniqueId - Discovery topic id to probe.
   * @returns - True when retained state was observed.
   */
  private async ensureProbeDiscoveryTopic(topicUniqueId: string): Promise<boolean> {
    const existingProbe = this.probePromisesByTopicUniqueId.get(topicUniqueId);
    if (existingProbe !== undefined) {
      return await existingProbe;
    }

    let probePromise: Promise<boolean>;
    probePromise = this.probeDiscoveryTopic(topicUniqueId)
      .finally(() => {
        if (this.probePromisesByTopicUniqueId.get(topicUniqueId) === probePromise) {
          this.probePromisesByTopicUniqueId.delete(topicUniqueId);
        }
      });
    this.probePromisesByTopicUniqueId.set(topicUniqueId, probePromise);
    return await probePromise;
  }

  /**
   * Probe a canonical discovery topic up to a small bounded number of times before treating it as missing.
   * @param topicUniqueId - Canonical discovery topic id.
   */
  private async ensureCanonicalTopicState(topicUniqueId: string): Promise<void> {
    for (let attempt = 0; attempt < CANONICAL_PROBE_ATTEMPTS && !this.verifiedTopicUniqueIds.has(topicUniqueId); attempt++) {
      await this.ensureProbeDiscoveryTopic(topicUniqueId);
    }
  }

  /**
   * Stop probing one exact discovery topic once retained state has been observed.
   * @param topicUniqueId - Discovery topic id.
   */
  private async stopProbeDiscoveryTopic(topicUniqueId: string): Promise<void> {
    if (!this.activeProbeTopicUniqueIds.has(topicUniqueId)) {
      return;
    }

    try {
      await _deps.unsubscribe(`${DISCOVERY_BASE_TOPIC}/${topicUniqueId}/config`);
    } finally {
      this.activeProbeTopicUniqueIds.delete(topicUniqueId);
    }
  }

  /**
   * Stop probing one exact discovery topic and log any unsubscribe failure without creating an unhandled rejection.
   * @param topicUniqueId - Discovery topic id.
   */
  private stopProbeDiscoveryTopicSafely(topicUniqueId: string): void {
    void this.stopProbeDiscoveryTopic(topicUniqueId)
      .catch((err) => {
        configuration.log.extend('homeAssistantDiscovery')(
          `Failed to stop probing discovery topic ${topicUniqueId}: ${err}`
        );
      });
  }

  /**
   * Restore previously cleared retained discovery topics after a canonical replacement publish fails.
   * @param clearedTopics - Cleared legacy topics to restore.
   */
  private async restoreClearedDiscoveryTopics(clearedTopics: IClearedDiscoveryTopic[]): Promise<void> {
    const errors: string[] = [];
    for (const clearedTopic of clearedTopics) {
      const topic = `${DISCOVERY_BASE_TOPIC}/${clearedTopic.topicUniqueId}/config`;
      try {
        await _deps.publish(topic, clearedTopic.payload, DISCOVERY_PUBLISH_OPTIONS);
        this.handleDiscoveryTopic(topic, Buffer.from(JSON.stringify(clearedTopic.payload), 'utf8'), true, false);
      } catch (err) {
        errors.push(`${topic}: ${err}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
  }

  /**
   * Remove canonical discovery topics published earlier in the current report after a later publish fails.
   * @param publishedMessages - Canonical discovery messages published before the failure.
   */
  private async rollbackPublishedCanonicalDiscovery(
    publishedMessages: IPublishedCanonicalDiscovery[]
  ): Promise<IRollbackCanonicalDiscoveryResult> {
    const errors: string[] = [];
    const clearedTopicsToRestore: IClearedDiscoveryTopic[] = [];
    for (const publishedMessage of [...publishedMessages].reverse()) {
      try {
        if (publishedMessage.replacedPayload !== null) {
          await _deps.publish(
            publishedMessage.discoveryMessage.topic,
            publishedMessage.replacedPayload,
            DISCOVERY_PUBLISH_OPTIONS
          );
          this.handleDiscoveryTopic(
            publishedMessage.discoveryMessage.topic,
            Buffer.from(JSON.stringify(publishedMessage.replacedPayload), 'utf8'),
            true,
            false
          );
          clearedTopicsToRestore.push(...publishedMessage.clearedTopics);
          continue;
        }

        if (!publishedMessage.shouldClearOnRollback) {
          continue;
        }

        await _deps.clearTopic(publishedMessage.discoveryMessage.topic);
        this.removeBrokerTopicState(publishedMessage.discoveryMessage.uniqueId);
        clearedTopicsToRestore.push(...publishedMessage.clearedTopics);
      } catch (err) {
        clearedTopicsToRestore.push(...publishedMessage.clearedTopics);
        errors.push(`${publishedMessage.discoveryMessage.topic}: ${err}`);
      }
    }

    return {
      clearedTopicsToRestore,
      errors
    };
  }

  /**
   * Clear stale retained discovery topics that conflict with an already-retained canonical topic during startup.
   */
  private async clearStartupConflictingTopics(): Promise<void> {
    for (const [canonicalUniqueId, topicIds] of this.brokerTopicIdsByCanonicalUniqueId.entries()) {
      await this.clearStartupConflictingTopicsForCanonical(canonicalUniqueId, topicIds.has(canonicalUniqueId));
    }
  }

  /**
   * Clear startup or late-arriving retained conflicts for one canonical entity.
   * @param canonicalUniqueId - Canonical entity id.
   * @param hasCanonicalTopic - True when the canonical retained topic already exists on the broker.
   */
  private async clearStartupConflictingTopicsForCanonical(canonicalUniqueId: string, hasCanonicalTopic: boolean): Promise<void> {
    if (!hasCanonicalTopic) {
      return;
    }

    const topicIds = [...(this.brokerTopicIdsByCanonicalUniqueId.get(canonicalUniqueId) ?? [])];
    for (const topicUniqueId of topicIds) {
      if (topicUniqueId === canonicalUniqueId || !this.autoClearTopicUniqueIds.has(topicUniqueId)) {
        continue;
      }

      await _deps.clearTopic(`${DISCOVERY_BASE_TOPIC}/${topicUniqueId}/config`);
      this.removeBrokerTopicState(topicUniqueId);
    }
  }

  /**
   * Check whether the broker already holds a canonical retained config for this entity.
   * @param discoveryMessage - Canonical discovery message we are about to publish.
   * @returns - True when the broker cache already matches the canonical payload.
   */
  private hasCanonicalBrokerPayload(discoveryMessage: IDiscoveryMessage): boolean {
    if (!this.brokerOccupiedUniqueIds.has(discoveryMessage.uniqueId)) {
      return false;
    }

    const retainedPayload = this.brokerDiscoveryPayloads.get(discoveryMessage.uniqueId);
    if (retainedPayload === undefined) {
      return false;
    }

    const normalizedPayload = this.normalizeDiscoveryPayload(retainedPayload);
    const normalizedDiscoveryPayload = this.normalizeDiscoveryPayload(discoveryMessage.payload as unknown as Record<string, unknown>);
    if (normalizedPayload === null || normalizedDiscoveryPayload === null) {
      return false;
    }

    const retainedViaDevice = this.readRetainedDeviceViaDevice(retainedPayload);
    const expectedViaDevice = this.readRetainedDeviceViaDevice(discoveryMessage.payload as unknown as Record<string, unknown>);
    if (expectedViaDevice === null && retainedViaDevice !== null) {
      return false;
    }
    if (expectedViaDevice !== null && retainedViaDevice === null) {
      return false;
    }

    return JSON.stringify(normalizedPayload) === JSON.stringify(normalizedDiscoveryPayload);
  }

  /**
   * Read the optional via_device string from a retained discovery payload.
   * @param payload - Parsed retained payload.
   * @returns - via_device when present, else null.
   */
  private readRetainedDeviceViaDevice(payload: Record<string, unknown>): string | null {
    if (payload.device === null || typeof payload.device !== 'object' || Array.isArray(payload.device)) {
      return null;
    }

    const device = payload.device as Record<string, unknown>;
    return typeof device.via_device === 'string' ? device.via_device : null;
  }

  /**
   * Extract the canonical entity id from a Home Assistant discovery topic.
   * @param topic - Discovery topic.
   * @returns - The entity id encoded in the topic, or null when the topic is not a config topic.
   */
  private extractDiscoveryUniqueId(topic: string): string | null {
    const segments = topic.split('/');
    if (segments.length !== 4 || segments[0] !== 'homeassistant' || segments[1] !== 'sensor' || segments[segments.length - 1] !== 'config') {
      return null;
    }

    const result = segments[segments.length - 2];
    return result.length > 0 ? result : null;
  }

  /**
   * Parse a retained discovery payload into an object.
   * @param message - MQTT payload buffer.
   * @returns - Parsed object or null when the payload cannot be trusted.
   */
  private parseDiscoveryPayload(message: Buffer): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(message.toString('utf8')) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Confirm the retained payload belongs to the discovery topic that delivered it.
   * @param uniqueId - Entity id extracted from the topic.
   * @param payload - Parsed retained payload.
   * @returns - True when the payload unique id matches the topic unique id.
   */
  private isDiscoveryPayloadForUniqueId(uniqueId: string, payload: Record<string, unknown>): boolean {
    const payloadUniqueId = this.readDiscoveryString(payload, 'uniq_id') ?? this.readDiscoveryString(payload, 'unique_id');
    return payloadUniqueId === uniqueId;
  }

  /**
   * Derive the canonical entity id represented by a retained discovery payload.
   * @param topicUniqueId - Entity id encoded in the discovery topic path.
   * @param payload - Parsed retained payload.
   * @returns - Canonical entity id or null when the payload cannot be normalized.
   */
  private deriveCanonicalUniqueId(topicUniqueId: string, payload: Record<string, unknown>): string | null {
    const stateTopic = this.readDiscoveryString(payload, 'stat_t') ?? this.readDiscoveryString(payload, 'state_topic');
    if (stateTopic === null) {
      return null;
    }

    const metricField = this.extractMetricField(payload);
    if (metricField === null) {
      return null;
    }

    const suffixSegments = this.extractForwardedSuffixSegments(stateTopic);
    if (suffixSegments.length < 2) {
      return null;
    }

    const deviceKey = suffixSegments.join('-');
    if (deviceKey.length === 0) {
      return null;
    }

    return `${deviceKey}-${metricField}`;
  }

  /**
   * Determine whether a retained discovery topic matches the legacy format emitted by previous versions of this app.
   * @param topicUniqueId - Entity id encoded in the retained discovery topic.
   * @param canonicalUniqueId - Canonical entity id derived from the retained payload.
   * @param payload - Parsed retained payload.
   * @returns - True when the topic is safe for automatic cleanup.
   */
  private isAppOwnedLegacyTopic(topicUniqueId: string, canonicalUniqueId: string, payload: Record<string, unknown>): boolean {
    if (topicUniqueId === canonicalUniqueId) {
      return false;
    }

    const metricField = this.extractMetricField(payload);
    const legacyUniqueId = this.readDiscoveryString(payload, 'unique_id');
    const legacyValueTemplate = this.readDiscoveryString(payload, 'value_template');
    const entityName = this.readDiscoveryString(payload, 'name');
    const device = payload.device;
    const deviceRecord = device !== null && typeof device === 'object' && !Array.isArray(device)
      ? device as Record<string, unknown>
      : null;
    const identifiers = deviceRecord === null ? null : this.readStringArray(deviceRecord.identifiers);
    const deviceName = deviceRecord === null ? null : this.readDiscoveryString(deviceRecord, 'name');
    const deviceModel = deviceRecord === null ? null : this.readDiscoveryString(deviceRecord, 'model');
    const manufacturer = deviceRecord === null ? null : this.readDiscoveryString(deviceRecord, 'manufacturer');
    const metricConfig = metricField === null ? undefined : METRIC_DISCOVERY_CONFIGS.find((config) => config.field === metricField);

    if (metricField === null || legacyUniqueId === null || legacyValueTemplate === null || entityName === null || deviceRecord === null ||
      identifiers === null || identifiers.length !== 1 || deviceName === null || deviceModel === null || manufacturer === null ||
      metricConfig === undefined) {
      return false;
    }

    return ('state_topic' in payload || 'unique_id' in payload || 'value_template' in payload) &&
      !('stat_t' in payload) &&
      !('uniq_id' in payload) &&
      topicUniqueId.includes('_') &&
      legacyUniqueId === topicUniqueId &&
      legacyValueTemplate === `{{ value_json.${metricField} }}` &&
      entityName === `${deviceName} ${metricConfig.legacyLabel}` &&
      `${identifiers[0]}_${metricField}` === topicUniqueId &&
      manufacturer === 'rtl_433' &&
      !('connections' in deviceRecord) &&
      !('via_device' in deviceRecord);
  }

  /**
   * Normalize a retained discovery payload into the canonical OMG-compatible shape.
   * @param payload - Parsed retained payload.
   * @returns - Canonical payload or null when required fields are missing.
   */
  private normalizeDiscoveryPayload(payload: Record<string, unknown>): IHomeAssistantDiscoveryPayload | null {
    const stat_t = this.readDiscoveryString(payload, 'stat_t') ?? this.readDiscoveryString(payload, 'state_topic');
    const dev_cla = this.readDiscoveryString(payload, 'dev_cla') ?? this.readDiscoveryString(payload, 'device_class');
    const unit_of_meas = this.readDiscoveryString(payload, 'unit_of_meas') ?? this.readDiscoveryString(payload, 'unit_of_measurement');
    const name = this.readDiscoveryString(payload, 'name');
    const uniq_id = this.readDiscoveryString(payload, 'uniq_id') ?? this.readDiscoveryString(payload, 'unique_id');
    const val_tpl = this.readDiscoveryString(payload, 'val_tpl') ?? this.readDiscoveryString(payload, 'value_template');
    const state_class = this.readDiscoveryString(payload, 'state_class');
    const device = this.normalizeDiscoveryDevice(payload.device);

    if (stat_t === null || dev_cla === null || unit_of_meas === null || name === null || uniq_id === null || val_tpl === null ||
      state_class === null || device === null) {
      return null;
    }

    return {
      stat_t,
      dev_cla,
      unit_of_meas,
      name,
      uniq_id,
      val_tpl,
      state_class,
      device
    };
  }

  /**
   * Normalize retained device metadata into the canonical comparison shape.
   * @param deviceValue - Raw device metadata.
   * @returns - Normalized device metadata or null.
   */
  private normalizeDiscoveryDevice(deviceValue: unknown): IHomeAssistantDiscoveryDevice | null {
    if (deviceValue === null || typeof deviceValue !== 'object' || Array.isArray(deviceValue)) {
      return null;
    }

    const device = deviceValue as Record<string, unknown>;
    const identifiers = this.readStringArray(device.identifiers);
    const connections = this.readStringMatrix(device.connections);
    const model = typeof device.model === 'string' ? device.model : null;
    const name = typeof device.name === 'string' ? device.name : null;

    if (identifiers === null || connections === null || model === null || name === null) {
      return null;
    }

    const via_device = typeof device.via_device === 'string' ? device.via_device : undefined;

    if (via_device === '') {
      return {
        identifiers,
        connections,
        model,
        name,
        via_device
      };
    }

    return {
      identifiers,
      connections,
      model,
      name
    };
  }

  /**
   * Extract the metric field referenced by a retained value template.
   * @param payload - Parsed retained payload.
   * @returns - Metric field or null.
   */
  private extractMetricField(payload: Record<string, unknown>): string | null {
    const valueTemplate = this.readDiscoveryString(payload, 'val_tpl') ?? this.readDiscoveryString(payload, 'value_template');
    if (valueTemplate === null) {
      return null;
    }

    const match = /value_json\.([A-Za-z0-9_]+)/.exec(valueTemplate);
    return match?.[1] ?? null;
  }

  /**
   * Extract normalized forwarded topic suffix segments from a retained state topic.
   * @param topic - Retained state topic.
   * @returns - Normalized suffix segments carried by the destination topic '#'.
   */
  private extractForwardedSuffixSegments(topic: string): string[] {
    const suffix = this.extractDestinationHashSuffix(topic);
    if (suffix.length === 0) {
      return [];
    }
    return suffix.split('/').map((segment) => this.normalizeIdentitySegment(segment));
  }

  /**
   * Read one string field from a retained discovery payload.
   * @param payload - Parsed retained payload.
   * @param fieldName - Field to read.
   * @returns - String field value or null.
   */
  private readDiscoveryString(payload: Record<string, unknown>, fieldName: string): string | null {
    const value = payload[fieldName];
    return typeof value === 'string' ? value : null;
  }

  /**
   * Read an array of strings from a retained payload value.
   * @param value - Raw value.
   * @returns - Array of strings or null.
   */
  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      return null;
    }
    return [...value] as string[];
  }

  /**
   * Read a matrix of strings from a retained payload value.
   * @param value - Raw value.
   * @returns - Matrix of strings or null.
   */
  private readStringMatrix(value: unknown): string[][] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const result: string[][] = [];
    for (const row of value) {
      const stringRow = this.readStringArray(row);
      if (stringRow === null) {
        return null;
      }
      result.push(stringRow);
    }

    return result;
  }

  /**
   * Checks if the topic belongs to a rtl_433 report.
   * @param topic - MQTT source topic.
   * @returns - True when the topic includes rtl_433 marker segment.
   */
  private isRtl433Topic(topic: string): boolean {
    return topic.split('/').includes(RTL_433_TOPIC_SEGMENT);
  }

  /**
   * Build all discovery entities for one report.
   * @param dataEntry - Parsed sensor report.
   * @returns - Discovery messages to publish.
   */
  private buildDiscoveryMessages(dataEntry: DataEntry): IDiscoveryMessage[] {
    const canonicalStateTopic = this.buildCanonicalStateTopic(dataEntry);
    if (canonicalStateTopic.length === 0) {
      return [];
    }

    const gatewayId = this.extractGatewayId(dataEntry.topic);
    const deviceKey = this.buildCanonicalDeviceKey(dataEntry);
    if (deviceKey.length === 0) {
      return [];
    }

    const discoveryMessages: IDiscoveryMessage[] = [];
    for (const metricConfig of METRIC_DISCOVERY_CONFIGS) {
      if (!this.hasSupportedMetric(dataEntry, metricConfig.field)) {
        continue;
      }

      const uniqueId = `${deviceKey}-${metricConfig.field}`;
      discoveryMessages.push({
        uniqueId,
        topic: `${DISCOVERY_BASE_TOPIC}/${uniqueId}/config`,
        payload: {
          stat_t: canonicalStateTopic,
          dev_cla: metricConfig.deviceClass,
          unit_of_meas: metricConfig.unitOfMeasurement,
          name: metricConfig.entityName,
          uniq_id: uniqueId,
          val_tpl: `{{ value_json.${metricConfig.field} | is_defined }}`,
          state_class: DISCOVERY_STATE_CLASS,
          device: this.buildCanonicalDevicePayload(dataEntry, deviceKey, gatewayId)
        },
        legacyTopicUniqueIds: this.buildLegacyTopicUniqueIds(dataEntry, metricConfig.field, uniqueId)
      });
    }

    return discoveryMessages;
  }

  /**
   * Build the canonical Home Assistant device metadata payload.
   * @param dataEntry - Parsed sensor report.
   * @param deviceKey - Canonical device key.
   * @param gatewayId - Gateway identifier for the triggering report.
   * @returns - Canonical device metadata.
   */
  private buildCanonicalDevicePayload(dataEntry: DataEntry, deviceKey: string, gatewayId: string | null): IHomeAssistantDiscoveryDevice {
    const result: IHomeAssistantDiscoveryDevice = {
      identifiers: [deviceKey],
      connections: [['mac', deviceKey]],
      model: String(dataEntry.data.model),
      name: deviceKey
    };

    if (gatewayId !== null) {
      return {
        ...result,
        via_device: gatewayId
      };
    }

    return result;
  }

  /**
   * Build the canonical device key used by OMG discovery for overlapping rtl_433 models.
   * @param dataEntry - Parsed sensor report.
   * @returns - Canonical OMG-compatible device key.
   */
  private buildCanonicalDeviceKey(dataEntry: DataEntry): string {
    const payload = dataEntry.data as unknown as Record<string, unknown>;
    const model = this.normalizeIdentitySegment(String(dataEntry.data.model));
    const id = this.readIdentitySegment(payload, 'id');
    if (model.length === 0 || id.length === 0) {
      return '';
    }

    const segments = [model];
    const subtype = this.readIdentitySegment(payload, 'subtype');
    const channel = this.readIdentitySegment(payload, 'channel');

    if (subtype.length > 0) {
      segments.push(subtype);
    }
    if (channel.length > 0) {
      segments.push(channel);
    }
    segments.push(id);
    return segments.join('-');
  }

  /**
   * Build any legacy discovery topic ids this app previously emitted for the same entity.
   * @param dataEntry - Parsed sensor report.
   * @param fieldName - Metric field suffix.
   * @param canonicalUniqueId - Canonical unique id for the entity.
   * @returns - Legacy topic ids that may safely be cleared.
   */
  private buildLegacyTopicUniqueIds(dataEntry: DataEntry, fieldName: string, canonicalUniqueId: string): string[] {
    const legacyBase = this.sanitizeLegacyIdentifier(dataEntry.get_unique_id());
    const legacyUniqueId = `${legacyBase}_${fieldName}`;
    return legacyUniqueId === canonicalUniqueId ? [] : [legacyUniqueId];
  }

  /**
   * Build the canonical wildcard-capable state topic for the provided entry.
   * @param dataEntry - Parsed sensor report.
   * @returns - Canonical state topic or an empty string when the destination prefix is unavailable.
   */
  private buildCanonicalStateTopic(dataEntry: DataEntry): string {
    const destinationTopic = configuration.mqttDestTopic;
    const suffix = this.extractSourceHashSuffix(dataEntry.topic);
    if (destinationTopic === UNSET_CONFIG_VALUE || suffix.length === 0 || !destinationTopic.endsWith('/#')) {
      return '';
    }
    return `${destinationTopic.slice(0, -1)}${suffix}`;
  }

  /**
   * Extract the trailing hash suffix captured from the configured MQTT source topic.
   * @param topic - MQTT source topic.
   * @returns - Segments matched by the source '#', or an empty string.
   */
  private extractSourceHashSuffix(topic: string): string {
    const matches = getSrcTopicRegex().exec(topic);
    const suffix = matches?.[matches.length - 1];
    if (typeof suffix !== 'string' || suffix.length === 0) {
      return '';
    }
    return suffix;
  }

  /**
   * Extract the trailing hash suffix from a wildcard-capable destination state topic.
   * @param topic - Forwarded MQTT state topic.
   * @returns - Segments matched by the destination '#', or an empty string.
   */
  private extractDestinationHashSuffix(topic: string): string {
    const destinationTopic = configuration.mqttDestTopic;
    if (destinationTopic === UNSET_CONFIG_VALUE || !destinationTopic.endsWith('/#')) {
      return '';
    }

    const patternSegments = destinationTopic.split('/');
    const topicSegments = topic.split('/');
    const hashIndex = patternSegments.lastIndexOf('#');
    if (hashIndex < 0 || topicSegments.length <= hashIndex) {
      return '';
    }

    for (let i = 0; i < hashIndex; i++) {
      const patternSegment = patternSegments[i];
      const topicSegment = topicSegments[i];

      if (patternSegment === '+') {
        if (topicSegment === undefined) {
          return '';
        }
        continue;
      }

      if (patternSegment !== topicSegment) {
        return '';
      }
    }

    return topicSegments.slice(hashIndex).join('/');
  }

  /**
   * Extract the gateway identifier from a rtl_433 topic.
   * @param topic - MQTT source topic.
   * @returns - Gateway id segment or null when unavailable.
   */
  private extractGatewayId(topic: string): string | null {
    const sourceTopic = configuration.mqttSrcTopic;
    if (sourceTopic !== UNSET_CONFIG_VALUE && sourceTopic.endsWith('/#')) {
      const patternSegments = sourceTopic.split('/');
      const topicSegments = topic.split('/');
      const hashIndex = patternSegments.lastIndexOf('#');
      let gatewaySegment: string | null = null;
      let matchedGatewaySegment = false;

      if (hashIndex > 0 && topicSegments.length > hashIndex) {
        for (let i = 0; i < hashIndex; i++) {
          if (patternSegments[i] === '+') {
            gatewaySegment = topicSegments[i] ?? '';
            matchedGatewaySegment = true;
          }
        }
      }

      if (matchedGatewaySegment) {
        return gatewaySegment !== null && gatewaySegment.length > 0 ? gatewaySegment : null;
      }
    }

    const segments = topic.split('/');
    const markerIndex = segments.indexOf(RTL_433_TOPIC_SEGMENT);
    if (markerIndex <= 0) {
      return null;
    }
    return segments[markerIndex - 1] || null;
  }

  /**
   * Checks if a metric is supported and present for the provided payload.
   * @param dataEntry - Parsed sensor report.
   * @param fieldName - Metric field name.
   * @returns - True when the metric should emit discovery.
   */
  private hasSupportedMetric(dataEntry: DataEntry, fieldName: string): boolean {
    switch (fieldName) {
    case 'temperature_C':
      return dataEntry.get_temperature() !== null;
    case 'humidity':
      return dataEntry.get_humidity() !== null;
    case 'temperature_1_C':
    case 'temperature_2_C':
      return dataEntry.data.model === KnownType.MaverickET73 && this.readNumericField(dataEntry, fieldName) !== null;
    default:
      return false;
    }
  }

  /**
   * Read a numeric metric field from the raw message payload.
   * @param dataEntry - Parsed sensor report.
   * @param fieldName - Field to read.
   * @returns - Numeric value when present, otherwise null.
   */
  private readNumericField(dataEntry: DataEntry, fieldName: string): number | null {
    const payload = dataEntry.data as unknown as Record<string, unknown>;
    const value = payload[fieldName];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  /**
   * Read and normalize one identity segment from the raw payload.
   * @param payload - Raw device payload.
   * @param fieldName - Identity field to read.
   * @returns - Normalized field value or an empty string.
   */
  private readIdentitySegment(payload: Record<string, unknown>, fieldName: string): string {
    const value = payload[fieldName];
    if (typeof value === 'string' || typeof value === 'number') {
      return this.normalizeIdentitySegment(String(value));
    }
    return '';
  }

  /**
   * Normalize a discovery identity segment using OMG-compatible rules.
   * @param input - Raw identity segment.
   * @returns - Normalized identity segment.
   */
  private normalizeIdentitySegment(input: string): string {
    return input
      .replaceAll(' ', '_')
      .replaceAll('/', '_')
      .replaceAll('.', '_')
      .replaceAll('&', '')
      .trim();
  }

  /**
   * Apply the old discovery service identifier sanitation for historical cleanup.
   * @param input - Raw legacy identifier.
   * @returns - Legacy sanitized identifier.
   */
  private sanitizeLegacyIdentifier(input: string): string {
    return input.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_');
  }
}

export const homeAssistantDiscoveryService = new HomeAssistantDiscoveryService();
