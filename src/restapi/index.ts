import { Router } from 'express';
import jobsRouter from './jobsRouter';
import statsRouter from './statsRouter';


const apiRouter = Router();

apiRouter.use('/api', jobsRouter);
apiRouter.use('/api', statsRouter);

export default apiRouter;
