import { expect } from 'chai';
import { describe, it } from 'mocha';
import { getScheduler, stopScheduler } from './jobScheduler';

describe('jobScheduler', () => {
  it('should return the same scheduler instance across calls', () => {
    const schedulerA = getScheduler();
    const schedulerB = getScheduler();

    expect(schedulerA).to.equal(schedulerB);
  });

  it('should stop scheduler without throwing', () => {
    getScheduler();
    expect(() => stopScheduler()).to.not.throw();
  });
});
