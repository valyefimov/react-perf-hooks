import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRenderBudget } from './index';

function burnCpu(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Deliberate sync work to make render exceed small budgets in a deterministic way.
  }
}

describe('useRenderBudget', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('warns when render duration exceeds the default budget (16ms)', () => {
    renderHook(() => {
      useRenderBudget(undefined, 'MyComponent');
      burnCpu(20);
    });

    expect(console.warn).toHaveBeenCalled();
    const message = String(vi.mocked(console.warn).mock.calls[0]?.[0]);

    expect(message).toContain('MyComponent');
    expect(message).toContain('budget: 16ms');
    expect(message).toMatch(/exceeded budget: \d+(\.\d+)?ms/);
  });

  it('respects a custom budget', () => {
    renderHook(() => {
      useRenderBudget(1, 'CustomBudgetComponent');
      burnCpu(8);
    });

    expect(console.warn).toHaveBeenCalled();
    const message = String(vi.mocked(console.warn).mock.calls[0]?.[0]);

    expect(message).toContain('CustomBudgetComponent');
    expect(message).toContain('budget: 1ms');
  });

  it('does not warn when commit time stays within budget', () => {
    renderHook(() => useRenderBudget(200, 'FastComponent'));

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('throws instead of warning when strict mode is enabled', () => {
    expect(() =>
      renderHook(() => {
        useRenderBudget(1, 'StrictComponent', { strict: true });
        burnCpu(8);
      })
    ).toThrow('[useRenderBudget] StrictComponent exceeded budget');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('is a no-op in production by default', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      renderHook(() => {
        useRenderBudget(1, 'ProductionComponent', { strict: true });
        burnCpu(8);
      })
    ).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('can be force-enabled in production via options.enabled', () => {
    process.env.NODE_ENV = 'production';

    renderHook(() => {
      useRenderBudget(1, 'ProductionDebugComponent', { enabled: true });
      burnCpu(8);
    });

    expect(console.warn).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ProductionDebugComponent'));
  });

  it('falls back to the default component name when an empty label is passed', () => {
    renderHook(() => {
      useRenderBudget(1, '   ');
      burnCpu(8);
    });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[useRenderBudget] Component exceeded budget'));
  });
});
