/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import { initializeExpress, startWebService } from './webService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('http') as typeof import('http');
const originalCreateServer = http.createServer;

describe('webService', () => {
  afterEach(() => {
    http.createServer = originalCreateServer;
  });

  it('should initialize express app with expected middleware stack', () => {
    const app = initializeExpress();
    const stack = (app as any)._router?.stack ?? [];

    expect(stack.length).to.be.greaterThan(0);
  });

  it('should return not found for unmatched routes via fallback middleware', () => {
    const app = initializeExpress();
    const stack = (app as any)._router?.stack ?? [];
    const notFoundLayer = stack.find((layer: any) =>
      typeof layer.handle === 'function' && layer.handle.length === 3
      && layer.handle.toString().includes('Unhandled web request'));

    expect(notFoundLayer).to.not.equal(undefined);

    let sentStatus = 0;
    const req = { method: 'GET', originalUrl: '/missing' } as any;
    const res = {
      sendStatus: (code: number) => {
        sentStatus = code;
      }
    } as any;

    notFoundLayer.handle(req, res, () => undefined);

    expect(sentStatus).to.equal(404);
  });

  it('should map thrown errors to apiError payloads', () => {
    const app = initializeExpress();
    const stack = (app as any)._router?.stack ?? [];
    const errorLayer = stack.find((layer: any) => typeof layer.handle === 'function' && layer.handle.length === 4);

    expect(errorLayer).to.not.equal(undefined);

    let statusCode = 0;
    let payload: unknown = null;
    const req = { originalUrl: '/api/v1/data' } as any;
    const res = {
      statusCode: 0,
      json: (obj: unknown) => {
        statusCode = (res as any).statusCode;
        payload = obj;
      }
    } as any;

    errorLayer.handle(new Error('boom'), req, res, () => undefined);

    expect(statusCode).to.equal(500);
    expect(payload).to.deep.equal({ code: 500, message: 'boom' });
  });

  it('should start http server and resolve with express app', async () => {
    let listenedPort = 0;
    http.createServer = (((app: any) => ({
      listen: (port: number, cb: () => void) => {
        listenedPort = port;
        cb();
        return { close: () => undefined };
      },
      app
    })) as unknown) as typeof http.createServer;

    const app = await startWebService();

    expect(app).to.not.equal(undefined);
    expect(listenedPort).to.equal(2998);
  });
});
