import 'dotenv/config';
import Debug from 'debug';
import { MS_IN_MINUTE } from '../constants';
import appRootPath from 'app-root-path';
import path from 'path';

const UNSET = '<unset>';
const log = Debug('omg-acurite-filter');

/**
 * Ensure that the MQTT topic ends in '/#'. Gracefully handles if an 'undefined' value is passed in.
 * @param topic - Topic to validate
 * @returns - The topic, ending in '/#' or undefined if undefined was provided as input.
 */
function _forceEndingHash(topic: string | undefined): string | undefined {
  let result = topic;
  if (topic !== undefined) {
    // Ensure the topic ends with /#
    if (!topic.endsWith('/#')) {
      if (!topic.endsWith('/')) {
        result += '/#';
      } else {
        result += '#';
      }
    }
  }
  return result;
}

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
    return _forceEndingHash(process.env.MQTT_SRC_TOPIC) ?? UNSET;
  }

  /**
   * Topic to forward messages too, defined by the environment variable MQTT_SRC_TOPIC. May contain MQTT topic wildcard
   * characters (+, #) but should not end in one.
   * @example 433_forwarded/forward/+/RTL_433toMQTT
   * @returns = MQTT topic
   */
  public get mqttDestTopic(): string {
    return _forceEndingHash(process.env.MQTT_DST_TOPIC) ?? UNSET;
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
   * Should we dump MQTT messages to a log file?
   */
  public readonly DUMP_MQTT_MSGS = false;

  /**
   * If we are dumping MQTT messages, what should the file be named?
   */

  public readonly MQTT_MSG_LOG_FILE = 'testData/mqtt_msgs.log';

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

  /**
   * HTTP port to use for the REST API.
   */
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  public readonly httpPort = 2998;

  /**
   * Root directory of the application.
   * @returns - Root directory of the application.
   */
  public get appDir(): string {
    return appRootPath.path;
  }

  /**
   * Directory to store application data.
   * @returns - Data directory
   */
  public get dataDir(): string {
    return path.join(this.appDir, 'data');
  }

  /**
   * Are we running in replay mode?
   */
  public isReplayMode = false;

  public dateOverride: Date | null = null;

  /**
   * Gets a 'new' date. If using a date override, returns that.
   * @returns - 'New' date.
   */
  public newDate(): Date {
    let result = this.dateOverride;
    if (!result) {
      result = new Date();
    }
    return result;
  }

  /**
   * Gets a 'new' date. If using a date override, returns that.
   * @returns - 'New' date.
   */
  public dateNow(): number {
    return this.newDate().getTime();
  }

  public throttleRateMinutes = 1;

  public get throttleRate(): number {
    return this.throttleRateMinutes * MS_IN_MINUTE;
  }
}

const configuration = new Configuration();

export default configuration;
