import { IStatsDataCache, IStatsJobs, IStatsMQTT } from './statistics.types';

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
    unparseable: 0
  },
  sent: {
    total: 0,
    pct_fwded: 0
  }
};

/**
 * DataCache statistics
 */
export const cacheStats: IStatsDataCache = {
  devices: 0
};
