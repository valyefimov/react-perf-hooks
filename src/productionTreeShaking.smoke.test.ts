// @vitest-environment node
import path from 'node:path';
import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';

// Simulates how a consumer's bundler (Vite/Webpack/Rollup via esbuild/terser)
// sees this library: NODE_ENV is statically defined at build time, so the
// hard `if (process.env.NODE_ENV === 'production')` gates at the top of the
// dev-only hooks (see issue #35) should let the minifier's dead-code
// elimination drop the diagnostic logic entirely.

const entry = path.resolve(__dirname, 'index.ts');

async function bundleSingleHookImport(hookName: string, nodeEnv: 'development' | 'production') {
  const result = await esbuild.build({
    stdin: {
      contents: `export { ${hookName} } from ${JSON.stringify(entry)};`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2018',
    external: ['react', 'react-dom', 'web-vitals'],
    define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
    logLevel: 'silent',
  });

  return result.outputFiles[0].text;
}

describe('production tree-shaking (NODE_ENV gates)', () => {
  it('strips useRenderCount logging/tracking logic entirely in production', async () => {
    const prodCode = await bundleSingleHookImport('useRenderCount', 'production');

    expect(prodCode).not.toContain('[useRenderCount]');
    expect(prodCode).not.toContain('rendered');
    expect(prodCode).not.toContain('warning threshold');
  });

  it.each(['useWhyDidYouUpdate', 'useAllocationTracker', 'useRenderCount'])(
    '%s: production bundle is smaller than the development bundle',
    async (hookName) => {
      const [devCode, prodCode] = await Promise.all([
        bundleSingleHookImport(hookName, 'development'),
        bundleSingleHookImport(hookName, 'production'),
      ]);

      expect(prodCode.length).toBeLessThan(devCode.length);
    },
  );
});
