# Background

# Requirements
* Gather in MQTT messages for specific types of messages.
* Save the last X minutes of data.
* Compare the most recent data to the last X minutes of data. If the data seems 'unusual' discard the message.
  * Define "unusual"
    * Simple: 
      * Temperature is + / - 2.5 C of the last received temperature
      * Humidity is + / - 5% of the last received temperature.
      * Each time we receive a reading, we discard any values more than X minutes old.
      * If we have no saved readings, then the reading is automatically valid.
      * This means that if...
        * We don't typically receive a reading, it will automatically be considered valid. Mixed bag here. This also means
          that weak signals (the most likely to be corrupt) will be more likely to be forwarded
        * If we receive a reading that seems wacky (but is actually valid) it will auto-correct after 5 minutes.
        * If we log a wacky value as the 'valid' reading, it will auto-correct after 5 minutes.
* Every Y seconds, send the 'latest' valid data reading 
  * Only send _new_ readings though, if we already sent it, flag it as such.

# Enhancement ideas
* Monitor memory usage. If it goes beyond X, auto-restart the service
* Save stats:
  * Invalid Readings Stats
    * Prev reading - Invalid Reading
    * Date//Time of bad reading
    * Age out individual readings?
    * Total # per device per receiver
* REST API?
  * Stats?
* Setup PM2 service on VM


# Other validation ideas
* Many times we receive multiple copies of the same message, each from a different receiver.
  * The messages arrive nearly simultaneously. 
    * Maybe we store any messages received in the last X ms into a special buffer?
    * We could look back in the buffer for messages received in the last X milliseconds.
    * When sending messages via our scheduler, we could ignore very recently received messages to allow msg validation
      to fully run, but this would complicate the send logic.
  * All messages in the buffer should be equal. 
    * If we have 3+ messages, we can throw out the odd one.
    * What do we do when we have 2 messages, and one doesn't agree?
    * `[]` = All message buffer
    * `()` = Within last 100 ms
    * `{t-Xs}` = Message received X seconds ago
    * `[ 66 {t-15s}, 66 {t-15s}, 66.1 {t-10s}, (63.6, 66.1) ]`
      * This looks suspicious, `0 → 0.1 → -2.5 → 2.5`
      * We could:
        * Drop both messages? Would only require 2 receivers to do error elimination
          * 63.6
          * 63.6, 66.1
          * ~~63.6, 66.1~~ [discard 2]
        * Wait until we have 3 simultaneous messages? Would require 3 receivers, but would be error correction.
          * 63.6
          * 63.6, 66.1
          * 63.6, 66.1, 66.1
          * ~~63.6~~, 66.1, 66.1
* Determine a stddev for received messages in the last X time frame. If newly received message is outside that stdev +
  some error factor (smaller than the current one) then consider the message invalid.

