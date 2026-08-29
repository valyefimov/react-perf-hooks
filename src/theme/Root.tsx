import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

// GitHub Pages can't send custom HTTP headers, so `window.crossOriginIsolated`
// is always false there. The embedded StackBlitz demos (see
// src/components/StackBlitzEmbed.tsx) need it to be true to boot WebContainers.
// Registering static/coi-serviceworker.js makes the browser treat this origin
// as cross-origin isolated by injecting COOP/COEP headers client-side.
const RELOAD_FLAG = 'coi-serviceworker-reloaded';

function useCoiServiceWorker(): void {
  const workerUrl = useBaseUrl('/coi-serviceworker.js');

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM) return;
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
    // Either the headers are already present, or a previous registration is
    // already controlling this page - nothing left to do.
    if (window.crossOriginIsolated) return;

    let cancelled = false;

    // On first install the worker only starts controlling the page once it
    // reaches "activated" (via skipWaiting + clients.claim in the worker),
    // which `controllerchange` fires for - `registration.active` is still
    // null immediately after `register()` resolves, so checking it there
    // misses the very first install and leaves the page non-isolated.
    // Reload once (guarded by sessionStorage) to pick up the newly-applied
    // headers immediately instead of waiting for a manual navigation.
    const reloadOnce = () => {
      if (cancelled) return;
      if (window.sessionStorage.getItem(RELOAD_FLAG)) return;

      window.sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    navigator.serviceWorker.register(workerUrl).catch((error) => {
      console.error('[coi-serviceworker] registration failed', error);
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
    };
  }, [workerUrl]);
}

export default function Root({ children }: { children: ReactNode }): ReactNode {
  useCoiServiceWorker();

  return children;
}
