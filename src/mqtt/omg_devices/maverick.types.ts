import {IOMGDeviceBase, KnownType} from './device';

/**
 * Maverick ET73 BBQ Temperature Probes.
 */
export interface IMaverickET73x extends IOMGDeviceBase {
    /**
     * Maverick ET73 BBQ Temperature Probes
     */
    model: KnownType.MaverickET73;

    /**
     * Food probe temperature
     */
    temperature_1_C: number;

    /**
     * Oven probe temperature
     */
    temperature_2_C: number;
}
