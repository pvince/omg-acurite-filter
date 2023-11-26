import { IStatistics, IStatsDataCache, IStatsJobs, IStatsMQTT } from './statistics.types';
import { getRates, jobStats, mqttRecRate, mqttSendRate, mqttStats } from './passiveStatistics';
import { messageForwardingService } from '../messageForwardingService';
import dataCache from '../dataCache';

/**
 * Primary statistic gathering class. This may actively gather statistics.
 */
class Statistics {
  /**
   * Full statistics information.
   * @returns - The full statistics information
   */
  public getStats(): IStatistics {
    return {
      jobs: this.jobStats(),
      mqtt: this.mqttStats(),
      data: this.cacheStats()
    };
  }

  /**
   * Gathers job information & returns just those stats.
   * @returns - Job stats
   */
  public jobStats(): IStatsJobs {
    jobStats.active = messageForwardingService.getJobCount();
    return jobStats;
  }

  /**
   * DataCache statistics
   * @returns - DataCache statistics
   */
  public cacheStats(): IStatsDataCache {
    return {
      devices: dataCache.count
    };
  }

  /**
   * MQTT message stats
   * @returns - MQTT Message stats
   */
  public mqttStats(): IStatsMQTT {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    mqttStats.sent.pct_fwded = Math.round((mqttStats.sent.total / mqttStats.received.total) * 10000) / 100 ;
    mqttStats.sent.rates = getRates(mqttSendRate);
    mqttStats.received.rates = getRates(mqttRecRate);
    return mqttStats;
  }
}

const statistics = new Statistics();

export default statistics;
