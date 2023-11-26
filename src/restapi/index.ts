import { Router } from 'express';
import jobsRouter from './jobsRouter';
import statsRouter from './statsRouter';
import dataRouter from './dataRouter';
import logsRouter from './logsRouter';


const apiRouter = Router();

apiRouter.use('/api', jobsRouter);
apiRouter.use('/api', statsRouter);
apiRouter.use('/api', dataRouter);
apiRouter.use('/api', logsRouter);

export default apiRouter;
