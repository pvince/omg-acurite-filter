# HA Discovery Topic Override Plan

## Goal
Add optional env var `MQTT_HADISCOVERY_TOPIC` to override Home Assistant discovery topic root.

## Decisions
- `MQTT_HADISCOVERY_TOPIC` is root-only (example: `customhome`).
- Discovery base topic is derived as `<root>/sensor`.
- Empty or whitespace env value falls back to default root (`homeassistant`), so base remains `homeassistant/sensor`.

## Implementation Steps
1. Add configuration getter for `MQTT_HADISCOVERY_TOPIC` with trim + fallback behavior.
2. Refactor discovery service to derive subscription, publish, clear, probe, and parse paths from the configured discovery base topic.
3. Add tests for:
- config getter behavior,
- override subscription/publish behavior,
- empty-value fallback behavior.
4. Add commented example to `.env.example`.
5. Verify with targeted tests, then full test/build commands.

## Verification Notes
- New targeted tests for `mqttHADiscoveryTopic` pass.
- New targeted discovery override tests pass.
- Full `npm test` run still reports two pre-existing failures in `homeAssistantDiscovery.spec.ts` unrelated to this feature:
- `should avoid overlapping exact-topic probes for the same unverified canonical topic`
- `should restore legacy topics cleared for skipped canonical metrics when a later metric fails`
- `npm run build` completes without TypeScript errors.
