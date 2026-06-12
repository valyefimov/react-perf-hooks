import { useEffect, useRef, useState } from 'react';

export interface UseFpsOptions {
  /**
   * FPS threshold used to flag low-performance mode.
   * Defaults to `30`.
   */
  threshold?: number;
  /**
   * Number of recent frame deltas used for the moving average.
   * Defaults to `10`.
   */
  windowSize?: number;
  /**
   * Called when the rolling FPS average crosses below `threshold`.
   */
  onDrop?: (currentFps: number) => void;
  /**
   * Set to `false` to disable the rAF loop entirely.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseFpsReturn {
  /** Rolling-averaged frames per second. Returns `0` until the first measured frame. */
  fps: number;
  /** Whether the rolling FPS average is below the configured threshold. */
  isLowPerformance: boolean;
  /** Whether this browser exposes requestAnimationFrame/cancelAnimationFrame. */
  isSupported: boolean;
}

const DEFAULT_THRESHOLD = 30;
const DEFAULT_WINDOW_SIZE = 10;
const DEFAULT_MAX_FRAME_DELTA_MS = 1000;

function supportsAnimationFrames(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function' &&
    typeof window.cancelAnimationFrame === 'function'
  );
}

function normalizeThreshold(threshold: number): number {
  return Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_THRESHOLD;
}

function normalizeWindowSize(windowSize: number): number {
  return Number.isFinite(windowSize) && windowSize > 0
    ? Math.max(1, Math.floor(windowSize))
    : DEFAULT_WINDOW_SIZE;
}

function toRoundedFps(averageFrameMs: number): number {
  if (averageFrameMs <= 0) return 0;

  return Number((1000 / averageFrameMs).toFixed(2));
}

/**
 * Measures the current frame rate with requestAnimationFrame and exposes a
 * rolling average so adaptive UI can disable expensive effects on slow devices.
 *
 * @example
 * function AdaptiveHero() {
 *   const { fps, isLowPerformance } = useFps({ threshold: 30, windowSize: 10 });
 *
 *   return isLowPerformance ? <StaticHero fps={fps} /> : <AnimatedHero fps={fps} />;
 * }
 */
export function useFps(options: UseFpsOptions = {}): UseFpsReturn {
  const {
    threshold = DEFAULT_THRESHOLD,
    windowSize = DEFAULT_WINDOW_SIZE,
    onDrop,
    enabled = true,
  } = options;
  const [state, setState] = useState({
    fps: 0,
    isLowPerformance: false,
  });
  const onDropRef = useRef(onDrop);
  const normalizedThreshold = normalizeThreshold(threshold);
  const normalizedWindowSize = normalizeWindowSize(windowSize);
  const isSupported = supportsAnimationFrames();

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!enabled || !isSupported) return;

    let animationFrameId: number | null = null;
    let previousFrameTime: number | null = null;
    let frameTotal = 0;
    let wasLowPerformance = false;
    let isDisposed = false;
    const frameDurations: number[] = [];

    const resetWindow = () => {
      previousFrameTime = null;
      frameTotal = 0;
      wasLowPerformance = false;
      frameDurations.length = 0;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resetWindow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const tick: FrameRequestCallback = (timestamp) => {
      if (isDisposed) return;

      if (previousFrameTime !== null) {
        const frameDuration = timestamp - previousFrameTime;

        if (
          Number.isFinite(frameDuration) &&
          frameDuration > 0 &&
          frameDuration <= DEFAULT_MAX_FRAME_DELTA_MS
        ) {
          frameDurations.push(frameDuration);
          frameTotal += frameDuration;

          if (frameDurations.length > normalizedWindowSize) {
            frameTotal -= frameDurations.shift() ?? 0;
          }

          const nextFps = toRoundedFps(frameTotal / frameDurations.length);
          const nextIsLowPerformance = nextFps < normalizedThreshold;

          if (nextIsLowPerformance && !wasLowPerformance) {
            onDropRef.current?.(nextFps);
          }

          wasLowPerformance = nextIsLowPerformance;

          setState((current) => {
            if (current.fps === nextFps && current.isLowPerformance === nextIsLowPerformance) {
              return current;
            }

            return {
              fps: nextFps,
              isLowPerformance: nextIsLowPerformance,
            };
          });
        }
      }

      previousFrameTime = timestamp;
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [enabled, isSupported, normalizedThreshold, normalizedWindowSize]);

  return {
    fps: state.fps,
    isLowPerformance: state.isLowPerformance,
    isSupported,
  };
}
