import { AbstractThrottler } from './throttler';
import { IMQTTMessage } from '../../mqtt/IMQTTMessage';
import { isOMGDevice } from '../../mqtt/mqtt.util';
import { KnownType } from '../../mqtt/omg_devices/device';
import { MS_IN_SECOND } from '../../constants';
import { IMaverickET73x } from '../../mqtt/omg_devices/maverick.types';
import configuration from '../configuration';

const TEMP_THRESHOLD = 150; // 302 F
const FAST_THROTTLE_RATE_SECONDS = 30;
const FAST_THROTTLE_RATE = FAST_THROTTLE_RATE_SECONDS * MS_IN_SECOND;

/**
 * Custom rate limiting for the Maverick oven temperature sensor.
 */
export class ThrottlerMaverick implements AbstractThrottler {
  /**
   * Does this type of message have a custom rate?
   * @param msg - Newly received MQTT rate
   * @returns - Returns true if this message has custom rate handling.
   */
  public hasCustomRate(msg: IMQTTMessage): boolean {
    let result = false;
    if (isOMGDevice(msg.data) && msg.data.model === KnownType.MaverickET73) {
      result = true;
    }
    return result;
  }

  /**
   * Gets the custom rate for this message
   * @param msg - Newly received MQTT rate
   * @returns - Returns custom throttle rate for this message
   */
  public getCustomRate(msg: IMQTTMessage): number {
    let result = configuration.throttleRate;

    if (isOMGDevice(msg.data) && msg.data.model === KnownType.MaverickET73) {
      const maverick = msg.data as IMaverickET73x;
      // We know we are a maverick device, lets check to see if either of the probes is over the threshold
      if (maverick.temperature_1_C >= TEMP_THRESHOLD || maverick.temperature_2_C >= TEMP_THRESHOLD) {
        result = FAST_THROTTLE_RATE;
      }
    }

    return result;
  }
}
