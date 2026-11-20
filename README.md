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

## Refusal Reasons

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
