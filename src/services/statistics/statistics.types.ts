/**
 * Job statistics
 */
export interface IStatsJobs {
  /**
   * Active jobs. This data is gathered at the time statistics are requested.
   */
  active: number;
  /**
   * Ended jobs. This is tracked as jobs are deleted.
   */
  ended: number;
  /**
   * Total number of jobs ever started & run. This is tracked as jobs are created. It should match the total active +
   * ended jobs.
   */
  lifetime: number;
}

/**
 * MQTT Statistics
 */
export interface IStatsMQTT {
  /**
   * Received stats
   */
  received: {
    /**
     * Total MQTT msgs received
     */
    total: number;
    /**
     * Total OMG msgs received
     */
    omg: number;
    /**
     * Total OMG msgs deemed 'invalid'
     */
    omg_invalid: number;
    /**
     * Total MQTT messages that were not OMG formatted
     */
    unknown: number;
    /**
     * Total MQTT messages that were not parsable JSON
     */
    unparseable: number;
    /**
     * Number of messages received per minute over last 5 minutes
     */
    msgPerMin: number;

    /**
     * Number of messages recevied per second over the last 5 minutes.
     */
    msgPerSec: number;
  };
  /**
   * Sent stats
   */
  sent: {
    /**
     * Total MQTT messages sent
     */
    total: number;
    /**
     * Percent of sent messages vs the total number of received messages. Aka, how effective is this as an MQTT
     * message throttler.
     */
    pct_fwded: number;
    /**
     * Number of messages sent per minute over last 5 minutes
     */
    msgPerMin: number;

    /**
     * Number of messages sent per second over the last 5 minutes.
     */
    msgPerSec: number;
  };
}

/**
 * DataCache stats
 */
export interface IStatsDataCache {
  /**
   * Total count of unique devices.
   */
  devices: number;
}

/**
 * Statistics interface
 */
export interface IStatistics {
  /**
   * Job stats
   */
  jobs: IStatsJobs;

  /**
   * MQTT stats
   */
  mqtt: IStatsMQTT;

  /**
   * DataCache stats
   */
  data: IStatsDataCache;
}
