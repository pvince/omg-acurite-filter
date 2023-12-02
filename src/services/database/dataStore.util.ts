import { IDataModelMqttMsg } from './database.types';
import { IDataStoreOMGMsg } from './dataStore.types';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { OMGDevice } from '../../mqtt/omg_devices/device.types';


/**
 * Convert the data model object to the data store equivalent.
 * @param mqttModel - Row read from the database.
 * @returns - A usable JSONified object.
 */
export function convertMqttMsg(mqttModel: IDataModelMqttMsg): IDataStoreOMGMsg {
  const mqtt_msg: IMQTTMessage = JSON.parse(mqttModel.msg);

  return {
    timestamp: new Date(mqttModel.timestamp),
    device_id: mqttModel.device_id ?? '',
    msg: mqtt_msg.data as OMGDevice
  };
}
