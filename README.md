# @bstockwelldev/prompt-guardrails-core

Stateless server-side prompt guardrails: policy, input/output validation, structured invocation, and privacy-safe telemetry.

## Scope

**In scope:** Versioned prompt policy, input validation, structured prompt builders, output validation, JSON repair, telemetry contracts, refusal typing.

**Out of scope:** React, Next.js routes, provider SDKs, domain logic.

## Installation

```bash
npm install @bstockwelldev/prompt-guardrails-core
```

**For Vercel/CI:** Use the npm package (`^1.1.0`). For local development before first publish, consumers may use `file:../prompt-guardrails-core`; after publishing, switch to `^1.1.0`.

**Maintainers:** Multi-repo release policy is in [docs/RELEASE_COORDINATION.md](docs/RELEASE_COORDINATION.md).

## Public API

- `createPromptRuntime(config)` – Create guarded prompt runtime
- `withPromptGuardrails(config, handler)` – Wrap route handlers / server actions
- `buildStructuredPrompt({ system, userData, context })` – Instruction/data separation
- `validatePromptInput(input, policy)` – Input guardrails
- `validatePromptOutput(output, schema, policy)` – Output validation
- `repairJsonOutput(raw, schemaName)` – JSON repair orchestration
- `createTelemetryEvent(event)` – Privacy-safe telemetry
- `PromptGuardrailsError` – Machine-readable refusal reasons

## Usage

```ts
import {
  createPromptRuntime,
  parsePolicyRef,
  type PromptPolicy,
} from '@bstockwelldev/prompt-guardrails-core';

const getPolicy: (id: string, version: string) => PromptPolicy | null = (id, version) => {
  if (id === 'support_chatbot' && version === '1.3.0') {
    return {
      id,
      version,
      key: `${id}@${version}`,
      system: 'You are a courteous support agent.',
      constraints: { maxTokens: 800, allowUrls: false },
    };
  }
  return null;
};

const runtime = createPromptRuntime({
  getPolicy,
  invokeGateway: async ({ messages, policy }) => {
    // Host app performs actual LLM call
    return await yourGateway.generateText(messages);
  },
});

const result = await runtime.invoke('support_chatbot@1.3.0', userInput, {
  requestId: 'req-123',
  tenantId: 'tenant-1',
});
```

### Supplying reference material

Pass retrieved or user-authored text in the optional `referenceContext` field.
Reserve `systemContext` for instructions controlled by the application.

```ts
await runtime.invoke('support_chatbot@1.3.0', userInput, {
  referenceContext: retrievedExcerpt,
});
```

The runtime validates the task and reference under the same input policy.
A URL-disabled policy can refuse a reference containing a URL. The combined
user message, including its paragraph label and separator, must fit the input
length limit. A blank reference preserves the existing message format.
Direct callers of `buildMessages` can also pass `referenceContext` and own
input validation. Hosts must authorize access to the source, preserve roles
through gateway translation, and authorize downstream actions.

### Prompt-injection checks

The runtime checks task text and reference material for known patterns before
dispatch. Pattern matching can miss obfuscated or paraphrased instructions and
can flag legitimate text. Treat accepted input as untrusted. Hosts must
authorize tool calls and data access independently, even when input passes
validation.

### Custom policy registries

Return `null` for a missing policy. A returned object must match the requested
ID and normalized version, with a canonical `id@version` key and nonblank system
instructions. Custom versions such as `1` remain supported. The core validates
constraints before the enablement hook runs and passes the parsed snapshot to
the gateway. Unrecognized fields are dropped and omitted `allowUrls` defaults
to false. Move adapter-specific metadata outside the policy object.

Direct loader callers receive a `PromptGuardrailsError` for an invalid result.
Runtime callers receive a `policy_invalid` refusal. Add this case to exhaustive
refusal handlers. Adapters own provider token and temperature settings and must
authorize tool execution.

### Gateway and telemetry failures

| Outcome | Runtime behavior |
| --- | --- |
| Gateway throws or rejects | Rejects with the original error, after one adapter call and before telemetry. |
| Telemetry callback throws synchronously | Rejects with the callback error. This can replace a pending success or refusal. |
| Policy cannot be resolved, is invalid, or is disabled | Returns a refusal before gateway dispatch and before invoking telemetry. |
| Input or output is refused and telemetry returns normally | Returns the refusal. Input refusals occur before dispatch. Output refusals occur after dispatch. |

`onTelemetry` is a synchronous callback. The runtime does not await a promise
returned by it. Hosts using an asynchronous sink should handle sink failures
inside the integration, and can catch synchronous sink errors if they want
the original prompt outcome delivered. The gateway adapter owns retries.
A telemetry error may arrive after the gateway has already completed, so
retrying the entire invocation may repeat gateway work.

`withPromptGuardrails` propagates runtime rejections and skips the handler.
A returned refusal is converted to an error containing the refusal reason
and also skips the handler.

## Refusal Reasons

- `policy_invalid` – Registry result failed validation or identity matching

- `injection_detected` – Prompt injection pattern detected
- `url_blocked` – URLs not allowed by policy
- `policy_disabled` – Prompt disabled or unknown
- `schema_invalid` – Output failed schema validation
- `output_leakage_detected` – Output contains disallowed content
- `input_too_long` – Input exceeds max length
- `control_characters_blocked` – Disallowed control chars in input

## Repository

- **Source**: https://github.com/bstockwelldev/prompt-guardrails-core
- **npm**: https://www.npmjs.com/package/@bstockwelldev/prompt-guardrails-core

### Output types

With strict TypeScript settings, omitting `outputSchema` returns a string on
success. Supplying a Zod schema returns its parsed output type. If the schema
can be undefined, narrow the resulting union before using the data. The same
rules apply to middleware handlers. Check `result.success` before reading data.

When migrating an explicit `invoke<MyObject>(...)` call, pass a matching schema
if the caller needs an object. For raw output, omit the generic argument.
