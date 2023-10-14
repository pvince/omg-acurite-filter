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

# TODO
