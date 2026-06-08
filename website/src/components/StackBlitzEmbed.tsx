import { useState, useSyncExternalStore } from 'react';

import styles from './StackBlitzEmbed.module.css';

type StackBlitzEmbedProps = {
  title: string;
  src: string;
  openHref: string;
  height?: number;
};

const subscribeToCrossOriginIsolation = () => () => {};
const getCrossOriginIsolationSnapshot = () => window.crossOriginIsolated;
const getServerCrossOriginIsolationSnapshot = () => false;

export default function StackBlitzEmbed({ title, src, openHref, height = 760 }: StackBlitzEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const canEmbedWebContainer = useSyncExternalStore(
    subscribeToCrossOriginIsolation,
    getCrossOriginIsolationSnapshot,
    getServerCrossOriginIsolationSnapshot
  );

  return (
    <div className={styles.container}>
      {!canEmbedWebContainer ? (
        <>
          <p className={styles.notice}>
            GitHub Pages does not serve the isolation headers required for embedded StackBlitz WebContainers. Open the
            demo in StackBlitz to run it interactively.
          </p>
          <div className={styles.actionRow}>
            <a href={openHref} target="_blank" rel="noreferrer" className={styles.primaryAction}>
              Open interactive demo
            </a>
          </div>
        </>
      ) : !loaded ? (
        <>
          <p>This demo uses an embedded StackBlitz sandbox. Load it inline or open it in a new tab.</p>
          <div className={styles.actionRow}>
            <button className={styles.primaryAction} type="button" onClick={() => setLoaded(true)}>
              Load interactive demo
            </button>
            <a href={openHref} target="_blank" rel="noreferrer" className={styles.secondaryAction}>
              Open in StackBlitz
            </a>
          </div>
        </>
      ) : (
        <iframe
          title={title}
          src={src}
          loading="lazy"
          className={styles.frame}
          height={height}
          allow="cross-origin-isolated; clipboard-read; clipboard-write"
        />
      )}

      {canEmbedWebContainer && loaded ? (
        <a href={openHref} target="_blank" rel="noreferrer">
          Open demo in StackBlitz
        </a>
      ) : null}
    </div>
  );
}
