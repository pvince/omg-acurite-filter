import { IMQTTMessage } from '../../mqtt/IMQTTMessage';

/**
 * Each row in the current datastore will be represented by this interface.
 */
export interface IDataStoreEntry {
  /**
   * ISO8601 formatted date time
   */
  timestamp: Date;
  /**
   * IMQTTMessage that is being stored.
   */
  msg: IMQTTMessage;
}
