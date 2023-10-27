import { AcuriteDevice } from './acurite.types';
import { IMaverickET73x } from './maverick.types';

/**
 * Type union for all possible OMG Devices
 */
export type OMGDevice = AcuriteDevice | IMaverickET73x;
