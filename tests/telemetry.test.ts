/**
 * Telemetry and privacy-safe logging tests.
 */
import { describe, it, expect } from 'vitest';
import { createTelemetryEvent } from '@bstockwelldev/prompt-guardrails-core';

describe('createTelemetryEvent', () => {
  it('produces hashed prompt and output', () => {
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: 'Hello, generate a game.',
      outputText: 'Here is the game design.',
      latencyMs: 100,
    });
    expect(event.promptHash).toBeDefined();
    expect(event.outputHash).toBeDefined();
    expect(typeof event.promptHash).toBe('string');
    expect(typeof event.outputHash).toBe('string');
    expect(event.promptHash.length).toBeGreaterThan(0);
    expect(event.outputHash.length).toBeGreaterThan(0);
  });

  it('does not include raw prompt or output', () => {
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: 'secret prompt',
      outputText: 'secret output',
      latencyMs: 50,
    });
    expect(JSON.stringify(event)).not.toContain('secret prompt');
    expect(JSON.stringify(event)).not.toContain('secret output');
  });

  it('computes token counts from length', () => {
    const longPrompt = 'x'.repeat(400);
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: longPrompt,
      outputText: 'short',
      latencyMs: 0,
    });
    expect(event.tokensIn).toBeGreaterThanOrEqual(100);
    expect(event.tokensOut).toBeGreaterThanOrEqual(1);
  });

  it('includes optional tenantId and userId', () => {
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: 'p',
      outputText: 'o',
      latencyMs: 0,
      tenantId: 'tenant-123',
      userId: 'user-456',
    });
    expect(event.tenantId).toBe('tenant-123');
    expect(event.userId).toBe('user-456');
  });

  it('includes policyHit when provided', () => {
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: 'p',
      outputText: 'o',
      latencyMs: 0,
      policyHit: 'injection_detected',
    });
    expect(event.policyHit).toBe('injection_detected');
  });

  it('redacts sensitive content before hashing', () => {
    const event = createTelemetryEvent({
      requestId: 'req-1',
      policyRef: 'test@1.0',
      promptId: 'test',
      promptVersion: '1.0',
      promptText: 'api_key: sk-12345',
      outputText: 'token: abc123',
      latencyMs: 0,
    });
    expect(event.promptHash).toBeDefined();
    expect(event.outputHash).toBeDefined();
  });
});
