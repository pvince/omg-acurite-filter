/* eslint-disable @typescript-eslint/no-magic-numbers */
import { EventEmitter } from 'events';
import { expect } from 'chai';
import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import * as mqttComms from './mqttComms';

/**
 * Minimal mock of MqttClient used in tests. Extends EventEmitter so that
 * `on('message', ...)` and `emit('message', ...)` work without a real broker.
 */
class MockMqttClient extends EventEmitter {
  /** Whether the client reports itself as connected. */
  public connected = true;

  /** Arguments passed to each subscribeAsync call. */
  public readonly subscribeAsyncCalls: string[] = [];

  /** Arguments passed to each unsubscribeAsync call. */
  public readonly unsubscribeAsyncCalls: string[] = [];

  /** Arguments passed to each publishAsync call. */
  public readonly publishAsyncCalls: Array<{ topic: string; msg: string; opts?: object }> = [];

  /** Whether endAsync has been invoked. */
  public endAsyncCalled = false;

  /** Total number of times endAsync has been invoked. */
  public endAsyncCallCount = 0;

  /** @param topic - topic to subscribe to */
  public async subscribeAsync(topic: string): Promise<void> {
    this.subscribeAsyncCalls.push(topic);
  }

  /** @param topic - topic to unsubscribe from */
  public async unsubscribeAsync(topic: string): Promise<void> {
    this.unsubscribeAsyncCalls.push(topic);
  }

  /**
   * @param topic - topic to publish to
   * @param msg - message payload
   * @param opts - publish options
   */
  public async publishAsync(topic: string, msg: string, opts?: object): Promise<void> {
    this.publishAsyncCalls.push({ topic, msg, opts });
  }

  /** Marks client as disconnected. */
  public async endAsync(): Promise<void> {
    this.endAsyncCalled = true;
    this.endAsyncCallCount++;
    this.connected = false;
  }
}

describe('mqttComms', () => {
  let mockClient: MockMqttClient;
  let originalConnectAsync: unknown;

  before(() => {
    originalConnectAsync = mqttComms._deps.connectAsync;
  });

  after(() => {
    mqttComms._deps.connectAsync = originalConnectAsync as typeof mqttComms._deps.connectAsync;
    (mqttComms as any)._resetForTesting();
  });

  beforeEach(() => {
    mockClient = new MockMqttClient();
    mqttComms._deps.connectAsync = async () => mockClient as any;
    (mqttComms as any)._resetForTesting();
  });

  afterEach(() => {
    (mqttComms as any)._resetForTesting();
  });

  describe('startClient', () => {
    it('should initialize client and report as connected', async () => {
      await mqttComms.startClient('mqtt://localhost');
      expect(mqttComms.isConnected()).to.be.true;
    });

    it('should handle connection failure without throwing', async () => {
      mqttComms._deps.connectAsync = async () => { throw new Error('connection refused'); };
      await mqttComms.startClient('mqtt://badhost');
      expect(mqttComms.isConnected()).to.be.false;
    });
  });

  describe('stopClient', () => {
    it('should call endAsync on the client', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.stopClient();
      expect(mockClient.endAsyncCalled).to.be.true;
    });

    it('should clear the client after stopping so repeated shutdown is safe', async () => {
      await mqttComms.startClient('mqtt://localhost');

      await mqttComms.stopClient();
      await mqttComms.stopClient();

      expect(mockClient.endAsyncCallCount).to.equal(1);
      expect(mqttComms.isConnected()).to.be.false;
    });

    it('should keep the client when shutdown fails so teardown can retry', async () => {
      await mqttComms.startClient('mqtt://localhost');
      mockClient.endAsync = async () => {
        mockClient.endAsyncCallCount++;
        throw new Error('shutdown failed');
      };

      try {
        await mqttComms.stopClient();
        expect.fail('Expected stopClient to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('shutdown failed');
      }

      expect(mqttComms.isConnected()).to.be.true;
      expect(mockClient.endAsyncCallCount).to.equal(1);
    });

    it('should not throw when no client is initialized', async () => {
      await mqttComms.stopClient();
    });
  });

  describe('isConnected', () => {
    it('should return false when client is null', () => {
      expect(mqttComms.isConnected()).to.be.false;
    });

    it('should reflect client.connected state', async () => {
      await mqttComms.startClient('mqtt://localhost');
      expect(mqttComms.isConnected()).to.be.true;
      mockClient.connected = false;
      expect(mqttComms.isConnected()).to.be.false;
    });
  });

  describe('subscribe', () => {
    it('should call broker subscribeAsync for the topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => { /* no-op */ });
      expect(mockClient.subscribeAsyncCalls).to.include('test/topic');
    });

    it('should throw when client is not initialized', async () => {
      let threwError = false;
      try {
        await mqttComms.subscribe('test/topic', () => { /* no-op */ });
      } catch (e) {
        threwError = true;
        expect((e as Error).message).to.contain('MQTT Client is not initialized');
      }
      expect(threwError).to.be.true;
    });
  });

  describe('unsubscribe', () => {
    it('should call broker unsubscribeAsync for the topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => { /* no-op */ });
      await mqttComms.unsubscribe('test/topic');
      expect(mockClient.unsubscribeAsyncCalls).to.include('test/topic');
    });
  });

  describe('publish', () => {
    it('should JSON-stringify objects before publishing', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.publish('test/topic', { temp: 25 });
      expect(mockClient.publishAsyncCalls).to.have.length(1);
      expect(mockClient.publishAsyncCalls[0].msg).to.equal('{"temp":25}');
    });

    it('should pass strings through without double-stringification', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.publish('test/topic', 'raw string');
      expect(mockClient.publishAsyncCalls[0].msg).to.equal('raw string');
    });

    it('should increment mqttStats.sent.total on publish', async () => {
      await mqttComms.startClient('mqtt://localhost');
      // Require inline to access live module state
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const stats = require('../services/statistics/passiveStatistics');
      const before: number = stats.mqttStats.sent.total;
      await mqttComms.publish('test/topic', {});
      expect(stats.mqttStats.sent.total).to.equal(before + 1);
    });
  });

  describe('message dispatch', () => {
    it('should invoke registered callback for matching topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let receivedTopic = '';
      await mqttComms.subscribe('test/topic', (topic) => { receivedTopic = topic; });
      mockClient.emit('message', 'test/topic', Buffer.from('{}'));
      expect(receivedTopic).to.equal('test/topic');
    });

    it('should not throw when no subscription matches incoming topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      mockClient.emit('message', 'unknown/topic', Buffer.from('{}'));
    });

    it('should catch errors thrown by subscriber callbacks', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => { throw new Error('callback error'); });
      mockClient.emit('message', 'test/topic', Buffer.from('{}'));
    });

    it('should dispatch to wildcard subscriber', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let received = '';
      await mqttComms.subscribe('devices/+/data', (topic) => { received = topic; });
      mockClient.emit('message', 'devices/sensor1/data', Buffer.from('{}'));
      expect(received).to.equal('devices/sensor1/data');
    });
  });

  describe('clearTopic', () => {
    it('should publish an empty retained message', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.clearTopic('test/retain');
      expect(mockClient.publishAsyncCalls).to.have.length(1);
      const call = mockClient.publishAsyncCalls[0];
      expect(call.topic).to.equal('test/retain');
      expect(call.msg).to.equal('');
      expect(call.opts).to.deep.equal({ retain: true });
    });

    it('should not throw when client is null', async () => {
      await mqttComms.clearTopic('test/retain');
    });
  });
});
