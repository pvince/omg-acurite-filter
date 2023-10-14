import 'dotenv/config';
import Debug from 'debug';

const UNSET = '<unset>';
const log = Debug("omg-acurite-filter");

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

  public get maxCacheAge(): number {
    return 5 * 60 * 1000;
  }

  public get log(): Debug.Debugger {
    return log;
  }
}

const configuration = new Configuration();

export default configuration;
