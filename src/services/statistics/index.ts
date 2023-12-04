import { IStatistics, IStatsApplication, IStatsDataCache, IStatsForwarderJobs, IStatsMQTT } from './statistics.types';
import { getRates, forwarderStats, mqttRecRate, mqttSendRate, mqttStats, appStats } from './passiveStatistics';
import { messageForwardingService } from '../messageForwardingService';
import dataCache from '../dataCache';
import formatDuration from 'format-duration';

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
      forwarders: this.forwarderStats(),
      mqtt: this.mqttStats(),
      cache: this.cacheStats(),
      app: this.appStats()
    };
  }

  /**
   * Gathers job information & returns just those stats.
   * @returns - Job stats
   */
  public forwarderStats(): IStatsForwarderJobs {
    forwarderStats.active = messageForwardingService.getJobCount();
    return forwarderStats;
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

  /**
   * Application statistics
   * @returns - Application statistics
   */
  public appStats(): IStatsApplication {
    const dynamicVals: Partial<IStatsApplication> = {
      uptime: formatDuration(Date.now() - appStats.startTime.getTime()),
      memory: {
        totalBytes: process.memoryUsage().heapTotal,
        usedBytes: process.memoryUsage().heapUsed
      }
    };

    return { ...appStats, ...dynamicVals };
  }
}

const statistics = new Statistics();

export default statistics;
