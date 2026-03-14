import { z } from 'zod';

/**
 * Zod schema for prompt policy constraints.
 */
export const PolicyConstraintsSchema = z.object({
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2).optional(),
  allowUrls: z.boolean().default(false),
  maxInputLength: z.number().int().positive().optional(),
  tools: z.array(z.string()).optional(),
});

/**
 * Zod schema for a single prompt policy entry.
 */
export const PromptPolicyEntrySchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver (e.g. 1.2.3)'),
  system: z.string().min(1),
  constraints: PolicyConstraintsSchema,
});

/**
 * Zod schema for a prompt policy registry (array of entries).
 */
export const PromptRegistrySchema = z.array(PromptPolicyEntrySchema).min(1);

export type PromptPolicyEntry = z.infer<typeof PromptPolicyEntrySchema>;
export type PolicyConstraints = z.infer<typeof PolicyConstraintsSchema>;
