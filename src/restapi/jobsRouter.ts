import { Request, Response, Router } from 'express';
import { Job, JobStatus } from 'toad-scheduler';
import { IMQTTMessage } from '../mqtt/IMQTTMessage';
import { messageForwardingService } from '../services/messageForwardingService';


interface IJob {
  id: string;
  status: JobStatus;
  queuedMessage: IMQTTMessage | null;
}

function buildJob(device_id: string, job: Job): IJob {
  return {
    id: device_id,
    status: job.getStatus(),
    queuedMessage: messageForwardingService.getMessage(device_id)
  };
}


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
