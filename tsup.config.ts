import { defineConfig } from 'tsup';

export default defineConfig({
  // Single entry point — tree-shaking handles the rest
  entry: ['src/index.ts'],
  // Emit both CJS (require) and ESM (import) builds
  format: ['cjs', 'esm'],
  // Generate .d.ts declarations alongside the bundles
  dts: true,
  // Clean dist/ before each build
  clean: true,
  // Do NOT bundle peer/optional deps
  external: ['react', 'react-dom', 'web-vitals'],
  // Inline sourcemaps for better debugging
  sourcemap: true,
  // Remove dead code
  treeshake: true,
  // Keep readable for auditing; minification done by consumer's bundler
  minify: false,
  // Split each hook into its own chunk for optimal tree-shaking
  splitting: false,
  // Target modern environments (same as tsconfig)
  target: 'es2018',
});
