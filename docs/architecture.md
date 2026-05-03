# Architecture

## Runtime Overview

The live service starts in [src/app.ts](../src/app.ts). Startup loads the SQLite-backed data store, connects to MQTT, subscribes to the configured source topic, and starts the Express HTTP service.

Message flow:

1. MQTT payloads arrive through [src/mqtt/mqttComms.ts](../src/mqtt/mqttComms.ts).
2. [src/app.ts](../src/app.ts) parses each payload and builds a normalized data entry when the message matches a supported device type.
3. [src/services/dataCache.ts](../src/services/dataCache.ts) keeps recent readings per device.
4. [src/services/validators](../src/services/validators) rejects suspicious readings based on per-sensor rules.
5. [src/services/messageForwardingService.ts](../src/services/messageForwardingService.ts) throttles and forwards accepted messages.
6. [src/services/database](../src/services/database) persists message history to SQLite.
7. [src/services/webService.ts](../src/services/webService.ts) exposes REST endpoints for cache, stats, logs, forwarders, and persisted messages.

Unknown or unparseable MQTT messages are intentionally forwarded rather than dropped.

## Key Directories

- [src/mqtt](../src/mqtt): MQTT transport, topic utilities, and device parsing helpers.
- [src/mqtt/omg_devices](../src/mqtt/omg_devices): supported OpenMQTTGateway device types and example payloads.
- [src/services](../src/services): configuration, cache management, forwarding, scheduling, statistics, validators, and persistence services.
- [src/restapi](../src/restapi): HTTP routers mounted under `/api/v1/...`.
- [testData](../testData): local test and replay artifacts.

## Configuration Notes

- Runtime configuration comes from `.env`, not [configuration.json](../configuration.json).
- [src/services/configuration.ts](../src/services/configuration.ts) appends `/#` to MQTT topic settings automatically.
- The HTTP service listens on port `2998`.

## Replay Mode

[src/replay.ts](../src/replay.ts) replays MQTT messages from the SQLite store back through the normal processing pipeline. It enables offline analysis with accelerated forwarding and prints collected statistics when it completes.