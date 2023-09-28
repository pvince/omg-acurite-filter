
import * as mqttComms from './mqtt/mqttComms';
import configuration from './services/configuration';

async function startMQTT(): Promise<void> {
  await mqttComms.startClient(configuration.mqttHost, {
    username: configuration.mqttUser,
    password: configuration.mqttPass
  });
}

function printTopic(message: Buffer) {
  const jsonConfig = message.toString();
  console.log(jsonConfig);
}

async function subscribe(): Promise<void> {
  if (mqttComms.isConnected()) {
    await mqttComms.subscribe(configuration.mqttSrcTopic + "/#", printTopic);
  }
}

async function startup(): Promise<void> {
  console.log("Starting MQTT client");
  await startMQTT();

  console.log("Subscribing...");
  await subscribe();
}

startup()
  .catch((err) => {
    console.error(`Error: ${err}`);
  });

