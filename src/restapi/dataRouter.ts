import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';

/**
 * Get a specific data entry from cache.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 */
function handleData(req: Request, res: Response): void {
  res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
}


const dataRouter = Router();

dataRouter.get('/v1/data', handleData);

export default dataRouter;
