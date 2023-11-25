import { Request, Response, Router } from 'express';
import { getJobStats, IStatsJobs } from '../services/messageForwardingService';

/**
 * Stats interface
 */
interface IStats {
  /**
   * Job stats
   */
  jobs: IStatsJobs;
}

/**
 * Builds the stats
 * @returns - The applications statistics
 */
function buildStats(): IStats {
  return {
    jobs: getJobStats()
  };
}

/**
 * Returns the list of jobs .
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleStats(req: Request, res: Response): void {
  res.json(buildStats());
  res.send();
}

const jobsRouter = Router();

jobsRouter.get('/v1/stats', handleStats);

export default jobsRouter;
