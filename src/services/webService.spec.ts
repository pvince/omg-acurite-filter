/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import express from 'express';
import { initializeExpress, startWebService, stopWebService } from './webService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('http') as typeof import('http');
const originalCreateServer = http.createServer;

function initializeExpressWithCapturedMiddleware(): {
  app: ReturnType<typeof initializeExpress>;
  middleware: Array<(...args: any[]) => unknown>;
} {
  const middleware: Array<(...args: any[]) => unknown> = [];
  const expressAny = express as any;
  const originalUse = expressAny.application.use;

  expressAny.application.use = function (...args: any[]) {
    for (const arg of args) {
      if (typeof arg === 'function') {
        middleware.push(arg);
      }
    }
    return originalUse.apply(this, args);
  };

  try {
    const app = initializeExpress();
    return { app, middleware };
  } finally {
    expressAny.application.use = originalUse;
  }
}

describe('webService', () => {
  afterEach(async () => {
    await stopWebService();
    http.createServer = originalCreateServer;
  });

  it('should initialize express app with expected middleware stack', () => {
    const { app, middleware } = initializeExpressWithCapturedMiddleware();

    expect(app).to.not.equal(undefined);
    expect(middleware.length).to.be.greaterThan(0);
  });

  it('should return not found for unmatched routes via fallback middleware', () => {
    const { middleware } = initializeExpressWithCapturedMiddleware();
    const notFoundMiddleware = middleware.find((fn) => fn.length === 3
      && fn.toString().includes('Unhandled web request'));

    expect(notFoundMiddleware).to.not.equal(undefined);

    let sentStatus = 0;
    const req = { method: 'GET', originalUrl: '/missing' } as any;
    const res = {
      sendStatus: (code: number) => {
        sentStatus = code;
      }
    } as any;

    (notFoundMiddleware as (req: unknown, res: unknown, next: () => void) => void)(req, res, () => undefined);

    expect(sentStatus).to.equal(404);
  });

  it('should map thrown errors to apiError payloads', () => {
    const { middleware } = initializeExpressWithCapturedMiddleware();
    const errorMiddleware = middleware.find((fn) => fn.length === 4);

    expect(errorMiddleware).to.not.equal(undefined);

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

    (errorMiddleware as (err: unknown, req: unknown, res: unknown, next: () => void) => void)(
      new Error('boom'),
      req,
      res,
      () => undefined
    );

    expect(statusCode).to.equal(500);
    expect(payload).to.deep.equal({ code: 500, message: 'boom' });
  });

  it('should start http server and resolve with express app', async () => {
    let listenedPort = 0;
    http.createServer = (((app: any) => ({
      close: (closeCb?: (err?: Error) => void) => {
        closeCb?.();
      },
      once: () => undefined,
      off: () => undefined,
      listen: (port: number, cb: () => void) => {
        listenedPort = port;
        cb();
        return undefined;
      },
      app
    })) as unknown) as typeof http.createServer;

    const app = await startWebService();

    expect(app).to.not.equal(undefined);
    expect(listenedPort).to.equal(2998);
  });

  it('should close the active http server during shutdown', async () => {
    let closeCount = 0;
    http.createServer = (((app: any) => ({
      close: (closeCb?: (err?: Error) => void) => {
        closeCount++;
        closeCb?.();
      },
      once: () => undefined,
      off: () => undefined,
      listen: (_port: number, cb: () => void) => {
        cb();
        return undefined;
      },
      app
    })) as unknown) as typeof http.createServer;

    await startWebService();
    await stopWebService();

    expect(closeCount).to.equal(1);
  });

  it('should preserve the active server when shutdown fails', async () => {
    let closeCount = 0;
    let shouldFailClose = true;
    http.createServer = (((app: any) => ({
      close: (closeCb?: (err?: Error) => void) => {
        closeCount++;
        if (shouldFailClose) {
          closeCb?.(new Error('close failed'));
        } else {
          closeCb?.();
        }
      },
      once: () => undefined,
      off: () => undefined,
      listen: (_port: number, cb: () => void) => {
        cb();
        return undefined;
      },
      app
    })) as unknown) as typeof http.createServer;

    await startWebService();

    try {
      await stopWebService();
      expect.fail('Expected stopWebService to throw');
    } catch (err) {
      expect((err as Error).message).to.equal('close failed');
    }

    shouldFailClose = false;
    await stopWebService();

    expect(closeCount).to.equal(2);
  });
});
