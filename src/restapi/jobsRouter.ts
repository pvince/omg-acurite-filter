import { Request, Response, Router } from 'express';
import { Job, JobStatus } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import { messageForwardingService } from '../services/messageForwardingService';

/**
 * Job interface
 */
interface IJob {
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
 * Builds an individual IJob from job data.
 * @param device_id - Device ID
 * @param job - Job from the message forwarding service
 * @returns - New IJob based on active jobs.
 */
function buildJob(device_id: string, job: Job): IJob {
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
function gatherJobData(): IJob[] {
  const result: IJob[] = [];
  for (const [device_id, job] of messageForwardingService.jobEntries()) {
    result.push(buildJob(device_id, job));
  }
  return result;
}

/**
 * Returns the list of jobs .
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleJobs(req: Request, res: Response): void {
  res.json(gatherJobData());
  res.send();
}

const jobsRouter = Router();

jobsRouter.get('/v1/jobs', handleJobs);

export default jobsRouter;
