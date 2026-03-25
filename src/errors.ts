/**
 * Machine-readable refusal reasons for prompt guardrails.
 * Used by host apps for logging, metrics, and user-facing messaging.
 */
export type PromptRefusalReason =
  | 'injection_detected'
  | 'url_blocked'
  | 'policy_disabled'
  | 'schema_invalid'
  | 'output_leakage_detected'
  | 'output_domain_validation_failed'
  | 'input_too_long'
  | 'control_characters_blocked';

export class PromptGuardrailsError extends Error {
  readonly reason: PromptRefusalReason;
  readonly details?: string;

  constructor(reason: PromptRefusalReason, message: string, details?: string) {
    super(message);
    this.name = 'PromptGuardrailsError';
    this.reason = reason;
    this.details = details;
    Object.setPrototypeOf(this, PromptGuardrailsError.prototype);
  }
}
