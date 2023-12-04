/**
 * Forwarder Job statistics
 */
export interface IStatsForwarderJobs {
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
 * Number of messages received per measurement
 */
export interface IStatsRates {
  /**
   * Number of messages received per minute over last 5 minutes
   */
  perMin: number;

  /**
   * Number of messages recevied per second over the last 5 minutes.
   */
  perSec: number;
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
     * Message rates
     */
    rates: IStatsRates;
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
     * Message rates
     */
    rates: IStatsRates;
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
 * Application statistics
 */
export interface IStatsApplication {
  /**
   * When was the application started
   */
  readonly startTime: Date;
  /**
   * Friendly, localized application start time.
   */
  readonly startTimeFormatted: string;
  /**
   * Human readable 'uptime'
   */
  readonly uptime: string;
  /**
   * Memory info for the application
   */
  readonly memory: {
    /**
     * Total bytes reserved for the process
     */
    readonly totalBytes: number;
    /**
     * Bytes actually in use by the application.
     */
    readonly usedBytes: number;
  };
}

/**
 * Statistics interface
 */
export interface IStatistics {
  /**
   * Job stats
   */
  forwarders: IStatsForwarderJobs;

  /**
   * MQTT stats
   */
  mqtt: IStatsMQTT;

  /**
   * DataCache stats
   */
  cache: IStatsDataCache;

  /**
   * Application stats
   */
  app: IStatsApplication;
}
