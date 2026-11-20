import { describe, expect, it, vi } from 'vitest';
import {
  createPromptPolicyRegistry,
  withPromptGuardrails,
  type GatewayAdapter,
  type InvocationContext,
  type InvocationHandler,
  type PromptTelemetryEvent,
} from '@bstockwelldev/prompt-guardrails-core';

type Input = { text: string; tenantId?: string; userId?: string };

const ctx: InvocationContext = {
  requestId: 'req-synthetic-001',
  tenantId: 'tenant-demo',
  userId: 'user-demo',
};

function setup() {
  const invokeGateway = vi.fn<GatewayAdapter>().mockResolvedValue('gateway reply');
  const onTelemetry = vi.fn<(event: PromptTelemetryEvent) => void>();
  const handler = vi.fn<InvocationHandler<Input, string>>().mockResolvedValue('handler reply');
  const invoke = withPromptGuardrails({
    getPolicy: createPromptPolicyRegistry([{
      id: 'synthetic_support', version: '1.0.0', system: 'Classify the sample.',
      constraints: { maxTokens: 64, allowUrls: false },
    }]),
    getPolicyRef: () => 'synthetic_support@1.0.0',
    getUserData: (input: Input) => input.text,
    getContext: (input: Input) => ({ tenantId: input.tenantId, userId: input.userId }),
    invokeGateway,
    onTelemetry,
  }, handler);
  return { invoke, invokeGateway, onTelemetry, handler };
}

describe('withPromptGuardrails', () => {
  it('T14 throws the refusal reason and skips the handler', async () => {
    const { invoke, invokeGateway, handler } = setup();
    await expect(invoke({ text: 'https://example.invalid/sample' }, ctx))
      .rejects.toThrow(/^Prompt guardrails refused: url_blocked$/);
    expect(handler).not.toHaveBeenCalled();
    expect(invokeGateway).not.toHaveBeenCalled();
  });

  it('propagates a gateway rejection without calling telemetry or the handler', async () => {
    const { invoke, invokeGateway, onTelemetry, handler } = setup();
    const error = new Error('synthetic gateway failure');
    invokeGateway.mockRejectedValue(error);

    await expect(invoke({ text: 'Sample ticket' }, ctx)).rejects.toBe(error);
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(onTelemetry).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates a telemetry exception without calling the handler', async () => {
    const { invoke, invokeGateway, onTelemetry, handler } = setup();
    const error = new Error('synthetic telemetry failure');
    onTelemetry.mockImplementation(() => { throw error; });

    await expect(invoke({ text: 'Sample ticket' }, ctx)).rejects.toBe(error);
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    { source: 'both extracted', ids: { tenantId: 'tenant-input', userId: 'user-input' },
      tenantId: 'tenant-input', userId: 'user-input' },
    { source: 'caller user', ids: { tenantId: 'tenant-input' },
      tenantId: 'tenant-input', userId: ctx.userId },
    { source: 'caller tenant', ids: { userId: 'user-input' },
      tenantId: ctx.tenantId, userId: 'user-input' },
  ])('T15 routes context and returns the handler value ($source)', async ({ ids, tenantId, userId }) => {
    const { invoke, invokeGateway, onTelemetry, handler } = setup();
    const input = { text: 'Sample ticket', ...ids };
    await expect(invoke(input, ctx)).resolves.toBe('handler reply');
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(invokeGateway).toHaveBeenCalledWith(expect.objectContaining({ requestId: ctx.requestId }));
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ requestId: ctx.requestId, tenantId, userId }));
    expect(handler).toHaveBeenCalledTimes(1);
    const [handlerInput, handlerContext, result] = handler.mock.calls[0];
    expect(handlerInput).toBe(input);
    expect(handlerContext).toBe(ctx);
    expect(result).toEqual({ success: true, refused: false, requestId: ctx.requestId, data: 'gateway reply' });
  });
});
