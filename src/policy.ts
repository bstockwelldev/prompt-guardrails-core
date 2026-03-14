import type { PromptPolicy, PolicyRef } from './types.js';
import { PromptRegistrySchema } from './schemas.js';

/**
 * Z3: Parse policy reference "id@version" or "id@v1.2.3".
 */
export function parsePolicyRef(policy: string): PolicyRef {
  const atIndex = policy.indexOf('@');
  if (atIndex === -1) {
    throw new Error(`Invalid policy reference: ${policy}`);
  }
  const idPart = policy.slice(0, atIndex);
  let versionPart = policy.slice(atIndex + 1);
  if (versionPart.startsWith('v')) versionPart = versionPart.slice(1);
  return { id: idPart, version: versionPart, key: policy };
}

export type PolicyRegistry = (id: string, version: string) => PromptPolicy | null;

export type PromptRuntimeConfig = {
  /** Resolve policy by id and version */
  getPolicy: PolicyRegistry;
  /** Optional: check if prompt is enabled (feature flag) */
  isPromptEnabled?: (id: string, version: string) => boolean;
  /** Optional: emit telemetry events */
  onTelemetry?: (event: import('./types.js').PromptTelemetryEvent) => void;
};

/**
 * Z2: Load policy config from registry.
 */
export function loadPolicyConfig(
  policyRef: string,
  getPolicy: PolicyRegistry,
): PromptPolicy {
  const ref = parsePolicyRef(policyRef);
  const policy = getPolicy(ref.id, ref.version);
  if (!policy) {
    throw new Error(`Unknown policy ${policyRef}`);
  }
  return policy;
}

/**
 * Z2: Check if policy is enabled (when feature flag provided).
 */
export function checkPolicyEnabled(
  policy: PromptPolicy,
  isEnabled?: (id: string, version: string) => boolean,
): boolean {
  if (!isEnabled) return true;
  return isEnabled(policy.id, policy.version);
}

/**
 * Create a PolicyRegistry from registry JSON.
 * Host apps can load and validate their registry, then pass the result.
 */
export function createPromptPolicyRegistry(
  registry: unknown,
): PolicyRegistry {
  const entries = PromptRegistrySchema.parse(registry);
  return (id: string, version: string): PromptPolicy | null => {
    const entry = entries.find((e) => e.id === id && e.version === version);
    if (!entry) return null;
    return {
      id: entry.id,
      version: entry.version,
      key: `${entry.id}@${entry.version}`,
      system: entry.system,
      constraints: {
        maxTokens: entry.constraints.maxTokens,
        temperature: entry.constraints.temperature,
        allowUrls: entry.constraints.allowUrls ?? false,
        maxInputLength: entry.constraints.maxInputLength,
        tools: entry.constraints.tools,
      },
    };
  };
}
