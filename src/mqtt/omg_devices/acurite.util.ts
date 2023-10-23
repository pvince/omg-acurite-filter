import { KnownType } from './device';
import { Acurite5n1MessageType, AcuriteDevice } from './acurite.types';

/**
 * Temperature for an Acurite device, or null.
 * @param acuriteDevice - Acurite device to get the temperature for
 * @returns - The temperature for the acurite device, or null if there is no temperature for this device.
 */
export function getAcuriteTemperature(acuriteDevice: AcuriteDevice): number | null {
    if (acuriteDevice.model === KnownType.AcuriteTower || acuriteDevice.model === KnownType.AcuriteProIn) {
        return acuriteDevice.temperature_C;
    } else if (acuriteDevice.model === KnownType.Acurite5n1 &&
        acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp) {
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
        acuriteDevice.message_type === Acurite5n1MessageType.SpeedAndTemp) {
        return acuriteDevice.humidity;
    }
    return null;
}

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
