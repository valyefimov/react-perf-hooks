import { useEffect, useId } from 'react';

export interface WhyDidYouUpdateChange {
  /** Prop key that changed */
  key: string;
  /** Value on the previous render */
  previousValue: unknown;
  /** Value on the current render */
  currentValue: unknown;
  /**
   * True when `deepCheck` found the previous and current values structurally
   * equal despite failing `Object.is()` — a wasted render caused purely by an
   * unstable reference (e.g. a new object/array/function literal each render).
   */
  referenceChangedOnly: boolean;
}

export interface UseWhyDidYouUpdateOptions {
  /**
   * Enable tracking. Defaults to true in development, false in production.
   * Pass `true` to force-enable in production (e.g. for debugging deploys).
   */
  enabled?: boolean;
  /** How to surface changes. `'console'` logs via console.group, `'object'` is silent. Default: `'console'` */
  logType?: 'console' | 'object';
  /**
   * Run a structural deep-equal check on changed values to distinguish real
   * data changes from reference-only changes. Default: false.
   */
  deepCheck?: boolean;
  /** Max recursion depth for deep comparison, guarding against pathological/circular structures. Default: 10 */
  maxDepth?: number;
}

const MAX_DEPTH_DEFAULT = 10;

const previousPropsByInstance = new Map<string, Record<string, unknown>>();

function deepEqual(a: unknown, b: unknown, depth: number, maxDepth: number, seen: WeakSet<object>): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  // Guard against runaway recursion on deep or cyclic structures.
  if (depth >= maxDepth || seen.has(a as object)) {
    return true;
  }
  seen.add(a as object);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index], depth + 1, maxDepth, seen));
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      depth + 1,
      maxDepth,
      seen,
    ),
  );
}

/**
 * Diagnoses wasted renders by diffing a component's props between renders and
 * reporting exactly which keys changed and whether the change was a real
 * value change or just a broken reference.
 *
 * @example
 * function HeavyList(props: Props) {
 *   useWhyDidYouUpdate('HeavyList', props, { deepCheck: true });
 *   return <ul>{...}</ul>;
 * }
 */
export function useWhyDidYouUpdate(
  name: string,
  props: Record<string, unknown>,
  options: UseWhyDidYouUpdateOptions = {},
): WhyDidYouUpdateChange[] {
  const {
    enabled = process.env.NODE_ENV !== 'production',
    logType = 'console',
    deepCheck = false,
    maxDepth = MAX_DEPTH_DEFAULT,
  } = options;

  const instanceId = useId();

  useEffect(() => {
    return () => {
      previousPropsByInstance.delete(instanceId);
    };
  }, [instanceId]);

  if (!enabled) {
    return [];
  }

  const previousProps = previousPropsByInstance.get(instanceId);
  const changes: WhyDidYouUpdateChange[] = [];

  if (previousProps) {
    const allKeys = new Set([...Object.keys(previousProps), ...Object.keys(props)]);

    allKeys.forEach((key) => {
      const previousValue = previousProps[key];
      const currentValue = props[key];

      if (!Object.is(previousValue, currentValue)) {
        const referenceChangedOnly = deepCheck
          ? deepEqual(previousValue, currentValue, 0, maxDepth, new WeakSet())
          : false;

        changes.push({ key, previousValue, currentValue, referenceChangedOnly });
      }
    });

    if (changes.length > 0 && logType === 'console') {
      console.group(`[useWhyDidYouUpdate] "${name}" re-rendered`);
      changes.forEach(({ key, previousValue, currentValue, referenceChangedOnly }) => {
        if (referenceChangedOnly) {
          console.log(`[Reference Changed Only] "${key}"`, { previousValue, currentValue });
        } else {
          console.log(`"${key}" changed`, { previousValue, currentValue });
        }
      });
      console.groupEnd();
    }
  }

  previousPropsByInstance.set(instanceId, props);

  return changes;
}
