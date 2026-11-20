import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createPromptRuntime,
  type GatewayAdapter,
  type PolicyRegistry,
  type PromptPolicy,
  type PromptRuntimeConfig,
  type PromptTelemetryEvent,
} from '@bstockwelldev/prompt-guardrails-core';

const policy: PromptPolicy = {
  id: 'synthetic_support',
  version: '1.0.0',
  key: 'synthetic_support@1.0.0',
  system: 'Classify the sample.',
  constraints: { maxTokens: 64, allowUrls: false },
};
const requestId = 'req-synthetic-001';
const input = 'Sample ticket';
const outputSchema = z.object({ label: z.string() });
const flaggedOutput = JSON.stringify({ label: 'password reset' });
const blockedUrl = 'https://example.invalid/sample';

function setup(options: Pick<PromptRuntimeConfig, 'isPromptEnabled'> = {}) {
  const getPolicy = vi.fn<PolicyRegistry>().mockReturnValue(policy);
  const invokeGateway = vi.fn<GatewayAdapter>().mockResolvedValue('plain reply');
  const onTelemetry = vi.fn<(event: PromptTelemetryEvent) => void>();
  const runtime = createPromptRuntime({ getPolicy, invokeGateway, onTelemetry, ...options });
  return { runtime, getPolicy, invokeGateway, onTelemetry };
}

describe('createPromptRuntime', () => {
  it('T01 returns the raw reply and preserves the request ID', async () => {
    const { runtime, invokeGateway } = setup();
    const result = await runtime.invoke(policy.key, input, { requestId });
    expect(result).toEqual({ success: true, refused: false, requestId, data: 'plain reply' });
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(invokeGateway).toHaveBeenCalledWith(expect.objectContaining({ requestId, policy }));
  });

  it('T02 returns parsed data and emits one success event', async () => {
    const { runtime, invokeGateway, onTelemetry } = setup();
    invokeGateway.mockResolvedValue('{"label":"general"}');
    const result = await runtime.invoke(policy.key, input, { requestId, outputSchema });
    expect(result).toEqual({ success: true, refused: false, requestId, data: { label: 'general' } });
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ requestId, policyHit: null }));
  });

  it.each([
    ['T03 irreparable JSON', 'invalid json', 'schema_invalid'],
    ['T03 schema mismatch', '{"label":5}', 'schema_invalid'],
    ['T04 flagged structured output', flaggedOutput, 'output_leakage_detected'],
  ])('%s returns a refusal after one gateway call', async (_name, reply, reason) => {
    const { runtime, invokeGateway, onTelemetry } = setup();
    invokeGateway.mockResolvedValue(reply);
    const result = await runtime.invoke(policy.key, input, { requestId, outputSchema });
    expect(result).toMatchObject({ success: false, refused: true, requestId, reason });
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ requestId, policyHit: reason }));
  });

  it('T05 refuses an unknown policy before the gateway or telemetry', async () => {
    const { runtime, getPolicy, invokeGateway, onTelemetry } = setup();
    getPolicy.mockReturnValue(null);
    const result = await runtime.invoke('missing@1.0.0', input, { requestId });
    expect(getPolicy).toHaveBeenCalledWith('missing', '1.0.0');
    expect(result).toMatchObject({ success: false, refused: true, reason: 'policy_disabled', requestId });
    expect(invokeGateway).not.toHaveBeenCalled();
    expect(onTelemetry).not.toHaveBeenCalled();
  });

  it('T06 refuses a disabled policy before the gateway or telemetry', async () => {
    const isPromptEnabled = vi.fn().mockReturnValue(false);
    const { runtime, invokeGateway, onTelemetry } = setup({ isPromptEnabled });
    const result = await runtime.invoke(policy.key, input, { requestId });
    expect(isPromptEnabled).toHaveBeenCalledWith(policy.id, policy.version);
    expect(result).toMatchObject({ success: false, refused: true, reason: 'policy_disabled', requestId });
    expect(invokeGateway).not.toHaveBeenCalled();
    expect(onTelemetry).not.toHaveBeenCalled();
  });

  it.each([
    ['T07 URL', blockedUrl, 'url_blocked'],
    ['T08 control character', 'sample\u0000text', 'control_characters_blocked'],
  ])('%s emits an input refusal before the gateway', async (_name, text, reason) => {
    const { runtime, invokeGateway, onTelemetry } = setup();
    const result = await runtime.invoke(policy.key, text, { requestId });
    expect(result).toMatchObject({ success: false, refused: true, requestId, reason });
    expect(invokeGateway).not.toHaveBeenCalled();
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ requestId, policyHit: reason }));
  });

  it('T09 propagates the original gateway error before emitting telemetry', async () => {
    const { runtime, invokeGateway, onTelemetry } = setup();
    const error = new Error('synthetic gateway failure');
    invokeGateway.mockRejectedValue(error);
    await expect(runtime.invoke(policy.key, input, { requestId })).rejects.toBe(error);
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(onTelemetry).not.toHaveBeenCalled();
  });

  it.each([
    { outcome: 'success', text: input, gatewayCalls: 1, policyHit: null },
    { outcome: 'input refusal', text: blockedUrl, gatewayCalls: 0, policyHit: 'url_blocked' },
  ])('T10 a throwing telemetry callback masks $outcome', async ({ text, gatewayCalls, policyHit }) => {
    const { runtime, invokeGateway, onTelemetry } = setup();
    const error = new Error('synthetic telemetry failure');
    onTelemetry.mockImplementation(() => { throw error; });
    await expect(runtime.invoke(policy.key, text, { requestId })).rejects.toBe(error);
    expect(invokeGateway).toHaveBeenCalledTimes(gatewayCalls);
    expect(onTelemetry).toHaveBeenCalledTimes(1);
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ requestId, policyHit }));
  });

  // T11–T13 characterize the current API for future design decisions.
  it('T11 places caller context in the system-role message', async () => {
    const { runtime, invokeGateway } = setup();
    const systemContext = 'Synthetic reference marker 17';
    await runtime.invoke(policy.key, input, { requestId, systemContext });
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    const [{ messages }] = invokeGateway.mock.calls[0];
    expect(messages).toEqual([
      { role: 'system', content: expect.stringContaining(systemContext) },
      { role: 'user', content: input },
    ]);
    expect(messages[0].content).toContain(policy.system);
  });

  it('T12 returns the T04 fixture verbatim when the schema is omitted', async () => {
    const { runtime, invokeGateway } = setup();
    invokeGateway.mockResolvedValue(flaggedOutput);
    const result = await runtime.invoke(policy.key, input, { requestId });
    expect(result).toEqual({ success: true, refused: false, requestId, data: flaggedOutput });
    expect(invokeGateway).toHaveBeenCalledTimes(1);
  });

  it('T13 forwards a different policy identity returned by a custom registry', async () => {
    const { runtime, getPolicy, invokeGateway } = setup();
    const other = { ...policy, id: 'alternate', version: '2.0.0', key: 'alternate@2.0.0' };
    getPolicy.mockReturnValue(other);
    const result = await runtime.invoke(policy.key, input, { requestId });
    expect(getPolicy).toHaveBeenCalledWith(policy.id, policy.version);
    expect(result.success).toBe(true);
    expect(invokeGateway).toHaveBeenCalledTimes(1);
    expect(invokeGateway).toHaveBeenCalledWith(expect.objectContaining({ policy: other, requestId }));
  });

  it('T13 rejects before the gateway when the custom registry omits constraints', async () => {
    const { runtime, getPolicy, invokeGateway } = setup();
    const { constraints: _omitted, ...incomplete } = policy;
    // @ts-expect-error A JavaScript host can return a policy missing this required field.
    getPolicy.mockReturnValue(incomplete);
    await expect(runtime.invoke(policy.key, input, { requestId })).rejects.toBeInstanceOf(TypeError);
    expect(invokeGateway).not.toHaveBeenCalled();
  });
});
