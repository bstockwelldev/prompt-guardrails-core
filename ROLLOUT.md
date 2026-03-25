# Shared Prompt Guardrails – Rollout & Adoption

This document describes staged adoption, compatibility shims, and cross-repo documentation for rolling out `@bstockwelldev/prompt-guardrails-core` into additional web apps.

## Installation

Install from npm:

```bash
npm install @bstockwelldev/prompt-guardrails-core
```

Add to your `package.json`:

```json
{
  "dependencies": {
    "@bstockwelldev/prompt-guardrails-core": "^1.1.0"
  }
}
```

The package is developed in its own repository and published to the npm registry. For contributing and issue tracking, see: https://github.com/bstockwelldev/prompt-guardrails-core

## Current Adopters

| App | Integration | Status |
|-----|-------------|--------|
| **board-game-sim-ai** | `guardrails-adapter.ts`, `aiClient`, `importService`, `simulationService`, `analysisService` | ✅ Adopted |
| **tabletop-studio** | `runtime.ts` via `validatePromptInput`, `scrubSensitiveText`, `createTelemetryEvent` | ✅ Adopted |

## Staged Adoption Sequence

### Phase 1: Install from npm

1. Add `@bstockwelldev/prompt-guardrails-core` as a dependency:
   - `"@bstockwelldev/prompt-guardrails-core": "^1.1.0"`

2. Create a **host adapter** per app:
   - Implement `GatewayAdapter` that calls your provider (Gemini, OpenAI, etc.)
   - Map module message format to your provider's format
   - Wire `onTelemetry` to your logging/metrics sink

3. Migrate one flow at a time:
   - Replace ad hoc prompt assembly with `buildStructuredPrompt`
   - Replace direct `generateText` with `invokeGuardedJson` or `runtime.invoke`
   - Replace local `scrub`/`assertSafeInput` with `validatePromptInput` and `scrubSensitiveText`

### Phase 2: Policy Registry Alignment

1. Ensure your prompt registry matches `PromptRegistrySchema`:
   - `id`, `version` (semver), `system`, `constraints` (maxTokens, allowUrls, etc.)
   - Use `createPromptPolicyRegistry(registryJson)` to build the registry

2. Map existing policy keys to `policyRef` format: `id@version` (e.g. `support_chatbot@1.3.0`)

### Phase 3: Full Runtime Path

1. Route all non-chat flows through `createPromptRuntime` or `withPromptGuardrails`
2. Remove any remaining direct `generateText` calls that bypass policy
3. Standardize refusal handling: catch `PromptGuardrailsError` and return `{ refused: true, reason: error.reason }`

## Compatibility Shims

### Shim 1: Legacy `scrub` → `scrubSensitiveText`

If your app had a local `scrub()`:

```ts
// Before
import { scrub } from '@/lib/sanitize';
const safe = scrub(text);

// After
import { scrubSensitiveText } from '@bstockwelldev/prompt-guardrails-core';
const safe = scrubSensitiveText(text);
```

### Shim 2: Legacy `assertSafeInput` → `validatePromptInput`

```ts
// Before
assertSafeInput(input);  // throws on URL or injection

// After
import { validatePromptInput } from '@bstockwelldev/prompt-guardrails-core';
const normalized = validatePromptInput(input, policy);  // throws PromptGuardrailsError
```

### Shim 3: JSON Repair

```ts
// Before
let parsed = JSON.parse(raw);
if (!parsed) parsed = tryRepair(raw);

// After
import { repairMalformedJson, parseStructuredOutput } from '@bstockwelldev/prompt-guardrails-core';
let parsed = parseStructuredOutput(raw) ?? repairMalformedJson(raw);
```

### Shim 4: Telemetry

```ts
// Before
logger.info('prompt', { prompt: text, output });  // PII risk

// After
import { createTelemetryEvent } from '@bstockwelldev/prompt-guardrails-core';
const event = createTelemetryEvent({ promptText: text, outputText: output, ... });
logger.info('prompt-guardrails.telemetry', event);  // hashed only
```

## Test Harness

The shared package includes a red-team and contract-validation test harness:

- **Location**: `tests/` in the package repo
- **Fixtures**: `tests/fixtures/red-team.ts` – injection, URL, malformed JSON, leakage vectors

To run tests in the package repo:

```bash
cd prompt-guardrails-core && npm test
```

Other apps can copy the fixture file into their own integration tests, or reference the package's test vectors for regression coverage.

## Documentation References

- **board-game-sim-ai**: See `docs/PROMPTS.md` – prompt guardrails are implemented via `@bstockwelldev/prompt-guardrails-core` and `guardrails-adapter.ts`
- **tabletop-studio**: See `AGENTS.md` – Policy: Prompt & Agent Guardrails; runtime uses `@bstockwelldev/prompt-guardrails-core` for input validation and telemetry
- **Package**: https://github.com/bstockwelldev/prompt-guardrails-core – Public API and usage

## Definition of Done (Adoption)

- [ ] Stateless shared package exists with policy, input/output guardrails, and telemetry
- [ ] Host app no longer keeps core prompt guardrails in feature-local services
- [ ] Host app integrates through shared module with a gateway adapter
- [ ] Shared tests cover malformed input, injection, structured output, leakage
- [ ] Documentation points to the shared module as the canonical prompt guardrails implementation
