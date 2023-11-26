/**
 * This file is for passively gathering statistic data. It does not actively reach out to any other services. This is
 * to prevent circular references between the statistics service & other services.
 */
import { IStatsDataCache, IStatsJobs, IStatsMQTT } from './statistics.types';
import { RateMeter } from './rateMeter';

/**
 * Actual job stats
 */
export const jobStats: IStatsJobs = {
  active: 0,
  ended: 0,
  lifetime: 0
};

/**
 * MQTT Message statistics
 */
export const mqttStats: IStatsMQTT = {
  received: {
    total: 0,
    omg: 0,
    omg_invalid: 0,
    unknown: 0,
    unparseable: 0,
    msgPerMin: 0,
    msgPerSec: 0
  },
  sent: {
    total: 0,
    pct_fwded: 0,
    msgPerMin: 0,
    msgPerSec: 0
  }
};

/**
 * DataCache statistics
 */
export const cacheStats: IStatsDataCache = {
  devices: 0
};

/**
 * MQTT received messages rate meter.
 */
export const mqttRecRate = new RateMeter();

/**
 * MQTT sent messages rate meter.
 */
export const mqttSendRate = new RateMeter();
