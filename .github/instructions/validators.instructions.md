---
description: "Use when editing validator logic, validator tests, cache-validation behavior, or suspicious-reading filtering in src/services/validators. Covers TDD, state reset, and boundary-case expectations."
name: "Validator Workflow"
applyTo: "src/services/validators/**/*.ts"
---
# Validator Workflow

- Start with the nearest colocated `*.spec.ts` file. Add the failing test before changing validator logic.
- Cover the happy path, boundary values, and recovery behavior after a rejected reading.
- Treat validator state as shared unless proven otherwise. In integration-style validator tests, reset state between cases with `initialize_validators()`.
- Prefer realistic `DataEntry` fixtures or helper builders over ad hoc object literals.
- Keep validation behavior explicit at threshold edges. Tests should pin exact max and min accepted values.
- After implementation, run the targeted validator spec, then `npm test`, then `npm run build`.