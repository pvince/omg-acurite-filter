/**
 * This file is for passively gathering statistic data. It does not actively reach out to any other services. This is
 * to prevent circular references between the statistics service & other services.
 */
import { IStatsApplication, IStatsForwarderJobs, IStatsMQTT, IStatsRates } from './statistics.types';
import { RateMeter } from './rateMeter';
import dateFormat from 'dateformat';

/**
 * Actual job stats
 */
export const forwarderStats: IStatsForwarderJobs = {
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
    rates: {
      perMin: 0,
      perSec: 0
    }
  },
  sent: {
    total: 0,
    pct_fwded: 0,
    rates: {
      perMin: 0,
      perSec: 0
    }
  }
};


/**
 * MQTT received messages rate meter.
 */
export const mqttRecRate = new RateMeter();

/**
 * MQTT sent messages rate meter.
 */
export const mqttSendRate = new RateMeter();

/**
 * Application statistics.
 */
export const appStats: IStatsApplication = {
  uptime: '',
  startTime: new Date(),
  startTimeFormatted: dateFormat(new Date(), 'yyyy.dd.mm h:MM:ss tt'),
  memory: {
    totalBytes: 0,
    usedBytes: 0
  }
};

/**
 * Get msg rates for the rate meter.
 * @param rateMeter - RateMeter to return stats for
 * @returns - Rates object
 */
export function getRates(rateMeter: RateMeter): IStatsRates {
  return {
    perSec: rateMeter.getRatePerSecond(),
    perMin: rateMeter.getRatePerMinute()
  };
}
