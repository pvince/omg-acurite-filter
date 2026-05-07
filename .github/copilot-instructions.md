# AGENTS.md

## Scope

These instructions apply to the whole repository. Keep them short, follow them exactly, and prefer the linked source files over guesswork.

## First Reads

- [README.md](README.md) for project intent and background.
- [docs/architecture.md](docs/architecture.md) for the runtime flow and component boundaries.
- [docs/http-api.md](docs/http-api.md) for the REST surface.
- [.env.example](.env.example) for required runtime configuration.
- [package.json](package.json) for the authoritative scripts.
- [src/app.ts](src/app.ts) for the live service entrypoint.
- [src/services/configuration.ts](src/services/configuration.ts) for runtime config behavior.
- [src/replay.ts](src/replay.ts) for offline replay flow.

## Commands

- Install dependencies: `npm install`
- Create local env file: copy [.env.example](.env.example) to `.env` and fill MQTT values.
- Run all tests: `npm test`
- Run one spec: `npx mocha path/to/file.spec.ts`
- Build and type-check: `npm run build`
- Start the service: `npm start`

## Architecture Map

- MQTT ingest and topic utilities: [src/mqtt](src/mqtt)
- Device parsing and examples: [src/mqtt/omg_devices](src/mqtt/omg_devices)
- Validation, caching, forwarding, scheduling, and statistics: [src/services](src/services)
- SQLite persistence: [src/services/database](src/services/database)
- REST API surface: [src/restapi](src/restapi)

## Repo Conventions

- Tests are colocated with source as `*.spec.ts` files and use Mocha + Chai.
- TypeScript is strict. Build failures matter even if tests pass.
- ESLint is strict and requires JSDoc on many declarations; match the existing style in [.eslintrc](.eslintrc).
- Runtime configuration comes from environment variables in [.env](.env) via [src/services/configuration.ts](src/services/configuration.ts). Do not treat [configuration.json](configuration.json) as the source of truth.
- `MQTT_SRC_TOPIC` and `MQTT_DST_TOPIC` are topic prefixes. [src/services/configuration.ts](src/services/configuration.ts) appends `/#` automatically.
- Unknown or unparseable MQTT messages are intentionally forwarded in [src/app.ts](src/app.ts). Preserve that behavior unless the task explicitly changes it.

## Development Process

### Planning

For any non-trivial task:

1. Inspect the relevant implementation, nearby tests, and linked docs before proposing changes.
2. Produce a concrete task list that a less capable engineer could execute without filling in major gaps.
3. Split independent work into parallel sub-agent tasks when useful.
4. Choose sub-agent models intentionally:
   - Use GPT-5.4 for architecture, tradeoffs, and final review.
   - Use GPT-5.3-Codex for code search, focused implementation planning, and targeted refactors.
   - Use Claude Haiku 4.5 for fast read-only scans.
   - Use Claude Sonnet 4.6 when broader synthesis is needed.
5. Keep the plan implementation-oriented. Avoid vague steps like "update code as needed".

### Testing

This repository follows strict TDD for all code changes.

For new features and bug fixes:

1. Write the test first.
2. Verify the new test fails for the expected reason.
3. Change the implementation.
4. Verify the new test passes, then run the broader relevant suite.

For refactors:

1. Add or extend tests that cover the behavior being refactored.
2. Verify the tests pass before refactoring.
3. Perform the refactor.
4. Verify the same tests still pass, then run the broader relevant suite.

Test expectations:

- Cover the happy path, edge cases, and likely gotchas.
- Prefer colocated updates to the nearest existing `*.spec.ts` file when possible.
- Add a new colocated spec only when the affected module has no suitable test file.
- For stateful validator work, make sure tests reset shared validator state between cases.

### Final Verification

Before a task is complete:

1. Run the relevant targeted tests.
2. Run `npm test`.
3. Run `npm run build` for TypeScript changes.
4. Run a code review in a sub-agent after the implementation is finished.
5. Address the review feedback.
6. If code changes after review feedback, rerun the affected tests, rerun `npm test`, and rerun the code review on the updated diff.

Completion requires passing tests and an approved review on the same final code.

### Review Handoff

- After each Review Gate run, update the `## Review Gate Handoff` section in `/memories/session/plan.md` with only the context the next review pass should start from: open findings, resolved findings worth not re-litigating unless related code changes again, likely next-touch files or behaviors, and current verification freshness.
- Before any followup Review Gate run, read that handoff section first and include it in the sub-agent prompt.