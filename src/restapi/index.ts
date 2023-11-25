import { Router } from 'express';
import jobsRouter from './jobsRouter';


const apiRouter = Router();

apiRouter.use('/api', jobsRouter);

export default apiRouter;
