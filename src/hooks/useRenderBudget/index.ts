import { useEffect, useLayoutEffect, useRef } from 'react';

export interface UseRenderBudgetOptions {
  /**
   * Enable tracking. Defaults to true in development, false in production.
   * Pass `true` to force-enable in production for targeted debugging.
   */
  enabled?: boolean;
  /**
   * Throw an error instead of logging a warning when the budget is exceeded.
   */
  strict?: boolean;
}

const DEFAULT_BUDGET_MS = 16;
const DEFAULT_COMPONENT_NAME = 'Component';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function formatMs(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Measures render start -> commit duration and warns when a component exceeds
 * a configurable frame budget.
 */
export function useRenderBudget(
  budgetMs = DEFAULT_BUDGET_MS,
  componentName = DEFAULT_COMPONENT_NAME,
  options: UseRenderBudgetOptions = {}
): void {
  const { strict = false, enabled = process.env.NODE_ENV !== 'production' } = options;

  const renderStartRef = useRef(0);

  const normalizedBudget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : DEFAULT_BUDGET_MS;
  const normalizedName = componentName.trim().length > 0 ? componentName : DEFAULT_COMPONENT_NAME;

  if (enabled) {
    renderStartRef.current = performance.now();
  }

  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;

    const elapsedMs = performance.now() - renderStartRef.current;

    if (elapsedMs <= normalizedBudget) return;

    const message =
      `⚠️ [useRenderBudget] ${normalizedName} exceeded budget: ${formatMs(elapsedMs)}ms ` +
      `(budget: ${formatMs(normalizedBudget)}ms)`;

    if (strict) {
      throw new Error(message);
    }

    console.warn(message);
  });
}
