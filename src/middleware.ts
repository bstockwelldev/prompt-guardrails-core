import type { PromptRuntimeConfig } from './policy.js';
import type { PromptInvocationResult } from './types.js';
import { createPromptRuntime } from './runtime.js';

export type InvocationContext = {
  requestId: string;
  tenantId?: string;
  userId?: string;
};

export type InvocationHandler<TInput, TOutput, TData = unknown> = (
  input: TInput,
  context: InvocationContext,
  result: PromptInvocationResult<TData>,
) => Promise<TOutput>;

/**
 * Wrap an invocation handler with prompt guardrails.
 * Host apps use this for route handlers and server actions.
 * The guardrails run the full flow (validate input, invoke gateway, validate output);
 * the handler receives the result and returns the response.
 */
export function withPromptGuardrails<TInput, TOutput, TData = unknown>(
  config: PromptRuntimeConfig & {
    invokeGateway: import('./runtime.js').GatewayAdapter;
    /** Extract policyRef from input */
    getPolicyRef: (input: TInput) => string;
    /** Extract user data from input */
    getUserData: (input: TInput) => string;
    /** Optional: extract context from input */
    getContext?: (input: TInput) => { tenantId?: string; userId?: string };
    /** Optional: output schema for structured validation */
    outputSchema?: import('./types.js').OutputSchema<TData>;
  },
  handler: InvocationHandler<TInput, TOutput, TData>,
): (input: TInput, context: InvocationContext) => Promise<TOutput> {
  const runtime = createPromptRuntime({
    getPolicy: config.getPolicy,
    isPromptEnabled: config.isPromptEnabled,
    onTelemetry: config.onTelemetry,
    invokeGateway: config.invokeGateway,
  });

  return async (input, ctx) => {
    const policyRef = config.getPolicyRef(input);
    const userData = config.getUserData(input);
    const context = config.getContext?.(input) ?? {};

    const result = await runtime.invoke<TData>(policyRef, userData, {
      requestId: ctx.requestId,
      tenantId: context.tenantId ?? ctx.tenantId,
      userId: context.userId ?? ctx.userId,
      outputSchema: config.outputSchema,
    });

    if (!result.success && result.refused) {
      throw new Error(`Prompt guardrails refused: ${result.reason}`);
    }

    return handler(input, ctx, result);
  };
}
