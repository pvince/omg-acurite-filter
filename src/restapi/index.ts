import { Router } from 'express';
import forwardersRouter from './forwardersRouter';
import statsRouter from './statsRouter';
import cacheRouter from './cacheRouter';
import logsRouter from './logsRouter';
import dataRouter from './dataRouter';

const apiRouter = Router();

apiRouter.use('/api', forwardersRouter);
apiRouter.use('/api', statsRouter);
apiRouter.use('/api', cacheRouter);
apiRouter.use('/api', logsRouter);
apiRouter.use('/api', dataRouter);

export default apiRouter;
