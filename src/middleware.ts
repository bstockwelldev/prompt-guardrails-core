import type { PromptRuntimeConfig } from './policy.js';
import type { OutputSchema, PromptInvocationResult } from './types.js';
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

type MiddlewareConfig<TInput> = PromptRuntimeConfig & {
  invokeGateway: import('./runtime.js').GatewayAdapter;
  getPolicyRef: (input: TInput) => string;
  getUserData: (input: TInput) => string;
  getContext?: (input: TInput) => { tenantId?: string; userId?: string };
};

type GuardedHandler<TInput, TOutput> = (input: TInput, context: InvocationContext) => Promise<TOutput>;

/**
 * Wrap an invocation handler with prompt guardrails.
 * Host apps use this for route handlers and server actions.
 * The guardrails run the full flow (validate input, invoke gateway, validate output);
 * the handler receives the result and returns the response.
 */
export function withPromptGuardrails<TInput, TOutput>(
  config: MiddlewareConfig<TInput> & { outputSchema?: undefined },
  handler: InvocationHandler<TInput, TOutput, string>,
): GuardedHandler<TInput, TOutput>;
export function withPromptGuardrails<TInput, TOutput, TData = unknown>(
  config: MiddlewareConfig<TInput> & { outputSchema: OutputSchema<TData> },
  handler: InvocationHandler<TInput, TOutput, TData>,
): GuardedHandler<TInput, TOutput>;
export function withPromptGuardrails<TInput, TOutput, TData = unknown>(
  config: MiddlewareConfig<TInput> & { outputSchema: OutputSchema<TData> | undefined },
  handler: InvocationHandler<TInput, TOutput, TData | string>,
): GuardedHandler<TInput, TOutput>;
export function withPromptGuardrails<TInput, TOutput, S extends OutputSchema>(
  config: MiddlewareConfig<TInput> & { outputSchema?: S },
  handler: InvocationHandler<TInput, TOutput, S['_output'] | string>,
): GuardedHandler<TInput, TOutput>;
export function withPromptGuardrails<TInput, TOutput, TData>(
  config: MiddlewareConfig<TInput> & { outputSchema?: OutputSchema<TData> },
  handler: InvocationHandler<TInput, TOutput, TData | string>,
): GuardedHandler<TInput, TOutput> {
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
