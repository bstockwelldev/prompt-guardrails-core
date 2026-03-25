import type { PromptTelemetryEvent } from './types.js';

export type SequentialStepOk<T> = {
  ok: true;
  data: T;
  telemetry?: PromptTelemetryEvent;
};

export type SequentialStepFail = {
  ok: false;
  reason: string;
};

export type SequentialStepResult<T> = SequentialStepOk<T> | SequentialStepFail;

/**
 * Run async steps in order; stop on first failure. Aggregates optional per-step telemetry.
 */
export async function invokeSequential(
  steps: Array<() => Promise<SequentialStepResult<unknown>>>,
): Promise<
  | { ok: true; results: unknown[]; telemetry: PromptTelemetryEvent[] }
  | { ok: false; index: number; reason: string }
> {
  const results: unknown[] = [];
  const telemetry: PromptTelemetryEvent[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const out = await step();
    if (!out.ok) {
      return { ok: false, index: i, reason: out.reason };
    }
    results.push(out.data);
    if (out.telemetry) telemetry.push(out.telemetry);
  }

  return { ok: true, results, telemetry };
}
