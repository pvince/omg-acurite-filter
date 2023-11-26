import { MS_IN_DAY, MS_IN_HOUR } from '../constants';

/**
 * Message entries in the log
 */
interface IMsgEntry {
  /**
   * Timestamp for the message event.
   */
  timestamp: Date;
  /**
   * Device ID that triggered this message
   */
  device_id: string;
  /**
   * Message that was logged.
   */
  msg: string;
}

const LOG_DURATION_DAYS = 2;
const LOG_DURATION = MS_IN_DAY * LOG_DURATION_DAYS;

const PURGE_FREQUENCY_HOURS = 2;
const PURGE_FREQUENCY = PURGE_FREQUENCY_HOURS * MS_IN_HOUR;

/**
 * Message logger class
 */
class MsgLog {
  protected readonly messages: IMsgEntry[] = [];

  protected lastPurged = new Date();

  /**
   * Add a new message to the log
   * @param device_id - Device that triggered the message
   * @param msg - Message to log
   */
  public add(device_id: string, msg: string): void {
    this.remove_stale_data();
    this.messages.push({
      timestamp: new Date(),
      device_id,
      msg
    });
  }

  /**
   * Returns all the logged messages.
   * @returns - Returns the log of all the messages.
   */
  public getMsgs(): IMsgEntry[] {
    this.remove_stale_data(true);
    return this.messages;
  }

  /**
   * Removes stale data from the message log.
   * @param force - (default: false) Should this override the periodic purge of data and purge logged data now?
   * @protected
   */
  protected remove_stale_data(force = false): void {
    if (this.messages.length === 0) {
      return;
    }

    const purgeCuttoff = new Date(Date.now() - PURGE_FREQUENCY);
    if (force || purgeCuttoff > this.lastPurged) {
      const eventCuttoff = new Date(Date.now() - LOG_DURATION);
      let finished = false;
      while (!finished && this.messages.length > 0) {
        if (this.messages[0].timestamp < eventCuttoff) {
          this.messages.shift();
        } else {
          finished = true;
        }
      }

      this.lastPurged = new Date();
    }
  }
}

const msgLog = new MsgLog();

export default msgLog;
