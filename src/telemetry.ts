import type { PromptTelemetryEvent } from './types.js';
import type { PromptRefusalReason } from './errors.js';
import { scrubSensitiveText } from './input.js';

/**
 * FNV-1a hash for content identification without revealing content.
 */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = (value * 0x01000193) >>> 0;
  }
  return value.toString(36).padStart(10, '0').slice(-10);
}

/**
 * Create a privacy-safe telemetry event.
 * Default: hashed prompt/output only; no raw content.
 */
export function createTelemetryEvent(
  params: {
    requestId: string;
    policyRef: string;
    promptId: string;
    promptVersion: string;
    promptText: string;
    outputText: string;
    latencyMs: number;
    tenantId?: string;
    userId?: string;
    policyHit?: PromptRefusalReason | null;
    toolNames?: string[];
  },
): PromptTelemetryEvent {
  const sanitizedPrompt = scrubSensitiveText(params.promptText);
  const sanitizedOutput = scrubSensitiveText(params.outputText);

  const tokensIn = Math.ceil(sanitizedPrompt.length / 4);
  const tokensOut = Math.ceil(sanitizedOutput.length / 4);

  return {
    requestId: params.requestId,
    policyRef: params.policyRef,
    promptId: params.promptId,
    promptVersion: params.promptVersion,
    promptHash: hash(sanitizedPrompt),
    outputHash: hash(sanitizedOutput),
    latencyMs: params.latencyMs,
    tokensIn,
    tokensOut,
    tenantId: params.tenantId,
    userId: params.userId,
    policyHit: params.policyHit ?? null,
    toolNames: params.toolNames,
  };
}
