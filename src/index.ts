/**
 * @bstockwelldev/prompt-guardrails-core
 *
 * Stateless server-side prompt guardrails: policy, input/output validation,
 * structured invocation, and privacy-safe telemetry.
 *
 * The module owns prompt policy and enforcement.
 * The host app owns provider selection, API keys, routing, auth, and domain orchestration.
 */

export {
  PromptGuardrailsError,
  type PromptRefusalReason,
} from './errors.js';

export type {
  PromptPolicy,
  PolicyRef,
  PromptInvocation,
  PromptInvocationResult,
  PromptTelemetryEvent,
  OutputSchema,
} from './types.js';

export {
  validatePromptInput,
  normalizeWhitespace,
  stripInvisibleChars,
  containsUrl,
  checkInjectionPatterns,
  scrubSensitiveText,
} from './input.js';

export {
  validatePromptOutput,
  repairJsonOutput,
  parseStructuredOutput,
  repairMalformedJson,
  checkLeakagePatterns,
  type ValidatePromptOutputOptions,
  type ValidatePromptOutputFailureReason,
} from './output.js';

export {
  quoteAppearsInSource,
  filterInsightsBySource,
  type QuoteInSourceOptions,
} from './evidence.js';

export {
  invokeSequential,
  type SequentialStepResult,
  type SequentialStepOk,
  type SequentialStepFail,
} from './sequential.js';

export {
  buildStructuredPrompt,
  buildMessages,
  type StructuredPromptInput,
} from './prompt.js';

export {
  createTelemetryEvent,
} from './telemetry.js';

export {
  parsePolicyRef,
  loadPolicyConfig,
  checkPolicyEnabled,
  createPromptPolicyRegistry,
  type PolicyRegistry,
  type PromptRuntimeConfig,
} from './policy.js';

export {
  createPromptRuntime,
  type GatewayAdapter,
  type CreatePromptRuntimeOptions,
} from './runtime.js';

export {
  withPromptGuardrails,
  type InvocationHandler,
  type InvocationContext,
} from './middleware.js';

export {
  PromptPolicyEntrySchema,
  PromptRegistrySchema,
  PolicyConstraintsSchema,
  type PromptPolicyEntry,
  type PolicyConstraints,
} from './schemas.js';
