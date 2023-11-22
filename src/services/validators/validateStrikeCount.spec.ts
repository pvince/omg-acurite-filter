import { AcuriteChannel, IAcuriteLightning } from '../../mqtt/omg_devices/acurite.types';
import { KnownType } from '../../mqtt/omg_devices/device';
import { DataEntry } from '../dataEntries/dataEntry';

/**
 * Get a typical Acurite 6045M lightning object.
 * @param lightningOpts - Specific configuration settings for the returned object.
 * @returns - Returns a 6045M lightning strike count object.
 */
export function get_acurite_lightning(lightningOpts: Partial<IAcuriteLightning> = {}): IAcuriteLightning {
    const default_object: IAcuriteLightning = {
            'model': KnownType.AcuriteLightning,
            'id': '164',
            'channel': AcuriteChannel.A,
            'battery_ok': 1,
            'temperature_C': 11.77778,
            'humidity': 42,
            'strike_count': 13,
            'storm_dist': 0,
            'active': 0,
            'rfi': 0,
            'exception': 0,
             'rssi': -64
        };

    return { ...default_object, ...lightningOpts };
}

/**
 * Create a new DataEntry based on the parameters.
 * @param lightningOpts - Lightning construction opts
 * @param topic - MQTT topic we  received this data at.
 * @returns - A newly constructed DataEntry
 */
export function get_lightning_data_entry(lightningOpts: Partial<IAcuriteLightning> = {},
                                         topic = '433_direct/raw/OMG_lilygo_rtl_433_ESP_2/RTL_433toMQTT/Acurite-6045M/A/164'): DataEntry {
    return new DataEntry(topic, get_acurite_lightning(lightningOpts));
}
