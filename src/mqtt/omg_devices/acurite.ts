import { IOMGDeviceBase, KnownType } from './device';

export enum AcuriteChannel {
  A = "A",
  B = "B",
  C = "C"
}

export enum AcuriteBatteryOk {
  "No",
  "Yes"
}

export enum AcuriteWaterDetected {
  "No",
  "Yes"
}

export interface IAcuriteDeviceBase extends IOMGDeviceBase {
  battery_ok: AcuriteBatteryOk;
  channel: AcuriteChannel;
}

export interface IAcuriteTowerBase extends IAcuriteDeviceBase {
  temperature_C: number;
  humidity: number;
}

export interface IAcuriteTower extends IAcuriteTowerBase {
  model: KnownType.AcuriteTower;
}

export interface IAcuriteProIn extends IAcuriteTowerBase {
  model: KnownType.AcuriteProIn;
  water: AcuriteWaterDetected,
}

export enum Acurite5n1MessageType {
  SpeedAndTemp = 56,
  WindAndRain = 49
}

export interface IAcurite5n1_WindAndRain extends IAcuriteDeviceBase {
  model: KnownType.Acurite5n1;
  message_type: Acurite5n1MessageType.WindAndRain;
}

export interface IAcurite5n1_WindSpeedAndTemp extends IAcuriteTowerBase {
  model: KnownType.Acurite5n1;
  message_type: Acurite5n1MessageType.SpeedAndTemp;

}

export type IAcurite5n1 = IAcurite5n1_WindAndRain | IAcurite5n1_WindSpeedAndTemp;
export type AcuriteDevice = IAcurite5n1 | IAcuriteTower | IAcuriteProIn;
export const AcuriteTypes = [ KnownType.Acurite5n1, KnownType.AcuriteTower, KnownType.Acurite5n1 ];

export function getUniqueID(acuriteDevice: AcuriteDevice): string {
  return `${acuriteDevice.channel}:${acuriteDevice.model}:${acuriteDevice.id}`;
}

export function getTemperature(acuriteDevice: AcuriteDevice): number | null {
  if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.AcuriteProIn) {
    return acuriteDevice.temperature_C;
  } else if (acuriteDevice.model === KnownType.Acurite5n1 &&
    acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp ) {
    return acuriteDevice.temperature_C;
  }
  return null;
}

export function getHumidity(acuriteDevice: AcuriteDevice): number | null {
  if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.AcuriteProIn) {
    return acuriteDevice.humidity;
  } else if (acuriteDevice.model === KnownType.Acurite5n1 &&
    acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp ) {
    return acuriteDevice.humidity;
  }
  return null;
}
