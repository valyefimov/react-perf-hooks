import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNetworkEfficiency } from './index';

type ObserverCallback = (
  list: { getEntries: () => PerformanceEntry[] },
  observer: PerformanceObserver,
) => void;

const originalPerformanceObserver = globalThis.PerformanceObserver;
const originalNavigatorConnectionDescriptor = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'connection',
);

class MockPerformanceObserver {
  static supportedEntryTypes = ['resource'];
  static callback: ObserverCallback | null = null;
  static observe = vi.fn();
  static disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    MockPerformanceObserver.callback = callback;
  }

  observe(options: PerformanceObserverInit): void {
    MockPerformanceObserver.observe(options);
  }

  disconnect(): void {
    MockPerformanceObserver.disconnect();
  }
}

function mockPerformanceObserver(entryTypes: string[] = ['resource']): void {
  MockPerformanceObserver.supportedEntryTypes = entryTypes;
  globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;
}

function mockResourceEntries(entries: PerformanceResourceTiming[]): void {
  vi.spyOn(performance, 'getEntriesByType').mockImplementation((type: string) =>
    type === 'resource' ? entries : [],
  );
}

function mockConnection(effectiveType?: string, saveData = false): void {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: effectiveType ? { effectiveType, saveData } : undefined,
  });
}

function createResourceEntry(
  overrides: Partial<PerformanceResourceTiming> & { name: string },
): PerformanceResourceTiming {
  return {
    name: overrides.name,
    entryType: 'resource',
    startTime: overrides.startTime ?? 0,
    duration: overrides.duration ?? 20,
    initiatorType: overrides.initiatorType ?? 'fetch',
    nextHopProtocol: '',
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 0,
    transferSize: overrides.transferSize ?? 0,
    encodedBodySize: overrides.encodedBodySize ?? 0,
    decodedBodySize: overrides.decodedBodySize ?? 0,
    responseStatus: 200,
    renderBlockingStatus: 'non-blocking',
    serverTiming: [],
    contentType: '',
    deliveryType: '',
    toJSON: () => ({}),
  } as PerformanceResourceTiming;
}

function emitResource(entry: PerformanceResourceTiming): void {
  act(() => {
    MockPerformanceObserver.callback?.(
      {
        getEntries: () => [entry],
      },
      {} as PerformanceObserver,
    );
  });
}

describe('useNetworkEfficiency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    MockPerformanceObserver.callback = null;
    mockPerformanceObserver();
    mockResourceEntries([]);
    mockConnection(undefined);
  });

  afterEach(() => {
    globalThis.PerformanceObserver = originalPerformanceObserver;
    vi.unstubAllGlobals();

    if (originalNavigatorConnectionDescriptor) {
      Object.defineProperty(navigator, 'connection', originalNavigatorConnectionDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'connection');
    }
  });

  it('reads existing resource entries and matches a string resource filter', () => {
    const onWarning = vi.fn();
    mockResourceEntries([
      createResourceEntry({
        name: 'https://example.com/api/v1/light-data',
        transferSize: 128_000,
      }),
      createResourceEntry({
        name: 'https://example.com/api/v1/heavy-data',
        transferSize: 700_000,
        startTime: 10,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: '/api/v1/heavy-data',
        maxSizeInBytes: 500_000,
        onWarning,
      }),
    );

    expect(result.current.lastPayloadSize).toBe(700_000);
    expect(result.current.isInefficient).toBe(true);
    expect(result.current.latest).toMatchObject({
      name: 'https://example.com/api/v1/heavy-data',
      transferSize: 700_000,
      payloadSize: 700_000,
      effectiveMaxSizeInBytes: 500_000,
    });
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'https://example.com/api/v1/heavy-data',
        isInefficient: true,
      }),
    );
  });

  it('matches regex resource filters from observed resource entries', () => {
    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: /\/api\/v\d+\/heavy-data/,
        maxSizeInBytes: 500_000,
      }),
    );

    emitResource(
      createResourceEntry({
        name: 'https://example.com/api/v2/heavy-data?cursor=1',
        transferSize: 550_000,
        startTime: 20,
      }),
    );

    expect(MockPerformanceObserver.observe).toHaveBeenCalledWith({
      type: 'resource',
      buffered: true,
    });
    expect(result.current.lastPayloadSize).toBe(550_000);
    expect(result.current.isInefficient).toBe(true);
  });

  it('falls back from transferSize to encodedBodySize and decodedBodySize', () => {
    mockResourceEntries([
      createResourceEntry({
        name: '/api/v1/compressed',
        transferSize: 0,
        encodedBodySize: 300_000,
        decodedBodySize: 900_000,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: '/api/v1/compressed',
        maxSizeInBytes: 250_000,
      }),
    );

    expect(result.current.lastPayloadSize).toBe(300_000);
    expect(result.current.latest).toMatchObject({
      transferSize: 0,
      encodedBodySize: 300_000,
      decodedBodySize: 900_000,
    });
  });

  it('uses decodedBodySize when other byte sizes are unavailable', () => {
    mockResourceEntries([
      createResourceEntry({
        name: '/api/v1/decoded-only',
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 350_000,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: '/api/v1/decoded-only',
        maxSizeInBytes: 300_000,
      }),
    );

    expect(result.current.lastPayloadSize).toBe(350_000);
    expect(result.current.isInefficient).toBe(true);
  });

  it('lowers the threshold on 3g connections', () => {
    mockConnection('3g');
    mockResourceEntries([
      createResourceEntry({
        name: '/api/v1/mobile-data',
        transferSize: 300_000,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: '/api/v1/mobile-data',
        maxSizeInBytes: 500_000,
      }),
    );

    expect(result.current.effectiveType).toBe('3g');
    expect(result.current.effectiveMaxSizeInBytes).toBe(250_000);
    expect(result.current.isInefficient).toBe(true);
  });

  it('lowers the threshold more aggressively on slow-2g connections', () => {
    mockConnection('slow-2g');

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        maxSizeInBytes: 400_000,
      }),
    );

    expect(result.current.effectiveType).toBe('slow-2g');
    expect(result.current.effectiveMaxSizeInBytes).toBe(100_000);
  });

  it('gracefully degrades when Network Information API is unavailable', () => {
    mockResourceEntries([
      createResourceEntry({
        name: '/api/v1/heavy-data',
        transferSize: 450_000,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        resourceFilter: '/api/v1/heavy-data',
        maxSizeInBytes: 500_000,
      }),
    );

    expect(result.current.effectiveType).toBeNull();
    expect(result.current.effectiveMaxSizeInBytes).toBe(500_000);
    expect(result.current.isInefficient).toBe(false);
  });

  it('does not observe or scan when disabled', () => {
    mockResourceEntries([
      createResourceEntry({
        name: '/api/v1/heavy-data',
        transferSize: 700_000,
      }),
    ]);

    const { result } = renderHook(() =>
      useNetworkEfficiency({
        enabled: false,
        resourceFilter: '/api/v1/heavy-data',
      }),
    );

    expect(result.current.lastPayloadSize).toBeNull();
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('returns unsupported state when resource timing is unavailable', () => {
    vi.stubGlobal('performance', {
      now: () => 0,
    });

    const { result } = renderHook(() => useNetworkEfficiency());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.lastPayloadSize).toBeNull();
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });
});
