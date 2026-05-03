const { _resetForTesting, stopClient } = require('../mqtt/mqttComms');
const dataStore = require('../services/database/dataStore').default;
const { stopScheduler } = require('../services/jobScheduler');
const { messageForwardingService } = require('../services/messageForwardingService');
const { stopWebService } = require('../services/webService');

exports.mochaHooks = {
  async afterEach() {
    const errors = [];
    let mqttStopped = true;

    try {
      await stopWebService();
    } catch (err) {
      errors.push(err);
    }

    try {
      await stopClient();
    } catch (err) {
      mqttStopped = false;
      errors.push(err);
    }

    if (mqttStopped) {
      try {
        _resetForTesting();
      } catch (err) {
        errors.push(err);
      }
    }

    try {
      stopScheduler();
    } catch (err) {
      errors.push(err);
    }

    try {
      for (const job of messageForwardingService.jobEntries()) {
        job[1].stop();
      }
      messageForwardingService.messages?.clear?.();
      messageForwardingService.jobStore?.clear?.();
    } catch (err) {
      errors.push(err);
    }

    try {
      await dataStore.close();
    } catch (err) {
      errors.push(err);
    }

    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Mocha root teardown failed');
    }
  }
};