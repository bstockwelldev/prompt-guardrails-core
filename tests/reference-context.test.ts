import { expect, it, vi } from 'vitest';
import { buildMessages, createPromptRuntime, type GatewayAdapter } from '@bstockwelldev/prompt-guardrails-core';
import { INJECTION_VECTORS } from './fixtures/red-team.js';

const marker = 'sample excerpt';
const userMessage = 'task\n\nReference material:\n' + marker;
function setup(maxInputLength = 100) {
  const invokeGateway = vi.fn<GatewayAdapter>().mockResolvedValue('ok');
  const onTelemetry = vi.fn();
  const runtime = createPromptRuntime({
    getPolicy: () => ({
      id: 'p', version: '1', key: 'p@1', system: 'policy', constraints: { maxTokens: 64, maxInputLength },
    }),
    invokeGateway, onTelemetry,
  });
  return { runtime, invokeGateway, onTelemetry };
}

it.each([
  [undefined, undefined, 'policy', 'task'],
  [' ', ' ', 'policy', 'task'],
  ['trusted', undefined, 'policy\n\n<context>\ntrusted\n</context>', 'task'],
  [undefined, marker, 'policy', userMessage],
  ['trusted', marker, 'policy\n\n<context>\ntrusted\n</context>', userMessage],
])('routes system=%s and reference=%s', async (systemContext, referenceContext, system, user) => {
  const { runtime, invokeGateway, onTelemetry } = setup(userMessage.length);
  const result = await runtime.invoke('p@1', 'task', { systemContext, referenceContext });
  expect(result.success).toBe(true);
  const expected = [{ role: 'system', content: system }, { role: 'user', content: user }];
  expect(buildMessages({ system: 'policy', context: systemContext, userData: 'task', referenceContext })).toEqual(expected);
  expect(invokeGateway.mock.calls[0][0].messages).toEqual(expected);
  expect(onTelemetry).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(onTelemetry.mock.calls)).not.toContain(marker);
});

it.each([
  [marker + 'x', 'input_too_long'],
  ['https://example.invalid', 'url_blocked'],
  ['sample\u0000text', 'control_characters_blocked'],
])('refuses reference %s before dispatch', async (referenceContext, reason) => {
  const { runtime, invokeGateway, onTelemetry } = setup(userMessage.length);
  const result = await runtime.invoke('p@1', 'task', { referenceContext });
  expect(result).toMatchObject({ success: false, refused: true, reason });
  expect(invokeGateway).not.toHaveBeenCalled();
  expect(onTelemetry).toHaveBeenCalledTimes(1);
  expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ policyHit: reason }));
});

it.each(INJECTION_VECTORS)('refuses matching task and reference text before dispatch: %s', async text => {
  const { runtime, invokeGateway, onTelemetry } = setup();
  const taskResult = await runtime.invoke('p@1', text);
  const referenceResult = await runtime.invoke('p@1', 'task', { referenceContext: text });

  for (const result of [taskResult, referenceResult]) {
    expect(result).toMatchObject({
      success: false,
      refused: true,
      reason: 'injection_detected',
    });
  }
  expect(invokeGateway).not.toHaveBeenCalled();
  expect(onTelemetry).toHaveBeenCalledTimes(2);
  for (const [event] of onTelemetry.mock.calls) {
    expect(event).toMatchObject({ policyHit: 'injection_detected' });
  }
});

it('dispatches ordinary task and reference text once', async () => {
  const { runtime, invokeGateway, onTelemetry } = setup();
  const result = await runtime.invoke('p@1', 'task', { referenceContext: marker });

  expect(result).toMatchObject({ success: true, data: 'ok' });
  expect(invokeGateway).toHaveBeenCalledTimes(1);
  expect(onTelemetry).toHaveBeenCalledTimes(1);
  expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ policyHit: null }));
});
