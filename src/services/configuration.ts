import 'dotenv/config';
import Debug from 'debug';
import { MS_IN_MINUTE } from '../constants';

const UNSET = '<unset>';
const log = Debug('omg-acurite-filter');

/**
 * Configuration class
 */
class Configuration {
  /**
   * MQTT Host name, defined by the environment variable MQTT_HOST
   * @example mqtt://192.168.1.15
   * @returns = MQTT host name
   */
  public get mqttHost(): string {
    return process.env.MQTT_HOST ?? UNSET;
  }

  /**
   * MQTT username, defined by the environment variable MQTT_USER
   * @example mqtt_username
   * @returns = MQTT username
   */
  public get mqttUser(): string {
    return process.env.MQTT_USER ?? UNSET;
  }

  /**
   * MQTT user's password, defined by the environment variable MQTT_PASS
   * @example MySweetPassword
   * @returns = MQTT user's password
   */
  public get mqttPass(): string {
    return process.env.MQTT_PASS ?? UNSET;
  }

  /**
   * Topic to subscribe too, defined by the environment variable MQTT_SRC_TOPIC. May contain MQTT topic wildcard
   * characters (+, #) but should not end in one.
   * @example 433_direct/+/RTL_433toMQTT
   * @returns = MQTT topic
   */
  public get mqttSrcTopic(): string {
    return process.env.MQTT_SRC_TOPIC ?? UNSET;
  }

  /**
   * Is the service running in debug mode? ISDEBUG env variable.
   * @example true
   * @returns = True if the service is running in debug mode.
   */
  public get isDebug(): boolean {
    return process.env.ISDEBUG === 'true';
  }

  /**
   * Maximum length of time a MQTT message is kept in cache in milliseconds.
   * Default is 5 minutes.
   * @returns = Length of time a MQTT message is kept in cache in milliseconds.
   */
  public get maxCacheAge(): number {
    const MAX_CACHE_AGE = 5;
    return MAX_CACHE_AGE * MS_IN_MINUTE;
  }

  /**
   * Application wide root logging object.
   * @returns - Returns the logging object
   */
  public get log(): Debug.Debugger {
    return log;
  }

  /**
   * Valid temperature range in degrees Celsius (considered valid if new value is +- by this setting)
   */
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  public readonly validTemperatureRange = 2.5;

  /**
   * Valid humidity range in percentages (considered valid if new value is +- by this setting)
   */
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  public readonly validHumidityRange = 10;

}

const configuration = new Configuration();

export default configuration;
