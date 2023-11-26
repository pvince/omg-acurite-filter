import { Request, Response, Router } from 'express';
import msgLog from '../services/msgLog';


/**
 * Returns the list of jobs .
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleLogs(req: Request, res: Response): void {
  res.json(msgLog.getMsgs());
  res.send();
}

const logsRouter = Router();

logsRouter.get('/v1/logs', handleLogs);

export default logsRouter;
