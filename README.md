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
