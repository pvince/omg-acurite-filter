/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import configuration from '../configuration';
import { RateMeter } from './rateMeter';

describe('RateMeter', () => {
  afterEach(() => {
    configuration.dateOverride = null;
  });

  it('should report zero rates when there are no marks', () => {
    const meter = new RateMeter();

    expect(meter.getRatePerSecond()).to.equal(0);
    expect(meter.getRatePerMinute()).to.equal(0);
  });

  it('should compute rates from marks in current window', () => {
    const meter = new RateMeter() as any;
    meter.marks.push(new Date('2026-01-01T00:00:00.000Z'));
    meter.marks.push(new Date('2026-01-01T00:01:00.000Z'));

    configuration.dateOverride = new Date('2026-01-01T00:02:00.000Z');

    expect(meter.getRatePerMinute()).to.equal(1);
    expect(meter.getRatePerSecond()).to.equal(0.02);
  });

  it('should age out marks older than default period', () => {
    const meter = new RateMeter() as any;
    meter.marks.push(new Date('2026-01-01T00:00:00.000Z'));
    meter.marks.push(new Date('2026-01-01T00:04:00.000Z'));

    configuration.dateOverride = new Date('2026-01-01T00:10:00.000Z');

    expect(meter.getRatePerMinute()).to.equal(0);
    expect(meter.getRatePerSecond()).to.equal(0);
  });
});
