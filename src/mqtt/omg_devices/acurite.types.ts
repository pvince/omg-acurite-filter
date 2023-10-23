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

  /**
   * Wind speed, in km/h
   */
  wind_avg_km_h: number;

  /**
   * Wind direction, in degrees
   */
  wind_dir_deg: number;

  /**
   * Rain total in mm.
   */
  rain_mm: number;
}

/**
 * Acurite 5n1 device message that includes
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
  /**
   * Wind speed, in km/h
   */
  wind_avg_km_h: number;
}

/**
 * Acurite Lightning sensor
 */
export interface IAcuriteLightning extends IAcuriteTempHumidityBase {
  /**
   * Acurite Lightning device model
   */
  model: KnownType.AcuriteLightning;
  /**
   * Strike count
   */
  strike_count: number;
  /**
   * Storm distance
   */
  storm_dist: number;
  /**
   * Is this device active?
   */
  active: number;
  /**
   * RFI? radio interference?
   */
  rfi: number;
  /**
   * Exception?
   */
  exception: number;
}

/**
 * Consolidating the different Acurite-5n1 message types
 */
export type IAcurite5n1 = IAcurite5n1_WindAndRain | IAcurite5n1_WindSpeedAndTemp;
/**
 * Consolidating the different acurite devices
 */
export type AcuriteDevice = IAcurite5n1 | IAcuriteTower | IAcuriteProIn | IAcuriteLightning;
/**
 * Different Acurite device type strings
 */
export const AcuriteTypes = [
  KnownType.Acurite5n1,
  KnownType.AcuriteTower,
  KnownType.AcuriteProIn,
  KnownType.AcuriteLightning
];

