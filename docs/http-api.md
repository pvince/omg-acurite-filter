# HTTP API

The Express service is started by [src/services/webService.ts](../src/services/webService.ts) and mounts routers from [src/restapi](../src/restapi). All endpoints live under `/api/v1`.

## Endpoints

- `GET /api/v1/forwarders`
  Returns active forwarding jobs, their status, and any queued MQTT message.
- `GET /api/v1/stats`
  Returns the full statistics payload.
- `GET /api/v1/stats/forwarders`
  Returns forwarder-specific statistics.
- `GET /api/v1/stats/mqtt`
  Returns MQTT receive and send counters.
- `GET /api/v1/stats/cache`
  Returns cache statistics.
- `GET /api/v1/stats/app`
  Returns application-level statistics.
- `GET /api/v1/cache`
  Returns a summary of cached device entries.
- `GET /api/v1/cache/:id`
  Returns cached entries for one device identifier.
- `DELETE /api/v1/cache/cleanup`
  Purges stale cache entries and returns counts before and after cleanup.
- `GET /api/v1/logs`
  Returns the in-memory message log.
- `GET /api/v1/data/msgs/:device_id?max_age=<seconds>&min_age=<seconds>`
  Returns persisted messages for a device, optionally constrained by age.

## Error Handling

- Missing routes return `404`.
- API errors are translated through [src/restapi/apiError.ts](../src/restapi/apiError.ts).
- `max_age` must be greater than or equal to `min_age` on the persisted-message endpoint.