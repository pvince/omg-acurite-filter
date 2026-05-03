import configuration from './configuration';
import express, { Express, Request, Response, NextFunction } from 'express';
import compression from 'compression';
import * as http from 'http';
import apiRouter from '../restapi';
import { StatusCodes } from 'http-status-codes';
import { translateError } from '../restapi/apiError';

const log = configuration.log.extend('restapi');
let server: http.Server | null = null;
let serverApp: Express | null = null;
let startupPromise: Promise<Express> | null = null;

/**
 * Initializes the express app & returns it.
 * @returns - Initialized express app
 */
export function initializeExpress(): Express {
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
  if (server !== null && serverApp !== null) {
    return serverApp;
  }

  if (startupPromise !== null) {
    return startupPromise;
  }

  const app = initializeExpress();

  const httpServer = http.createServer(app);
  server = httpServer;

  const pendingStartup = new Promise<Express>((resolve, reject) => {
    const onError = (err: Error): void => {
      httpServer.off('error', onError);
      server = null;
      serverApp = null;
      reject(err);
    };

    httpServer.once('error', onError);
    httpServer.listen(configuration.httpPort, () => {
      httpServer.off('error', onError);
      serverApp = app;
      log('Started listening for HTTP requests on port %d', configuration.httpPort);
      resolve(app);
    });
  });

  let trackedStartup: Promise<Express>;
  trackedStartup = pendingStartup.finally(() => {
    if (startupPromise === trackedStartup) {
      startupPromise = null;
    }
  });
  startupPromise = trackedStartup;
  return trackedStartup;

}

/**
 * Stops the REST API server if it is running.
 * @returns - Promise that resolves once shutdown completes.
 */
export async function stopWebService(): Promise<void> {
  if (server === null) {
    serverApp = null;
    return;
  }

  const httpServer = server;
  const app = serverApp;
  server = null;
  serverApp = null;

  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    server = httpServer;
    serverApp = app;
    throw err;
  }
}
