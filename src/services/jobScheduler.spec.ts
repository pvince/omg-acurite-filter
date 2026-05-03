import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { getScheduler, stopScheduler } from './jobScheduler';

describe('jobScheduler', () => {
  afterEach(() => {
    stopScheduler();
  });

  it('should return the same scheduler instance across calls', () => {
    const schedulerA = getScheduler();
    const schedulerB = getScheduler();

    expect(schedulerA).to.equal(schedulerB);
  });

  it('should stop scheduler without throwing', () => {
    getScheduler();
    expect(() => stopScheduler()).to.not.throw();
  });

  it('should create a new scheduler after stop', () => {
    const schedulerA = getScheduler();

    stopScheduler();

    const schedulerB = getScheduler();

    expect(schedulerB).to.not.equal(schedulerA);
  });
});
