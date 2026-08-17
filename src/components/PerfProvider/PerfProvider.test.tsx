import { render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PerfProvider, usePerfContext, type PerfContextValue } from './index';

describe('PerfProvider', () => {
  it('returns null from usePerfContext when no provider is present', () => {
    const { result } = renderHook(() => usePerfContext());

    expect(result.current).toBeNull();
  });

  it('exposes reportMetric that forwards to onMetricsReport', () => {
    const onMetricsReport = vi.fn();

    const { result } = renderHook(() => usePerfContext(), {
      wrapper: ({ children }) => (
        <PerfProvider onMetricsReport={onMetricsReport}>{children}</PerfProvider>
      ),
    });

    result.current?.reportMetric('INP', 250, { rating: 'poor' });

    expect(onMetricsReport).toHaveBeenCalledWith('INP', 250, { rating: 'poor' });
  });

  it('always calls the latest onMetricsReport handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    let capturedContext: PerfContextValue | null = null;

    function Capture() {
      capturedContext = usePerfContext();
      return null;
    }

    const { rerender } = render(
      <PerfProvider onMetricsReport={first}>
        <Capture />
      </PerfProvider>,
    );

    rerender(
      <PerfProvider onMetricsReport={second}>
        <Capture />
      </PerfProvider>,
    );

    capturedContext?.reportMetric('CLS', 0.05);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('CLS', 0.05, undefined);
  });

  it('renders children', () => {
    const { getByText } = render(
      <PerfProvider onMetricsReport={vi.fn()}>
        <span>child</span>
      </PerfProvider>,
    );

    expect(getByText('child')).toBeInTheDocument();
  });
});
