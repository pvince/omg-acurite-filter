/**
 * List of supported OMG Device types. Further definitions for these types should be done in their own file.
 */
export enum KnownType {
  AcuriteTower = 'Acurite-Tower',
  Acurite5n1 = 'Acurite-5n1',
  AcuriteProIn = 'Acurite-00276rm',
  AcuriteLightning = 'Acurite-6045M'
}

/**
 * Common properties for all OMG Devices
 */
export interface IOMGDeviceBase {
  /**
   * Device ID
   */
  id: string;
  /**
   * The model of the device. While this is set to KnownType, it is highly likely that the type will NOT be one of the
   * listed known types.
   */
  model: KnownType;
  /**
   * Signal strength
   */
  rssi: number;
}

