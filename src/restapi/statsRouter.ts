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
function handleForwarderStats(req: Request, res: Response): void {
  res.json(statistics.forwarderStats());
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

/**
 * Returns the cache stats
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleCacheStats(req: Request, res: Response): void {
  res.json(statistics.cacheStats());
  res.send();
}

/**
 * Returns the apps stats
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleAppStats(req: Request, res: Response): void {
  res.json(statistics.appStats());
  res.send();
}

const jobsRouter = Router();

jobsRouter.get('/v1/stats', handleStats);
jobsRouter.get('/v1/stats/forwarders', handleForwarderStats);
jobsRouter.get('/v1/stats/mqtt', handleMqttStats);
jobsRouter.get('/v1/stats/cache', handleCacheStats);
jobsRouter.get('/v1/stats/app', handleAppStats);

export default jobsRouter;
