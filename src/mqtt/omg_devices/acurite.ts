/* eslint-disable @typescript-eslint/no-magic-numbers */
import { IOMGDeviceBase, KnownType } from './device';

/**
 * Acurite data channels
 */
export enum AcuriteChannel {
  A = 'A',
  B = 'B',
  C = 'C'
}

/**
 * Acurite device battery status
 */
export enum AcuriteBatteryOk {
  'No',
  'Yes'
}

/**
 * Acurite water detection status
 */
export enum AcuriteWaterDetected {
  'No',
  'Yes'
}

/**
 * Types of Acurite Pro In probes
 */
export enum AcuriteProInSubtype {
  none,
  water
}

/**
 * Common acurite device properties
 */
export interface IAcuriteDeviceBase extends IOMGDeviceBase {
  /**
   * Is the battery Ok?
   */
  battery_ok: AcuriteBatteryOk;
}

/**
 * Acurite device that reports temperature & humidity
 */
export interface IAcuriteTempHumidityBase extends IAcuriteDeviceBase {
  /**
   * Temperature in celsius
   */
  temperature_C: number;
  /**
   * Humidity in percentages
   */
  humidity: number;
}

/**
 * Acurite 'Tower' device
 */
export interface IAcuriteTower extends IAcuriteTempHumidityBase {
  /**
   * Set the model to 'Acurite-Tower'
   */
  model: KnownType.AcuriteTower;
  /**
   * What channel is the acurite device on?
   */
  channel: AcuriteChannel;
}

/**
 * Acurite 'ProIn' device
 */
export interface IAcuriteProIn extends IAcuriteTempHumidityBase {
  /**
   * Acurite-00276rm
   */
  model: KnownType.AcuriteProIn;

  /**
   * What type of ProIn probe is connected?
   */
  subtype: AcuriteProInSubtype;

  /**
   * Is water detected?
   */
  water: AcuriteWaterDetected;
}

/**
 * Acurite 5n1 devices send two different types of messages.
 */
export enum Acurite5n1MessageType {
  SpeedAndTemp = 56,
  WindAndRain = 49
}

/**
 * Acurite 5n1 device message that includes Wind & Rain information.
 */
export interface IAcurite5n1_WindAndRain extends IAcuriteDeviceBase {
  /**
   * Acurite-5n1 device
   */
  model: KnownType.Acurite5n1;
  /**
   * Wind & Rain data
   */
  message_type: Acurite5n1MessageType.WindAndRain;
  /**
   * What channel is the acurite device on?
   */
  channel: AcuriteChannel;
}

/**
 *
 */
export interface IAcurite5n1_WindSpeedAndTemp extends IAcuriteTempHumidityBase {
  /**
   * Acurite-5n1 device
   */
  model: KnownType.Acurite5n1;
  /**
   * Reporting wind speed and temperature data.
   */
  message_type: Acurite5n1MessageType.SpeedAndTemp;
  /**
   * What channel is the acurite device on?
   */
  channel: AcuriteChannel;

}

/**
 * Consolidating the different Acurite-5n1 message types
 */
export type IAcurite5n1 = IAcurite5n1_WindAndRain | IAcurite5n1_WindSpeedAndTemp;
/**
 * Consolidating the different acurite devices
 */
export type AcuriteDevice = IAcurite5n1 | IAcuriteTower | IAcuriteProIn;
/**
 * Different Acurite device type strings
 */
export const AcuriteTypes = [ KnownType.Acurite5n1, KnownType.AcuriteTower, KnownType.AcuriteProIn ];

/**
 * Builds a unique ID for acurite devices.
 * @param acuriteDevice - Acurite device to build an ID for.
 * @returns - A unique ID for an Acurite device.
 */
export function getUniqueAcuriteID(acuriteDevice: AcuriteDevice): string {
  let device_id = `${acuriteDevice.model}:${acuriteDevice.id}`;
  if (acuriteDevice.model === KnownType.Acurite5n1) {
    device_id += `:${acuriteDevice.message_type}`;
  }
  if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.Acurite5n1) {
    device_id = `${acuriteDevice.channel}:${device_id}`;
  }
  if (acuriteDevice.model === KnownType.AcuriteProIn) {
    device_id = `${acuriteDevice.subtype}:${device_id}`;
  }
  return device_id;
}

/**
 * Temperature for an Acurite device, or null.
 * @param acuriteDevice - Acurite device to get the temperature for
 * @returns - The temperature for the acurite device, or null if there is no temperature for this device.
 */
export function getAcuriteTemperature(acuriteDevice: AcuriteDevice): number | null {
  if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.AcuriteProIn) {
    return acuriteDevice.temperature_C;
  } else if (acuriteDevice.model === KnownType.Acurite5n1 &&
    acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp ) {
    return acuriteDevice.temperature_C;
  }
  return null;
}

/**
 * Humidity for an acurite device, or null
 * @param acuriteDevice - Acurite device to get the temperature for
 * @returns - The humidity for the acurite device, or null if there is no humidity for this device.
 */
export function getAcuriteHumidity(acuriteDevice: AcuriteDevice): number | null {
  if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.AcuriteProIn) {
    return acuriteDevice.humidity;
  } else if (acuriteDevice.model === KnownType.Acurite5n1 &&
    acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp ) {
    return acuriteDevice.humidity;
  }
  return null;
}
