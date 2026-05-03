/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import configuration from './configuration';
import msgLog from './msgLog';

describe('msgLog', () => {
  beforeEach(() => {
    // Drain any existing messages
    (msgLog as any).messages.length = 0;
    configuration.dateOverride = null;
  });

  afterEach(() => {
    (msgLog as any).messages.length = 0;
    configuration.dateOverride = null;
  });

  describe('add', () => {
    it('should append a message to the log', () => {
      msgLog.add('device1', 'temperature spike');
      const msgs = msgLog.getMsgs();
      expect(msgs).to.have.length(1);
      expect(msgs[0].device_id).to.equal('device1');
      expect(msgs[0].msg).to.equal('temperature spike');
    });

    it('should record a timestamp close to now', () => {
      const before = Date.now();
      msgLog.add('device2', 'test');
      const after = Date.now();
      const ts = msgLog.getMsgs()[0].timestamp.getTime();
      expect(ts).to.be.within(before, after);
    });

    it('should accumulate multiple messages', () => {
      msgLog.add('d1', 'first');
      msgLog.add('d2', 'second');
      expect(msgLog.getMsgs()).to.have.length(2);
    });
  });

  describe('getMsgs', () => {
    it('should return empty array when no messages have been logged', () => {
      expect(msgLog.getMsgs()).to.deep.equal([]);
    });

    it('should purge messages older than LOG_DURATION when called', () => {
      // Set time so old messages are visible
      const now = new Date('2026-01-10T12:00:00Z');
      configuration.dateOverride = now;

      // Add a message timestamped far in the past (3 days old)
      const oldEntry = {
        timestamp: new Date('2026-01-07T12:00:00Z'),
        device_id: 'old-device',
        msg: 'stale',
      };
      (msgLog as any).messages.push(oldEntry);
      // Also reset lastPurged to force purge
      (msgLog as any).lastPurged = new Date(0);

      // Add a recent message
      msgLog.add('new-device', 'fresh');

      const result = msgLog.getMsgs();
      expect(result.every((m: any) => m.device_id !== 'old-device')).to.be.true;
      expect(result.some((m: any) => m.device_id === 'new-device')).to.be.true;
    });
  });

  describe('remove_stale_data', () => {
    it('should not purge when the message list is empty', () => {
      // No throw, no state change
      (msgLog as any).remove_stale_data();
    });

    it('should not purge when not enough time has elapsed since last purge', () => {
      // lastPurged = now → purge interval not yet reached
      const now = new Date('2026-01-10T12:00:00Z');
      configuration.dateOverride = now;
      (msgLog as any).lastPurged = now;

      const entry = {
        timestamp: new Date('2026-01-01T00:00:00Z'),
        device_id: 'old',
        msg: 'stale',
      };
      (msgLog as any).messages.push(entry);

      (msgLog as any).remove_stale_data();

      // Message should still be there (purge was skipped)
      expect((msgLog as any).messages).to.have.length(1);
    });
  });
});
