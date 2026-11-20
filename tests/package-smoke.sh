#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
consumer_dir="$(mktemp -d)"
trap 'rm -rf -- "$consumer_dir"' EXIT

cd "$repo_dir"
npm pack --ignore-scripts --pack-destination "$consumer_dir"
# npm may print lifecycle output alongside the tarball name.
shopt -s nullglob
package_files=("$consumer_dir"/*.tgz)
if (( ${#package_files[@]} != 1 )); then
  echo 'Expected one npm tarball in the temporary consumer directory.' >&2
  exit 1
fi
zod_version="$(node -p "require('./package-lock.json').packages['node_modules/zod'].version")"
cp tests/types/output-contracts.mts "$consumer_dir/"

cd "$consumer_dir"
printf '%s\n' '{"private":true,"type":"module"}' > package.json
npm install --ignore-scripts --no-audit --no-fund "${package_files[0]}" "zod@$zod_version"
"$repo_dir/node_modules/.bin/tsc" --noEmit --strict --skipLibCheck \
  --target ES2020 --module NodeNext output-contracts.mts

node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { createPromptRuntime } from '@bstockwelldev/prompt-guardrails-core';
import { z } from 'zod';

const policy = {
  id: 'sample',
  version: '1',
  key: 'sample@1',
  system: 'Classify the sample.',
  constraints: { maxTokens: 64 },
};
const reply = ' {"label":"sample"} ';
const runtime = createPromptRuntime({
  getPolicy: () => policy,
  invokeGateway: async () => reply,
});

const requestId = 'package-smoke';
const raw = await runtime.invoke(policy.key, 'test input', { requestId });
assert.deepEqual(raw, { success: true, refused: false, requestId, data: reply });

const structured = await runtime.invoke(policy.key, 'test input', {
  requestId,
  outputSchema: z.object({ label: z.string() }),
});
assert.deepEqual(structured, {
  success: true,
  refused: false,
  requestId,
  data: { label: 'sample' },
});

console.log('Packed ESM entry point and runtime contracts passed.');
JS
