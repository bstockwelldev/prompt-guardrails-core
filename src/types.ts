import type { ZodType } from 'zod';
import type { PromptRefusalReason } from './errors.js';

/**
 * Versioned prompt policy contract.
 * Host apps supply policy data; the shared module validates and enforces it.
 */
export type PromptPolicy = {
  id: string;
  version: string;
  key: string;
  system: string;
  constraints: {
    maxTokens: number;
    temperature?: number;
    allowUrls?: boolean;
    maxInputLength?: number;
    tools?: string[];
  };
};

/**
 * Policy reference format: "promptId@version" (e.g. "support_chatbot@1.3.0")
 */
export type PolicyRef = {
  id: string;
  version: string;
  key: string;
};

/**
 * Request payload for a guarded prompt invocation.
 */
export type PromptInvocation = {
  policyRef: string;
  policy: PromptPolicy;
  systemContext?: string;
  userData: string;
  messages?: Array<{ role: 'user' | 'system'; content: string }>;
  requestId?: string;
  tenantId?: string;
  userId?: string;
};

/**
 * Result of a guarded prompt invocation.
 */
export type PromptInvocationResult<T = unknown> = {
  success: true;
  data: T;
  requestId: string;
  refused: false;
} | {
  success: false;
  refused: true;
  reason: PromptRefusalReason;
  requestId: string;
  message?: string;
};

/**
 * Privacy-safe telemetry event.
 * Default: hashed payloads only; no raw prompt/response.
 */
export type PromptTelemetryEvent = {
  requestId: string;
  policyRef: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  outputHash: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  tenantId?: string;
  userId?: string;
  policyHit?: PromptRefusalReason | null;
  toolNames?: string[];
};

/**
 * Schema for structured output validation.
 */
export type OutputSchema<T = unknown> = ZodType<T>;
