import { Request, Response, Router } from 'express';
import { Job, JobStatus } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import { messageForwardingService } from '../services/messageForwardingService';

/**
 * Job interface
 */
interface IForwarderJob {
  /**
   * Job ID, aka device ID
   */
  id: string;
  /**
   * Job status
   */
  status: JobStatus;
  /**
   * If there is a queued message, this is it.
   */
  queuedMessage: IMQTTMessage | null;
}

/**
 * Builds an individual IForwarderJob from job data.
 * @param device_id - Device ID
 * @param job - Job from the message forwarding service
 * @returns - New IForwarderJob based on active jobs.
 */
function buildForwarder(device_id: string, job: Job): IForwarderJob {
  return {
    id: device_id,
    status: job.getStatus(),
    queuedMessage: messageForwardingService.getMessage(device_id)
  };
}

/**
 * Gathers active job data from the message forwarding service.
 * @returns - List of IJobs we can send to the caller
 */
function gatherForwarders(): IForwarderJob[] {
  const result: IForwarderJob[] = [];
  for (const [device_id, job] of messageForwardingService.jobEntries()) {
    result.push(buildForwarder(device_id, job));
  }
  return result;
}

/**
 * Returns the list of jobs .
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleForwarders(req: Request, res: Response): void {
  res.json(gatherForwarders());
  res.send();
}

const forwardersRouter = Router();

forwardersRouter.get('/v1/forwarders', handleForwarders);

export default forwardersRouter;
