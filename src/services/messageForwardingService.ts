import { AsyncTask, JobStatus, SimpleIntervalJob } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import configuration from './configuration';
import { getScheduler } from './jobScheduler';
import dataCache from './dataCache';

const log = configuration.log.extend('msg-fwd-svc');

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
    // Update the message to send.
    this.messages.set(device_id, message);

    // Ensure the job is started for this device_id
    this.startJob(device_id);
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

  /**
   * Forwards the latest cached message for the specified device id.
   * @param device_id - Device ID to use to retrieve cached data
   * @protected
   */
  protected async forwardThrottledMessage(device_id: string): Promise<void> {
    const dataEntryArray = dataCache.getByID(device_id);

    if (dataEntryArray.length > 0) {
      await this.forwardMessage(dataEntryArray[dataEntryArray.length - 1]);
    }
  }

  /**
   * Checks to see if the job exists, creates it if needed, then makes sure the job is started.
   * @param device_id - Device ID to use to lookup & create the job.
   * @protected
   */
  protected startJob(device_id: string): void {
    let curJob = this.jobStore.get(device_id);
    if (!curJob) {
      const taskFunc = (): Promise<void> => (this.forwardThrottledMessage(device_id));

      const task = new AsyncTask(
        `forwardThrottledMessage[${device_id}]`,
        taskFunc,
        (err: Error) => {
          log('Encountered an error while running forwardThrottledMessage(%s): %s', device_id, err);
        });

      curJob = new SimpleIntervalJob({ minutes: 1, runImmediately: true }, task);
      this.jobStore.set(device_id, curJob);

      log('Starting job for device: %s', device_id);

      getScheduler().addSimpleIntervalJob(curJob);
    }

    if (curJob.getStatus() !== JobStatus.RUNNING) {
      curJob.start();
    }
  }
}

export const messageForwardingService = new MessageForwardingService();
