# omg-acurite-filter

Listens to OpenMQTTGateway MQTT messages, filters suspicious weather-sensor readings, caches recent valid data, forwards approved payloads back to MQTT, and exposes runtime state over HTTP.

Additional docs:

- [docs/architecture.md](docs/architecture.md) for component boundaries and message flow.
- [docs/http-api.md](docs/http-api.md) for REST endpoints.
- [AGENTS.md](AGENTS.md) for AI-agent workflow and repo conventions.


## Build

Requires Node.js `>=18.2.0`.

1. Install dependencies with `npm install`.
2. Compile and type-check with `npm run build`.

## Test

1. Run the full test suite with `npm test`.
2. Run one spec with `npx mocha path/to/file.spec.ts`.
3. Run line-level all-source coverage with `npm run test:coverage`.
4. Generate machine-readable coverage artifacts with `npm run test:coverage:json`.

## Install And Configure

1. Copy [.env.example](.env.example) to `.env`.
   PowerShell: `Copy-Item .env.example .env`
2. Set the required MQTT environment variables:
   - `MQTT_HOST`: broker URL such as `mqtt://hostname`
   - `MQTT_USER`: broker username
   - `MQTT_PASS`: broker password
   - `MQTT_SRC_TOPIC`: source topic prefix or wildcard pattern without a trailing `/#`
   - `MQTT_DST_TOPIC`: destination topic prefix or wildcard pattern without a trailing `/#`
3. Start the service with `npm start`.
4. Query the HTTP API on port `2998` after startup.

Notes:

- Runtime configuration is loaded from `.env` by [src/services/configuration.ts](src/services/configuration.ts).
- `MQTT_SRC_TOPIC` and `MQTT_DST_TOPIC` are normalized to end in `/#` automatically.
- MQTT message history is stored in the local SQLite database under the `data` directory.

## Support

Feature requests and bug reports belong in GitHub Issues, not in this README.

