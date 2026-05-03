/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import configuration from './services/configuration';
import { messageForwardingService } from './services/messageForwardingService';
import { mqttStats } from './services/statistics/passiveStatistics';

function requireApp(): typeof import('./app') {
  configuration.isReplayMode = true;
  delete require.cache[require.resolve('./app')];
  return require('./app');
}

describe('app processTopic', () => {
  const originalThrottleMessage = messageForwardingService.throttleMessage;
  const originalForwardMessage = messageForwardingService.forwardMessage;
  const originalReplayMode = configuration.isReplayMode;

  beforeEach(() => {
    configuration.isReplayMode = true;
  });

  afterEach(() => {
    messageForwardingService.throttleMessage = originalThrottleMessage;
    messageForwardingService.forwardMessage = originalForwardMessage;
    configuration.isReplayMode = originalReplayMode;
  });

  it('should forward unknown message types via throttleMessage', () => {
    const app = requireApp();

    const beforeUnknown = mqttStats.received.unknown;
    let forwardedTopic = '';
    let forwardedMsg: any = null;

    messageForwardingService.throttleMessage = (topic: string, msg: any) => {
      forwardedTopic = topic;
      forwardedMsg = msg;
    };

    app.processTopic('unknown/topic', Buffer.from('{"foo":"bar"}', 'utf8'));

    expect(forwardedTopic).to.equal('unknown/topic');
    expect(forwardedMsg.topic).to.equal('unknown/topic');
    expect(forwardedMsg.message).to.equal('{"foo":"bar"}');
    expect(mqttStats.received.unknown).to.equal(beforeUnknown + 1);
  });

  it('should forward unparseable payloads through forwardMessage', () => {
    const app = requireApp();

    const beforeUnparseable = mqttStats.received.unparseable;
    let forwarded: any = null;

    messageForwardingService.forwardMessage = async (msg: any) => {
      forwarded = msg;
    };

    app.processTopic('bad/topic', Buffer.from('{bad-json', 'utf8'));

    expect(forwarded).to.deep.equal({ topic: 'bad/topic', message: '{bad-json' });
    expect(mqttStats.received.unparseable).to.equal(beforeUnparseable + 1);
  });
});
