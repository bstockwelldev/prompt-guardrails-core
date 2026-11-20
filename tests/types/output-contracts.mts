// Compile with strictNullChecks against the built package or its installed tarball.
import { z } from 'zod';
import {
  createPromptRuntime, withPromptGuardrails,
  type PromptInvocationResult, type InvocationHandler,
} from '@bstockwelldev/prompt-guardrails-core';

const schema = z.object({ label: z.string() });
type Label = z.output<typeof schema>;
const config = {
  getPolicy: () => ({
    id: 'p', version: '1', key: 'p@1', system: 'Classify.', constraints: { maxTokens: 64 },
  }),
  invokeGateway: async () => '{"label":"sample"}',
  getPolicyRef: () => 'p@1',
  getUserData: (input: string) => input,
};
const runtime = createPromptRuntime(config);

// Both directions matter. A wider output would hide regressions in inference.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function check<T extends true>() {}

async function verify(optional: typeof schema | undefined, bag: { outputSchema?: typeof schema }) {
  const raw = await runtime.invoke('p@1', 'sample');
  const explicitUndefined = await runtime.invoke('p@1', 'sample', { outputSchema: undefined });
  const parsed = await runtime.invoke('p@1', 'sample', { outputSchema: schema });
  const maybe = await runtime.invoke('p@1', 'sample', { outputSchema: optional });
  const fromBag = await runtime.invoke('p@1', 'sample', bag);
  const transformed = await runtime.invoke('p@1', 'sample', { outputSchema: schema.transform(x => x.label.length) });
  check<Equal<typeof raw, PromptInvocationResult<string>>>();
  check<Equal<typeof explicitUndefined, typeof raw>>();
  check<Equal<typeof parsed, PromptInvocationResult<Label>>>();
  check<Equal<typeof maybe, PromptInvocationResult<string | Label>>>();
  check<Equal<typeof fromBag, typeof maybe>>();
  check<Equal<typeof transformed, PromptInvocationResult<number>>>();
  if (!raw.success) {
    // @ts-expect-error A refusal contains no output.
    raw.data;
  }
  const rawHandler: InvocationHandler<string, string, string> = async (_input, _ctx, r) =>
    r.success ? r.data : r.reason;
  withPromptGuardrails(config, (_input, _ctx, r) => {
    check<Equal<typeof r, typeof raw>>();
    return Promise.resolve('ok');
  });
  withPromptGuardrails({ ...config, outputSchema: undefined }, rawHandler);
  withPromptGuardrails({ ...config, outputSchema: schema }, (_input, _ctx, r) => {
    check<Equal<typeof r, typeof parsed>>();
    return Promise.resolve('ok');
  });
  withPromptGuardrails({ ...config, ...bag }, (_input, _ctx, r) => {
    check<Equal<typeof r, typeof maybe>>();
    return Promise.resolve('ok');
  });
  // @ts-expect-error An optional schema can produce a parsed object.
  withPromptGuardrails({ ...config, outputSchema: optional }, rawHandler);
  // @ts-expect-error Raw middleware cannot claim a structured result.
  withPromptGuardrails<string, string, Label>(config, async () => 'ok');
  // @ts-expect-error Structured data requires a schema.
  runtime.invoke<Label>('p@1', 'sample');
  // @ts-expect-error An explicitly undefined schema cannot guarantee Label.
  const invalid: PromptInvocationResult<Label> = await runtime.invoke<Label>('p@1', 'sample', { outputSchema: undefined });
}
void verify;
