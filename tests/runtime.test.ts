import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createPromptRuntime,
  createPromptPolicyRegistry,
  loadPolicyConfig,
  PromptGuardrailsError,
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

  // T11–T12 characterize the current API for future design decisions.
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

  it.each([
    ['id', { id: 'alternate' }],
    ['version', { version: '2' }],
    ['key', { key: 'other@1' }],
    ['system', { system: '  ' }],
    ['missing constraints', { constraints: undefined }],
    ['token budget', { constraints: { maxTokens: 0 } }],
    ['temperature', { constraints: { maxTokens: 1, temperature: 3 } }],
    ['input limit', { constraints: { maxTokens: 1, maxInputLength: -1 } }],
    ['tool names', { constraints: { maxTokens: 1, tools: [7] } }],
  ])('T13 refuses invalid registry %s before the enablement hook', async (_name, override) => {
    const isPromptEnabled = vi.fn(() => true);
    const { runtime, getPolicy, invokeGateway } = setup({ isPromptEnabled });
    // A JavaScript registry can return values outside the TypeScript contract.
    getPolicy.mockReturnValue({ ...policy, ...override } as PromptPolicy);
    expect(() => loadPolicyConfig(policy.key, getPolicy)).toThrow(PromptGuardrailsError);
    const result = await runtime.invoke(policy.key, input, { requestId });
    expect(result).toMatchObject({ success: false, refused: true, reason: 'policy_invalid', requestId });
    expect(isPromptEnabled).not.toHaveBeenCalled();
    expect(invokeGateway).not.toHaveBeenCalled();
  });

  it.each(['custom', 'factory'])('dispatches a validated %s snapshot', async source => {
    const version = source === 'custom' ? '1' : '1.0.0';
    const key = `${policy.id}@${version}`;
    const constraints = { maxTokens: 30, temperature: 0, tools: ['lookup'], maxInputLength: 30 };
    const entry = { ...policy, key, version, constraints };
    const registry = source === 'custom' ? () => entry : createPromptPolicyRegistry([entry]);
    const isPromptEnabled = vi.fn(() => {
      constraints.tools.push('later');
      return true;
    });
    const { runtime, getPolicy, invokeGateway } = setup({ isPromptEnabled });
    getPolicy.mockImplementation(registry);
    const result = await runtime.invoke(`${policy.id}@v${version}`, input, { requestId });
    expect(result.success).toBe(true);
    expect(isPromptEnabled).toHaveBeenCalledWith(policy.id, version);
    expect(invokeGateway).toHaveBeenCalledWith(expect.objectContaining({
      policy: { ...entry, constraints: { ...constraints, tools: ['lookup'], allowUrls: false } },
    }));
  });

  it('enforces the validated custom input limit before dispatch', async () => {
    const { runtime, getPolicy, invokeGateway } = setup();
    getPolicy.mockReturnValue({ ...policy, constraints: { maxTokens: 8, maxInputLength: 2 } });
    expect(await runtime.invoke(policy.key, 'abc')).toMatchObject({ success: false, reason: 'input_too_long' });
    expect(invokeGateway).not.toHaveBeenCalled();
  });

  it('preserves the registry exception path', async () => {
    const { runtime, getPolicy, invokeGateway } = setup();
    getPolicy.mockImplementation(() => { throw new Error('synthetic registry failure'); });
    expect(await runtime.invoke(policy.key, input)).toMatchObject({
      success: false, reason: 'policy_disabled', message: 'synthetic registry failure',
    });
    expect(invokeGateway).not.toHaveBeenCalled();
  });
});
