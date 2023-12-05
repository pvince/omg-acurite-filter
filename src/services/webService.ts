import configuration from './configuration';
import express, { Express, Request, Response, NextFunction } from 'express';
import compression from 'compression';
import * as http from 'http';
import apiRouter from '../restapi';
import { StatusCodes } from 'http-status-codes';
import { translateError } from '../restapi/apiError';

const log = configuration.log.extend('restapi');

/**
 * Initializes the express app & returns it.
 * @returns - Initialized express app
 */
function initializeExpress(): Express {
  log('Initializing web service...');

  const app = express();

  app.use(compression());
  app.use(express.json());
  app.use(apiRouter);

  app.use((req: Request, res: Response, next: NextFunction) => {
    log('Unhandled web request: %s, %s', req.method, req.originalUrl);
    res.sendStatus(StatusCodes.NOT_FOUND);
  });
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    log(`REST API Error [${req.originalUrl}]: ${err}`);
    const apiError = translateError(err);
    res.statusCode = apiError.code;
    res.json(apiError);
  });

  return app;
}


/**
 * Starts up the REST API
 * @returns - Promise that resolves to the Express app.
 */
export async function startWebService(): Promise<Express> {
  const app = initializeExpress();

  return new Promise<Express>((resolve, reject) => {
    http.createServer(app).listen(configuration.httpPort, () => {
      log('Started listening for HTTP requests on port %d', configuration.httpPort);
      resolve(app);
    });
  });

}
