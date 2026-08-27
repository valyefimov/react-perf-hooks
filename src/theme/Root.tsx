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

    navigator.serviceWorker
      .register(workerUrl)
      .then((registration) => {
        if (cancelled) return;

        // On first install the worker isn't controlling this page yet, so the
        // injected headers only apply starting with the next navigation.
        // Reload once (guarded by sessionStorage) to pick that up immediately
        // instead of leaving the user on a non-isolated page.
        const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG);

        if (registration.active && !navigator.serviceWorker.controller && !alreadyReloaded) {
          window.sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      })
      .catch((error) => {
        console.error('[coi-serviceworker] registration failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [workerUrl]);
}

export default function Root({ children }: { children: ReactNode }): ReactNode {
  useCoiServiceWorker();

  return children;
}
