import { Request, Response, Router } from 'express';
import statistics from '../services/statistics';


/**
 * Returns the system stats.
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleStats(req: Request, res: Response): void {
  res.json(statistics.getStats());
  res.send();
}

/**
 * Returns the job stats
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleJobStats(req: Request, res: Response): void {
  res.json(statistics.jobStats());
  res.send();
}
/**
 * Returns the MQTT stats
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleMqttStats(req: Request, res: Response): void {
  res.json(statistics.mqttStats());
  res.send();
}

const jobsRouter = Router();

jobsRouter.get('/v1/stats', handleStats);
jobsRouter.get('/v1/stats/jobs', handleJobStats);
jobsRouter.get('/v1/stats/mqtt', handleMqttStats);

export default jobsRouter;
