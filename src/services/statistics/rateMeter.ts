import { MS_IN_MINUTE, MS_IN_SECOND, SECONDS_IN_MINUTE } from '../../constants';

/**
 * What do I care about?
 * - Average request / minute over period
 * - When to age out old data?
 *    - New request comes in and it has been > 1 minute since last age out
 *    - Asked for the current rate
 *  So we need to track:
 *    - Array of timestamped events
 *    - Rate period, eg: Requests / minute
 *    - Reporting Period, eg: Average rate over 5 minutes
 */

const DEFAULT_PERIOD_MINUTES = 5;

const MAX_PURGE_FREQUENCY = MS_IN_MINUTE;

/**
 * Rate meter
 */
export class RateMeter {
  /**
   * How long should we keep event data?
   * @private
   */
  private readonly ratePeriod: number = DEFAULT_PERIOD_MINUTES * MS_IN_MINUTE;

  /**
   * When was the history last purged of old data?
   * @private
   */
  private lastPurged = new Date();

  /**
   * Event data
   * @private
   */
  private readonly marks: Date[] = [];

  /**
   * Log an event.
   */
  public mark(): void {
    this.age_out_data();
    this.marks.push(new Date());
  }

  /**
   * Get the current rate per minute
   * @returns - Current rate per minute.
   */
  public getRatePerMinute(): number {
    this.age_out_data(true);

    return Math.round(this.marks.length / this.getWindowInMinutes());
  }

  /**
   * Get the current rate per second.
   * @returns - Rate per second.
   */
  public getRatePerSecond(): number {
    this.age_out_data(true);

    return Math.round(this.marks.length / this.getWindowInSeconds());
  }

  /**
   * Ages out events that are older than the monitored period of time.
   * @param force - (Optional: false) If true, this will ignore the age out frequency limit and force out all old values now.
   * @private
   */
  private age_out_data(force = false): void {
    // Bail if the marks are empty
    if (this.marks.length === 0) {
      return;
    }

    // Don't constantly purge old data. Only do it if it has been a while since the last purge
    // or if we are forced to because we are about to calculate statistics.
    const lastPurgeCutoff = new Date(Date.now() - MAX_PURGE_FREQUENCY);
    if (force || lastPurgeCutoff > this.lastPurged ) {
      const eventCutoff = new Date(Date.now() - this.ratePeriod);
      let finished = false;
      while (!finished && this.marks.length > 0) {
        if (this.marks[0] < eventCutoff) {
          this.marks.shift();
        } else  {
          finished = true;
        }
      }

      this.lastPurged = new Date();
    }
  }

  /**
   * Get the 'window' for events in seconds.
   * @returns - Returns the window for events in seconds.
   * @private
   */
  private getWindowInSeconds(): number {
    const oldestMark = this.marks[0];
    const windowTimestamp  = new Date(Date.now() - this.ratePeriod);
    let result = this.ratePeriod / MS_IN_SECOND;
    if (oldestMark > windowTimestamp) {
      result = (Date.now() - oldestMark.getTime()) / MS_IN_SECOND;
    }

    return result;
  }

  /**
   * Gets the 'window' for events in minutes
   * @returns - Window for events in minutes
   * @private
   */
  private getWindowInMinutes(): number {
    return this.getWindowInSeconds() / SECONDS_IN_MINUTE;
  }
}
