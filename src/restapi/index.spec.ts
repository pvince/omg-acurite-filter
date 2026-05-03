import { expect } from 'chai';
import { describe, it } from 'mocha';
import apiRouter from './index';

describe('apiRouter', () => {
  it('should mount all API sub-routers under /api', () => {
    const stack = (apiRouter as any).stack as Array<{ route?: { path?: string }; name?: string }>;

    const paths = stack
      .filter((entry) => entry.route && entry.route.path)
      .map((entry) => entry.route?.path);

    expect(paths).to.deep.equal([]);
    expect(stack.length).to.equal(5);
    stack.forEach((entry) => {
      expect(entry.name).to.equal('router');
    });
  });
});
