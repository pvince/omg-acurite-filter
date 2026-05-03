import { describe, it } from 'mocha';
import configuration from '../../services/configuration';
import dataStore from '../../services/database/dataStore';
import { getScheduler } from '../../services/jobScheduler';
import { messageForwardingService } from '../../services/messageForwardingService';
import { startWebService } from '../../services/webService';

describe('no-exit smoke fixture', () => {
  it('should create long-lived resources', async () => {
    (configuration as any).httpPort = 0;
    await dataStore.initialize();
    configuration.isReplayMode = true;
    getScheduler();
    messageForwardingService.throttleMessage('fixture-device', { topic: 'fixture/topic', message: '{}', data: {} } as any);
    await startWebService();
  });
});