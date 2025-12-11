import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/results.json',
    },
  },
});
