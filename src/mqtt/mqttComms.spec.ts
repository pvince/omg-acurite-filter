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

    it('should remove a callback from the local cache when broker subscribe fails', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let receivedCount = 0;
      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        throw new Error('subscribe failed');
      };

      try {
        await mqttComms.subscribe('test/topic', () => {
          receivedCount++;
        });
        expect.fail('Expected subscribe to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('subscribe failed');
      }

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(receivedCount).to.equal(0);
    });

    it('should preserve an existing callback when a later subscribe retry for the same topic fails', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let originalReceivedCount = 0;
      let replacementReceivedCount = 0;

      await mqttComms.subscribe('test/topic', () => {
        originalReceivedCount++;
      });

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        throw new Error('subscribe failed');
      };

      try {
        await mqttComms.subscribe('test/topic', () => {
          replacementReceivedCount++;
        });
        expect.fail('Expected subscribe to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('subscribe failed');
      }

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(originalReceivedCount).to.equal(1);
      expect(replacementReceivedCount).to.equal(0);
    });

    it('should keep the existing callback active while a same-topic resubscribe is pending', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let originalReceivedCount = 0;
      let replacementReceivedCount = 0;
      let rejectSubscribe = (_err: Error): void => {
        throw new Error('rejectSubscribe was not set');
      };

      await mqttComms.subscribe('test/topic', () => {
        originalReceivedCount++;
      });

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((_resolve, reject) => {
          rejectSubscribe = reject;
        });
      };

      const subscribePromise = mqttComms.subscribe('test/topic', () => {
        replacementReceivedCount++;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      rejectSubscribe(new Error('subscribe failed'));

      try {
        await subscribePromise;
        expect.fail('Expected subscribe to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('subscribe failed');
      }

      expect(originalReceivedCount).to.equal(1);
      expect(replacementReceivedCount).to.equal(0);
    });

    it('should serialize concurrent same-topic replacements so a later failure restores the last successful callback', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let originalReceivedCount = 0;
      let replacementOneReceivedCount = 0;
      let replacementTwoReceivedCount = 0;
      const subscribeResolvers: Array<() => void> = [];
      const subscribeRejecters: Array<(err: Error) => void> = [];

      await mqttComms.subscribe('test/topic', () => {
        originalReceivedCount++;
      });

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((resolve, reject) => {
          subscribeResolvers.push(resolve);
          subscribeRejecters.push(reject);
        });
      };

      const replacementOnePromise = mqttComms.subscribe('test/topic', () => {
        replacementOneReceivedCount++;
      });
      const replacementTwoPromise = mqttComms.subscribe('test/topic', () => {
        replacementTwoReceivedCount++;
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      subscribeResolvers[0]();
      await replacementOnePromise;

      await new Promise((resolve) => setTimeout(resolve, 0));
      subscribeRejecters[1](new Error('subscribe failed'));

      try {
        await replacementTwoPromise;
        expect.fail('Expected second replacement to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('subscribe failed');
      }

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(originalReceivedCount).to.equal(0);
      expect(replacementOneReceivedCount).to.equal(1);
      expect(replacementTwoReceivedCount).to.equal(0);
    });

    it('should allow a queued same-topic subscribe to proceed after its predecessor fails', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let receivedCount = 0;
      const subscribeRejecters: Array<(err: Error) => void> = [];
      const subscribeResolvers: Array<() => void> = [];

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((resolve, reject) => {
          subscribeResolvers.push(resolve);
          subscribeRejecters.push(reject);
        });
      };

      const firstSubscribe = mqttComms.subscribe('test/topic', () => { /* no-op */ });
      const secondSubscribe = mqttComms.subscribe('test/topic', () => {
        receivedCount++;
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      subscribeRejecters[0](new Error('subscribe failed'));

      try {
        await firstSubscribe;
        expect.fail('Expected first subscribe to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('subscribe failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
      subscribeResolvers[1]();
      await secondSubscribe;

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(receivedCount).to.equal(1);
    });

    it('should clear pending same-topic subscribe queue state during test reset', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let releaseFirstSubscribe = (): void => {
        throw new Error('releaseFirstSubscribe was not set');
      };

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((resolve) => {
          releaseFirstSubscribe = resolve;
        });
      };

      const firstSubscribe = mqttComms.subscribe('test/topic', () => { /* no-op */ });
      await new Promise((resolve) => setTimeout(resolve, 0));

      (mqttComms as any)._resetForTesting();

      const secondClient = new MockMqttClient();
      mqttComms._deps.connectAsync = async () => secondClient as any;
      await mqttComms.startClient('mqtt://localhost');
      const secondSubscribe = mqttComms.subscribe('test/topic', () => { /* no-op */ });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(secondClient.subscribeAsyncCalls).to.deep.equal(['test/topic']);

      releaseFirstSubscribe();
      await firstSubscribe;
      await secondSubscribe;
    });

    it('should not let a stale replacement subscribe overwrite the cache after test reset', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let originalReceivedCount = 0;
      let replacementReceivedCount = 0;
      let resetReceivedCount = 0;
      let releaseReplacementSubscribe = (): void => {
        throw new Error('releaseReplacementSubscribe was not set');
      };

      await mqttComms.subscribe('test/topic', () => {
        originalReceivedCount++;
      });

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((resolve) => {
          releaseReplacementSubscribe = resolve;
        });
      };

      const replacementSubscribe = mqttComms.subscribe('test/topic', () => {
        replacementReceivedCount++;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      (mqttComms as any)._resetForTesting();

      const secondClient = new MockMqttClient();
      mqttComms._deps.connectAsync = async () => secondClient as any;
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => {
        resetReceivedCount++;
      });

      releaseReplacementSubscribe();
      await replacementSubscribe;

      secondClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(originalReceivedCount).to.equal(0);
      expect(replacementReceivedCount).to.equal(0);
      expect(resetReceivedCount).to.equal(1);
    });

    it('should not let a stale replacement rollback overwrite the cache after test reset', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let originalReceivedCount = 0;
      let replacementReceivedCount = 0;
      let resetReceivedCount = 0;
      let rejectReplacementSubscribe = (_err: Error): void => {
        throw new Error('rejectReplacementSubscribe was not set');
      };

      await mqttComms.subscribe('test/topic', () => {
        originalReceivedCount++;
      });

      mockClient.subscribeAsync = async (topic: string) => {
        mockClient.subscribeAsyncCalls.push(topic);
        await new Promise<void>((_resolve, reject) => {
          rejectReplacementSubscribe = reject;
        });
      };

      const replacementSubscribe = mqttComms.subscribe('test/topic', () => {
        replacementReceivedCount++;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      (mqttComms as any)._resetForTesting();

      const secondClient = new MockMqttClient();
      mqttComms._deps.connectAsync = async () => secondClient as any;
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => {
        resetReceivedCount++;
      });

      rejectReplacementSubscribe(new Error('subscribe failed'));
      await replacementSubscribe.catch(() => undefined);

      secondClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(originalReceivedCount).to.equal(0);
      expect(replacementReceivedCount).to.equal(0);
      expect(resetReceivedCount).to.equal(1);
    });
  });

  describe('unsubscribe', () => {
    it('should call broker unsubscribeAsync for the topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      await mqttComms.subscribe('test/topic', () => { /* no-op */ });
      await mqttComms.unsubscribe('test/topic');
      expect(mockClient.unsubscribeAsyncCalls).to.include('test/topic');
    });

    it('should remove the local callback even when broker unsubscribe fails', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let receivedCount = 0;
      await mqttComms.subscribe('test/topic', () => {
        receivedCount++;
      });
      mockClient.unsubscribeAsync = async (topic: string) => {
        mockClient.unsubscribeAsyncCalls.push(topic);
        throw new Error('unsubscribe failed');
      };

      try {
        await mqttComms.unsubscribe('test/topic');
        expect.fail('Expected unsubscribe to fail');
      } catch (err) {
        expect((err as Error).message).to.equal('unsubscribe failed');
      }

      mockClient.emit('message', 'test/topic', Buffer.from('{}'));

      expect(receivedCount).to.equal(0);
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

    it('should pass publish packet metadata to subscribers', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let retainFlag: boolean | undefined;
      await mqttComms.subscribe('test/topic', (_topic, _message, packet) => {
        retainFlag = packet?.retain;
      });
      mockClient.emit('message', 'test/topic', Buffer.from('{}'), { retain: true });
      expect(retainFlag).to.equal(true);
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

    it('should dispatch to wildcard subscriber when the matched segment contains hyphens', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let received = '';
      await mqttComms.subscribe('devices/+/data', (topic) => { received = topic; });
      mockClient.emit('message', 'devices/sensor-1/data', Buffer.from('{}'));
      expect(received).to.equal('devices/sensor-1/data');
    });

    it('should dispatch to wildcard subscriber when the matched segment is empty', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let received = '';
      await mqttComms.subscribe('devices/+/data', (topic) => { received = topic; });
      mockClient.emit('message', 'devices//data', Buffer.from('{}'));
      expect(received).to.equal('devices//data');
    });

    it('should dispatch one retained message to both exact and wildcard subscribers', async () => {
      await mqttComms.startClient('mqtt://localhost');
      const seen: string[] = [];
      await mqttComms.subscribe('homeassistant/sensor/#', (topic, _message, packet) => {
        seen.push(`wildcard:${topic}:${String(packet?.retain)}`);
      });
      await mqttComms.subscribe('homeassistant/sensor/device/config', (topic, _message, packet) => {
        seen.push(`exact:${topic}:${String(packet?.retain)}`);
      });

      mockClient.emit('message', 'homeassistant/sensor/device/config', Buffer.from('{}'), { retain: true });

      expect(seen).to.deep.equal([
        'wildcard:homeassistant/sensor/device/config:true',
        'exact:homeassistant/sensor/device/config:true'
      ]);
    });

    it('should dispatch a hash wildcard subscriber on the bare prefix topic', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let received = false;
      await mqttComms.subscribe('homeassistant/sensor/#', () => {
        received = true;
      });

      mockClient.emit('message', 'homeassistant/sensor', Buffer.from('{}'));

      expect(received).to.equal(true);
    });

    it('should not dispatch a wildcard subscriber on a substring-only topic match', async () => {
      await mqttComms.startClient('mqtt://localhost');
      let received = false;
      await mqttComms.subscribe('devices/+/data', () => {
        received = true;
      });

      mockClient.emit('message', 'prefix/devices/sensor/data/suffix', Buffer.from('{}'));

      expect(received).to.equal(false);
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

    it('should throw when client is null', async () => {
      try {
        await mqttComms.clearTopic('test/retain');
        expect.fail('Expected clearTopic to throw');
      } catch (err) {
        expect((err as Error).message).to.contain('MQTT Client is not initialized');
      }
    });
  });
});
