
/**
 * List of supported OMG Device types. Further definitions for these types should be done in their own file.
 */
export enum KnownType {
  AcuriteTower = "Acurite-Tower",
  Acurite5n1 = "Acurite-5n1",
  AcuriteProIn = "Acurite-00276rm"
}

/**
 * Common properties for all OMG Devices
 */
export interface IOMGDeviceBase {
  id: string;
  model: KnownType;
  rssi: number;
}

