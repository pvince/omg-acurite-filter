import { SimpleIntervalJob } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';

/**
 * Converts 'setTimeout' to a promise based function.
 * @param duration - Duration of the sleep in milliseconds.
 * @returns - Returns a promise that resolves when the duration has passed
 */
function sleepPromise(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}


/**
 * The role of this class is to throttle the torrent of MQTT data coming from multiple OMG Receivers.
 */
class MessageForwardingService {
  /**
   * Map of Device ID => MQTT Message
   * @private
   */
  private readonly messages = new Map<string, IMQTTMessage>();

  /**
   * Map of Device ID => Forwarding Job
   * @private
   */
  private readonly jobStore = new Map<string, SimpleIntervalJob>();

  /**
   * Queues the message for sending. Only one message may be queued per device_id.
   * @param device_id - ID of the device that triggered the message.
   * @param message - MQTT Message to send.
   */
  public async throttleMessage(device_id: string, message: IMQTTMessage): Promise<void> {
    this.messages.set(device_id, message);
    await Promise.resolve();
  }

  /**
   * Immediately forwards the MQTT message to the configured MQTT broker.
   * @param message - MQTT Message to forward.
   */
  public async forwardMessage(message: IMQTTMessage): Promise<void> {
    //todo: This needs to normalize|fix topics
    // We received the message on something like 433_direct/original/OMG_lilygo_rtl_433_ESP_2/RTL_433toMQTT/Acurite-Tower/A/5812
    //       We need to forward that message to: 433_direct/OMG_lilygo_rtl_433_ESP_2/RTL_433toMQTT/Acurite-Tower/A/5812
  }
}

export const messageForwardingService = new MessageForwardingService();
