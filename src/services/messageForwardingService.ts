import { AsyncTask, JobStatus, SimpleIntervalJob } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import configuration from './configuration';
import { getScheduler } from './jobScheduler';
import { forwardTopic } from '../mqtt/mqtt.util';
import { publish } from '../mqtt/mqttComms';
import { get_replacement_value, get_throttle_rate } from './forwarders';

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
  public throttleMessage(device_id: string, message: IMQTTMessage): void {
    // Update the message to send.
    this.setMessage(device_id, message);

    // Ensure the job is started for this device_id
    this.startJob(device_id, message);
  }

  /**
   * Immediately forwards the MQTT message to the configured MQTT broker.
   * @param message - MQTT Message to forward.
   */
  public async forwardMessage(message: IMQTTMessage): Promise<void> {
    const forwardedTopic = forwardTopic(message.topic);
    log(`Publishing to ${forwardedTopic}`);
    await publish(forwardedTopic, message.message);
  }

  /**
   * Sets the message onto our cache of messages to send.
   * @param device_id - ID of the device that triggered the message
   * @param message - MQTT Message to send
   * @protected
   */
  protected setMessage(device_id: string, message: IMQTTMessage): void {
    // Check to see if we already have a message queued, and if we do
    // check to see if there is any special logic we should follow when
    // saving a new message over the old one.
    const prev_msg = this.messages.get(device_id);
    let msg_to_save = message;
    if (prev_msg) {
      msg_to_save = get_replacement_value(prev_msg, message);
    }

    // Save the message
    this.messages.set(device_id, msg_to_save);
  }

  /**
   * Forwards the latest cached message for the specified device id.
   * @param device_id - Device ID to use to retrieve cached data
   * @protected
   */
  protected async forwardThrottledMessage(device_id: string): Promise<void> {
    try {
      const mqtt_message = this.messages.get(device_id);
      if (!mqtt_message) {
        log('Finished reporting for [%s], stopping job',  device_id);
        this.jobStore.get(device_id)?.stop();
      } else {
        await this.forwardMessage(mqtt_message);

        // Now, delete the message we just sent.
        this.messages.delete(device_id);
      }
    } catch (err) {
      log('Encountered an error publishing for %s: %s', device_id, err);
    }
  }

  /**
   * Checks to see if the job exists, creates it if needed, then makes sure the job is started.
   * @param device_id - Device ID to use to lookup & create the job.
   * @param newMsg - The new MQTT message being sent.
   * @protected
   */
  protected startJob(device_id: string, newMsg: IMQTTMessage): void {
    let curJob = this.jobStore.get(device_id);
    if (!curJob) {
      const taskFunc = (): Promise<void> => (this.forwardThrottledMessage(device_id));

      const task = new AsyncTask(
        `forwardThrottledMessage[${device_id}]`,
        taskFunc,
        (err: Error) => {
          log('Encountered an error while running forwardThrottledMessage(%s): %s', device_id, err);
        });

      const throttleRate = get_throttle_rate(newMsg);
      curJob = new SimpleIntervalJob({ milliseconds: throttleRate, runImmediately: true }, task);
      this.jobStore.set(device_id, curJob);

      log('Creating job for device: %s\tTotal Job Count: %d', device_id, this.jobStore.size);

      getScheduler().addSimpleIntervalJob(curJob);
    }

    if (curJob.getStatus() !== JobStatus.RUNNING) {
      curJob.start();
    }
  }
}

export const messageForwardingService = new MessageForwardingService();
