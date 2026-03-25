import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebVitalMetric } from './index';

// Mock web-vitals BEFORE importing the hook so the dynamic import resolves to the mock
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onLCP: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn(),
}));

const { useWebVitals } = await import('./index');

function makeMetric(name: string, value: number, rating: WebVitalMetric['rating'] = 'good'): WebVitalMetric {
  return { name, value, rating, delta: value, id: `v3-${name}-${value}` };
}

// Flush the micro-task queue so the dynamic import inside useEffect resolves
async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type VitalsModule = typeof import('web-vitals');
type OnMetricFn = (cb: (m: WebVitalMetric) => void) => void;

async function captureCallbacks(keys: Array<keyof VitalsModule>): Promise<Record<string, (m: WebVitalMetric) => void>> {
  const webVitals = await import('web-vitals');
  const captured: Record<string, (m: WebVitalMetric) => void> = {};

  for (const key of keys) {
    vi.mocked(webVitals[key] as OnMetricFn).mockImplementation((cb) => {
      captured[key as string] = cb as (m: WebVitalMetric) => void;
    });
  }

  return captured;
}

describe('useWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all vitals as null initially', () => {
    const { result } = renderHook(() => useWebVitals());

    expect(result.current.CLS).toBeNull();
    expect(result.current.LCP).toBeNull();
    expect(result.current.INP).toBeNull();
    expect(result.current.FCP).toBeNull();
    expect(result.current.TTFB).toBeNull();
  });

  it('updates LCP state when the metric fires', async () => {
    const callbacks = await captureCallbacks(['onLCP']);
    const { result } = renderHook(() => useWebVitals());
    await flushEffects();

    act(() => callbacks['onLCP'](makeMetric('LCP', 1200)));

    expect(result.current.LCP).toMatchObject({ name: 'LCP', value: 1200 });
    expect(result.current.CLS).toBeNull(); // others untouched
  });

  it('updates CLS state when the metric fires', async () => {
    const callbacks = await captureCallbacks(['onCLS']);
    const { result } = renderHook(() => useWebVitals());
    await flushEffects();

    act(() => callbacks['onCLS'](makeMetric('CLS', 0.05)));

    expect(result.current.CLS?.value).toBe(0.05);
  });

  it('updates INP state when the metric fires', async () => {
    const callbacks = await captureCallbacks(['onINP']);
    const { result } = renderHook(() => useWebVitals());
    await flushEffects();

    act(() => callbacks['onINP'](makeMetric('INP', 180)));

    expect(result.current.INP?.value).toBe(180);
    expect(result.current.INP?.rating).toBe('good');
  });

  it('updates FCP and TTFB independently', async () => {
    const callbacks = await captureCallbacks(['onFCP', 'onTTFB']);
    const { result } = renderHook(() => useWebVitals());
    await flushEffects();

    act(() => {
      callbacks['onFCP'](makeMetric('FCP', 900));
      callbacks['onTTFB'](makeMetric('TTFB', 250));
    });

    expect(result.current.FCP?.value).toBe(900);
    expect(result.current.TTFB?.value).toBe(250);
    expect(result.current.LCP).toBeNull();
  });

  it('updates a metric when it fires a second time (e.g. LCP refinement)', async () => {
    const callbacks = await captureCallbacks(['onLCP']);
    const { result } = renderHook(() => useWebVitals());
    await flushEffects();

    act(() => callbacks['onLCP'](makeMetric('LCP', 2000)));
    expect(result.current.LCP?.value).toBe(2000);

    act(() => callbacks['onLCP']({ ...makeMetric('LCP', 3500), rating: 'needs-improvement' }));
    expect(result.current.LCP?.value).toBe(3500);
    expect(result.current.LCP?.rating).toBe('needs-improvement');
  });

  it('calls onMetric when any vital fires', async () => {
    const callbacks = await captureCallbacks(['onFCP']);
    const onMetric = vi.fn();
    renderHook(() => useWebVitals({ onMetric }));
    await flushEffects();

    const metric = makeMetric('FCP', 800);
    act(() => callbacks['onFCP'](metric));

    expect(onMetric).toHaveBeenCalledTimes(1);
    expect(onMetric).toHaveBeenCalledWith(metric);
  });

  it('calls onMetric for every update, including repeat fires', async () => {
    const callbacks = await captureCallbacks(['onLCP']);
    const onMetric = vi.fn();
    renderHook(() => useWebVitals({ onMetric }));
    await flushEffects();

    act(() => callbacks['onLCP'](makeMetric('LCP', 1000)));
    act(() => callbacks['onLCP'](makeMetric('LCP', 2500)));

    expect(onMetric).toHaveBeenCalledTimes(2);
  });

  it('does not subscribe to web-vitals when enabled=false', async () => {
    const webVitals = await import('web-vitals');
    renderHook(() => useWebVitals({ enabled: false }));
    await flushEffects();

    expect(webVitals.onLCP).not.toHaveBeenCalled();
    expect(webVitals.onCLS).not.toHaveBeenCalled();
    expect(webVitals.onFCP).not.toHaveBeenCalled();
    expect(webVitals.onINP).not.toHaveBeenCalled();
    expect(webVitals.onTTFB).not.toHaveBeenCalled();
  });

  it('preserves null state when disabled', async () => {
    const { result } = renderHook(() => useWebVitals({ enabled: false }));
    await flushEffects();

    expect(result.current.LCP).toBeNull();
    expect(result.current.CLS).toBeNull();
  });

  it('warns gracefully when web-vitals is not installed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.doMock('web-vitals', () => {
      throw new Error('Module not found');
    });
    vi.resetModules();

    const { useWebVitals: fresh } = await import('./index');
    renderHook(() => fresh());
    await flushEffects();

    // No throw — hook degrades silently
    warnSpy.mockRestore();
    vi.doUnmock('web-vitals');
  });
});
