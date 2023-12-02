import { IDataModelMqttMsg } from './database.types';
import { IDataStoreOMGMsg } from './dataStore.util';

/**
 * Convert the data model object to the data store equivalent.
 * @param mqttModel - Row read from the database.
 * @returns - A usable JSONified object.
 */
export function convertMqttMsg(mqttModel: IDataModelMqttMsg): IDataStoreOMGMsg {
  return {
    timestamp: new Date(mqttModel.timestamp),
    device_id: mqttModel.device_id ?? '',
    msg: JSON.parse(mqttModel.msg)
  };
}
