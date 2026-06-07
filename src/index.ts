export { useRenderTracker } from './hooks/useRenderTracker';
export type { RenderInfo, UseRenderTrackerOptions } from './hooks/useRenderTracker';

export { useRenderBudget } from './hooks/useRenderBudget';
export type { UseRenderBudgetOptions } from './hooks/useRenderBudget';

export { usePerformanceMark } from './hooks/usePerformanceMark';
export type { PerformanceMeasureResult, UsePerformanceMarkReturn } from './hooks/usePerformanceMark';

export { useComponentLifecycle } from './hooks/useComponentLifecycle';
export type { ComponentLifecycleInfo } from './hooks/useComponentLifecycle';

export { getStats, useMemoProfiling } from './hooks/useMemoProfiling';
export type { MemoProfilingStats } from './hooks/useMemoProfiling';

export { useWebVitals } from './hooks/useWebVitals';
export type { WebVitalMetric, WebVitalsState, UseWebVitalsOptions, VitalRating } from './hooks/useWebVitals';

export { useINP } from './hooks/useINP';
export type { INPMetric, INPRating, UseINPOptions, UseINPReturn } from './hooks/useINP';

export { useCLS } from './hooks/useCLS';
export type { CLSAttribution, CLSMetric, CLSRating, UseCLSOptions, UseCLSReturn } from './hooks/useCLS';

export { useLongTasks } from './hooks/useLongTasks';
export type {
  LongTaskAttribution,
  LongTaskMetric,
  UseLongTasksOptions,
  UseLongTasksReturn,
} from './hooks/useLongTasks';

export { useDebouncedState } from './hooks/useDebouncedState';
export type { DebouncedStateStats, UseDebouncedStateReturn } from './hooks/useDebouncedState';

export { useThrottledState } from './hooks/useThrottledState';
export type { ThrottledStateStats, UseThrottledStateOptions, UseThrottledStateReturn } from './hooks/useThrottledState';

export { useIntersectionObserver } from './hooks/useIntersectionObserver';
export type { IntersectionObserverMetrics, UseIntersectionObserverReturn } from './hooks/useIntersectionObserver';
