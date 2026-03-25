import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
      exclude: ['src/hooks/**/*.test.ts', 'src/hooks/**/*.test.tsx'],
    },
  },
});
