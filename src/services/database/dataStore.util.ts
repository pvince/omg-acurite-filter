import { OMGDevice } from '../../mqtt/omg_devices/device.types';

/**
 * Data store representation of IDataModelMqttMsg
 */
export interface IDataStoreOMGMsg {
  /**
   * Timestamp for the MQTT Msg
   */
  timestamp: Date;

  /**
   * Parsed OMG device object
   */
  msg: OMGDevice;

  /**
   * Device ID
   */
  device_id: string;
}
