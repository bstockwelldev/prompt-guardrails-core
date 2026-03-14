/**
 * Policy and schema contract tests.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePolicyRef,
  loadPolicyConfig,
  checkPolicyEnabled,
  createPromptPolicyRegistry,
  PromptRegistrySchema,
  PolicyConstraintsSchema,
} from '@bstockwelldev/prompt-guardrails-core';

describe('parsePolicyRef', () => {
  it('parses id@version', () => {
    const ref = parsePolicyRef('support_chatbot@1.3.0');
    expect(ref.id).toBe('support_chatbot');
    expect(ref.version).toBe('1.3.0');
    expect(ref.key).toBe('support_chatbot@1.3.0');
  });
  it('parses id@v1.2.3 and strips v prefix', () => {
    const ref = parsePolicyRef('test@v1.2.3');
    expect(ref.version).toBe('1.2.3');
  });
  it('throws for invalid format', () => {
    expect(() => parsePolicyRef('no-at-sign')).toThrow(/Invalid policy reference/);
  });
});

describe('loadPolicyConfig', () => {
  it('loads policy from registry', () => {
    const getPolicy = (id: string, version: string) =>
      id === 'test' && version === '1.0'
        ? {
            id: 'test',
            version: '1.0',
            key: 'test@1.0',
            system: 'You are helpful.',
            constraints: { maxTokens: 4096 },
          }
        : null;
    const policy = loadPolicyConfig('test@1.0', getPolicy);
    expect(policy.id).toBe('test');
    expect(policy.system).toBe('You are helpful.');
  });
  it('throws for unknown policy', () => {
    const getPolicy = () => null;
    expect(() => loadPolicyConfig('unknown@1.0', getPolicy)).toThrow(
      /Unknown policy/,
    );
  });
});

describe('checkPolicyEnabled', () => {
  const policy = {
    id: 'test',
    version: '1.0',
    key: 'test@1.0',
    system: 'x',
    constraints: { maxTokens: 100 },
  };
  it('returns true when isEnabled not provided', () => {
    expect(checkPolicyEnabled(policy)).toBe(true);
  });
  it('returns result of isEnabled when provided', () => {
    expect(checkPolicyEnabled(policy, () => true)).toBe(true);
    expect(checkPolicyEnabled(policy, () => false)).toBe(false);
  });
});

describe('createPromptPolicyRegistry', () => {
  const registry = [
    {
      id: 'test',
      version: '1.0.0',
      system: 'You are helpful.',
      constraints: { maxTokens: 4096, allowUrls: false },
    },
  ];
  it('creates registry from valid JSON', () => {
    const getPolicy = createPromptPolicyRegistry(registry);
    const policy = getPolicy('test', '1.0.0');
    expect(policy).not.toBeNull();
    expect(policy!.key).toBe('test@1.0.0');
    expect(policy!.constraints.allowUrls).toBe(false);
  });
  it('returns null for unknown id/version', () => {
    const getPolicy = createPromptPolicyRegistry(registry);
    expect(getPolicy('unknown', '1.0.0')).toBeNull();
  });
  it('throws for invalid registry schema', () => {
    expect(() => createPromptPolicyRegistry([{ invalid: 'entry' }])).toThrow();
  });
});

describe('PolicyConstraintsSchema', () => {
  it('accepts valid constraints', () => {
    const result = PolicyConstraintsSchema.safeParse({
      maxTokens: 4096,
      allowUrls: true,
    });
    expect(result.success).toBe(true);
  });
  it('rejects invalid maxTokens', () => {
    const result = PolicyConstraintsSchema.safeParse({
      maxTokens: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('PromptRegistrySchema', () => {
  it('accepts valid registry', () => {
    const result = PromptRegistrySchema.safeParse([
      {
        id: 'test',
        version: '1.0.0',
        system: 'x',
        constraints: { maxTokens: 100 },
      },
    ]);
    expect(result.success).toBe(true);
  });
  it('rejects empty array', () => {
    const result = PromptRegistrySchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});
