import { useState } from 'react';

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

// Keyed by a per-instance identity object rather than a string id so entries
// are garbage-collected automatically on unmount — no unmount effect needed,
// which sidesteps React Strict Mode's mount/cleanup/mount effect replay.
const previousPropsByInstance = new WeakMap<object, Record<string, unknown>>();

function deepEqual(
  a: unknown,
  b: unknown,
  depth: number,
  maxDepth: number,
  seen: WeakMap<object, Set<object>>,
): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  // A cycle we've already walked through is consistent so far; treat it as equal.
  const visitedForA = seen.get(a as object);
  if (visitedForA?.has(b as object)) return true;

  // Beyond the safety limit we can no longer verify equality — be conservative.
  if (depth >= maxDepth) return false;

  if (visitedForA) {
    visitedForA.add(b as object);
  } else {
    seen.set(a as object, new Set([b as object]));
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    return Array.from(a.entries()).every(
      ([key, value]) => b.has(key) && deepEqual(value, b.get(key), depth + 1, maxDepth, seen),
    );
  }

  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    return Array.from(a).every((value) => b.has(value));
  }

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

  const [instanceKey] = useState<object>(() => ({}));

  if (!enabled) {
    return [];
  }

  const previousProps = previousPropsByInstance.get(instanceKey);
  const changes: WhyDidYouUpdateChange[] = [];

  if (previousProps) {
    const allKeys = new Set([...Object.keys(previousProps), ...Object.keys(props)]);

    allKeys.forEach((key) => {
      const previousHasKey = Object.prototype.hasOwnProperty.call(previousProps, key);
      const currentHasKey = Object.prototype.hasOwnProperty.call(props, key);
      const previousValue = previousProps[key];
      const currentValue = props[key];

      if (previousHasKey !== currentHasKey || !Object.is(previousValue, currentValue)) {
        const referenceChangedOnly = deepCheck
          ? deepEqual(previousValue, currentValue, 0, maxDepth, new WeakMap())
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

  previousPropsByInstance.set(instanceKey, props);

  return changes;
}
