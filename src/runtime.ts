import type { PromptPolicy, PromptInvocationResult, PromptTelemetryEvent } from './types.js';

/** Cross-platform UUID: uses Web Crypto in browser/Node 19+, fallback for older envs */
function generateRequestId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type { OutputSchema } from './types.js';
import { PromptGuardrailsError } from './errors.js';
import { loadPolicyConfig, checkPolicyEnabled, type PromptRuntimeConfig } from './policy.js';
import { validatePromptInput } from './input.js';
import { validatePromptOutput } from './output.js';
import { buildMessages } from './prompt.js';
import { createTelemetryEvent } from './telemetry.js';

export type GatewayAdapter = (params: {
  messages: Array<{ role: 'user' | 'system'; content: string }>;
  policy: PromptPolicy;
  requestId: string;
}) => Promise<string>;

export type CreatePromptRuntimeOptions = PromptRuntimeConfig & {
  /** Host-provided gateway that performs the actual LLM call */
  invokeGateway: GatewayAdapter;
};

/**
 * Z1: Create a guarded prompt runtime.
 * Orchestrates: load policy → validate input → invoke gateway → validate output → emit telemetry.
 */
export function createPromptRuntime(config: CreatePromptRuntimeOptions) {
  const { getPolicy, isPromptEnabled, onTelemetry, invokeGateway } = config;

  return {
    async invoke<T>(
      policyRef: string,
      userData: string,
      options?: {
        systemContext?: string;
        outputSchema?: OutputSchema<T>;
        requestId?: string;
        tenantId?: string;
        userId?: string;
      },
    ): Promise<PromptInvocationResult<T>> {
      const requestId = options?.requestId ?? generateRequestId();

      let policy: PromptPolicy;
      try {
        policy = loadPolicyConfig(policyRef, getPolicy);
      } catch (err) {
        return {
          success: false,
          refused: true,
          reason: 'policy_disabled',
          requestId,
          message: err instanceof Error ? err.message : String(err),
        };
      }

      if (!checkPolicyEnabled(policy, isPromptEnabled)) {
        return {
          success: false,
          refused: true,
          reason: 'policy_disabled',
          requestId,
        };
      }

      let validatedInput: string;
      try {
        validatedInput = validatePromptInput(userData, policy);
      } catch (err) {
        if (err instanceof PromptGuardrailsError) {
          onTelemetry?.(createTelemetryEvent({
            requestId,
            policyRef,
            promptId: policy.id,
            promptVersion: policy.version,
            promptText: userData,
            outputText: '',
            latencyMs: 0,
            tenantId: options?.tenantId,
            userId: options?.userId,
            policyHit: err.reason,
          }));
          return {
            success: false,
            refused: true,
            reason: err.reason,
            requestId,
            message: err.message,
          };
        }
        throw err;
      }

      const messages = buildMessages({
        system: policy.system,
        userData: validatedInput,
        context: options?.systemContext,
      });

      const start = Date.now();
      let rawOutput: string;
      try {
        rawOutput = await invokeGateway({
          messages,
          policy,
          requestId,
        });
      } catch (err) {
        throw err;
      }

      const latencyMs = Date.now() - start;

      if (options?.outputSchema) {
        const validated = validatePromptOutput(rawOutput, options.outputSchema);
        if (!validated.ok) {
          onTelemetry?.(createTelemetryEvent({
            requestId,
            policyRef,
            promptId: policy.id,
            promptVersion: policy.version,
            promptText: validatedInput,
            outputText: rawOutput,
            latencyMs,
            tenantId: options?.tenantId,
            userId: options?.userId,
            policyHit: validated.reason,
          }));
          return {
            success: false,
            refused: true,
            reason: validated.reason,
            requestId,
          };
        }

        onTelemetry?.(createTelemetryEvent({
          requestId,
          policyRef,
          promptId: policy.id,
          promptVersion: policy.version,
          promptText: validatedInput,
          outputText: rawOutput,
          latencyMs,
          tenantId: options?.tenantId,
          userId: options?.userId,
        }));

        return {
          success: true,
          data: validated.data,
          requestId,
          refused: false,
        };
      }

      onTelemetry?.(createTelemetryEvent({
        requestId,
        policyRef,
        promptId: policy.id,
        promptVersion: policy.version,
        promptText: validatedInput,
        outputText: rawOutput,
        latencyMs,
        tenantId: options?.tenantId,
        userId: options?.userId,
      }));

      return {
        success: true,
        data: rawOutput as T,
        requestId,
        refused: false,
      };
    },
  };
}
