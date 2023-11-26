import { IStatistics, IStatsJobs, IStatsMQTT } from './statistics.types';
import { jobStats, mqttStats } from './passiveStatistics';
import { messageForwardingService } from '../messageForwardingService';

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
      mqtt: this.mqttStats()
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
   * MQTT message stats
   * @returns - MQTT Message stats
   */
  public mqttStats(): IStatsMQTT {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    mqttStats.sent.pct_fwded = Math.round((mqttStats.sent.total / mqttStats.received.total) * 10000) / 100 ;
    return mqttStats;
  }
}

const statistics = new Statistics();

export default statistics;
