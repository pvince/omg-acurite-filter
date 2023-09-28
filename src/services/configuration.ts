import 'dotenv/config';

const UNSET = '<unset>';

class Configuration {
  public get mqttHost(): string {
    return process.env.MQTT_HOST ?? UNSET;
  }

  public get mqttUser(): string {
    return process.env.MQTT_USER ?? UNSET;
  }

  public get mqttPass(): string {
    return process.env.MQTT_PASS ?? UNSET;
  }

  public get mqttSrcTopic(): string {
    return process.env.MQTT_SRC_TOPIC ?? UNSET;
  }

  public get isDebug(): boolean {
    return process.env.ISDEBUG === 'true';
  }
}

const configuration = new Configuration();

export default configuration;
