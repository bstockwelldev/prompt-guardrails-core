import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  css: false,
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@bstockwelldev/prompt-guardrails-core': resolve(__dirname, './src/index.ts'),
    },
  },
});
