import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFps } from './index';

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

let frameCallbacks: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

function installMockRaf(): void {
  frameCallbacks = new Map();
  nextFrameId = 0;
  requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    const frameId = ++nextFrameId;
    frameCallbacks.set(frameId, callback);
    return frameId;
  });
  cancelAnimationFrameMock = vi.fn((frameId: number) => {
    frameCallbacks.delete(frameId);
  });

  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: requestAnimationFrameMock,
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: cancelAnimationFrameMock,
  });
}

function restoreRaf(): void {
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: originalRequestAnimationFrame,
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: originalCancelAnimationFrame,
  });
}

function emitFrame(timestamp: number): void {
  const callbacks = Array.from(frameCallbacks.values());
  frameCallbacks.clear();

  act(() => {
    callbacks.forEach((callback) => callback(timestamp));
  });
}

function setVisibilityState(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
}

describe('useFps', () => {
  beforeEach(() => {
    installMockRaf();
    setVisibilityState('visible');
  });

  afterEach(() => {
    restoreRaf();
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalVisibilityStateDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('returns an initial supported state before the first measured frame', () => {
    const { result } = renderHook(() => useFps());

    expect(result.current.fps).toBe(0);
    expect(result.current.isLowPerformance).toBe(false);
    expect(result.current.isSupported).toBe(true);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
  });

  it('returns a rolling-averaged fps value', () => {
    const { result } = renderHook(() => useFps({ windowSize: 2 }));

    emitFrame(0);
    expect(result.current.fps).toBe(0);

    emitFrame(16);
    expect(result.current.fps).toBeCloseTo(62.5, 2);

    emitFrame(116);
    expect(result.current.fps).toBeCloseTo(17.24, 2);

    emitFrame(132);
    expect(result.current.fps).toBeCloseTo(17.24, 2);

    emitFrame(148);
    expect(result.current.fps).toBeCloseTo(62.5, 2);
  });

  it('flags low performance when rolling fps drops below the threshold', () => {
    const { result } = renderHook(() => useFps({ threshold: 30, windowSize: 2 }));

    emitFrame(0);
    emitFrame(16);

    expect(result.current.isLowPerformance).toBe(false);

    emitFrame(116);

    expect(result.current.fps).toBeCloseTo(17.24, 2);
    expect(result.current.isLowPerformance).toBe(true);
  });

  it('calls onDrop only when crossing into low-performance mode', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useFps({ threshold: 30, windowSize: 2, onDrop }));

    emitFrame(0);
    emitFrame(16);
    emitFrame(116);
    emitFrame(216);

    expect(result.current.isLowPerformance).toBe(true);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenLastCalledWith(17.24);

    emitFrame(232);
    emitFrame(248);

    expect(result.current.isLowPerformance).toBe(false);

    emitFrame(348);

    expect(result.current.isLowPerformance).toBe(true);
    expect(onDrop).toHaveBeenCalledTimes(2);
    expect(onDrop).toHaveBeenLastCalledWith(17.24);
  });

  it('skips very large deltas so paused requestAnimationFrame gaps do not trigger onDrop', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useFps({ threshold: 30, windowSize: 2, onDrop }));

    emitFrame(0);
    emitFrame(16);

    expect(result.current.fps).toBeCloseTo(62.5, 2);

    emitFrame(5016);

    expect(result.current.fps).toBeCloseTo(62.5, 2);
    expect(result.current.isLowPerformance).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();

    emitFrame(5032);

    expect(result.current.fps).toBeCloseTo(62.5, 2);
    expect(result.current.isLowPerformance).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('resets the rolling window when the document is hidden', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useFps({ threshold: 30, windowSize: 2, onDrop }));

    emitFrame(0);
    emitFrame(16);

    expect(result.current.fps).toBeCloseTo(62.5, 2);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    emitFrame(5016);

    expect(result.current.fps).toBeCloseTo(62.5, 2);
    expect(result.current.isLowPerformance).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();

    emitFrame(5032);

    expect(result.current.fps).toBeCloseTo(62.5, 2);
    expect(result.current.isLowPerformance).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('does not subscribe when enabled=false', () => {
    const { result } = renderHook(() => useFps({ enabled: false }));

    expect(result.current.isSupported).toBe(true);
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('returns unsupported state when requestAnimationFrame is unavailable', () => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useFps());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.fps).toBe(0);
    expect(result.current.isLowPerformance).toBe(false);
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('cancels the active animation frame on unmount', () => {
    const { unmount } = renderHook(() => useFps());

    emitFrame(0);
    const [activeFrameId] = Array.from(frameCallbacks.keys());

    unmount();

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(activeFrameId);
    expect(frameCallbacks.size).toBe(0);
  });
});
