import {useState, type CSSProperties} from 'react';

type StackBlitzEmbedProps = {
  title: string;
  src: string;
  openHref: string;
  height?: number;
};

const frameStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: '12px',
};

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
};

const buttonStyle: CSSProperties = {
  alignItems: 'center',
  background: 'var(--ifm-color-primary)',
  border: 'none',
  borderRadius: '10px',
  color: '#ffffff',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 700,
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0.7rem 1rem',
  width: 'fit-content',
};

export default function StackBlitzEmbed({
  title,
  src,
  openHref,
  height = 520,
}: StackBlitzEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={containerStyle}>
      {!loaded ? (
        <>
          <p>
            This demo uses an embedded StackBlitz sandbox. Load it inline or open it in a new tab.
          </p>
          <div>
            <button style={buttonStyle} type="button" onClick={() => setLoaded(true)}>
              Load interactive demo
            </button>
          </div>
        </>
      ) : (
        <iframe
          title={title}
          src={src}
          loading="lazy"
          style={{...frameStyle, height}}
          allow="clipboard-read; clipboard-write"
        />
      )}

      <a href={openHref} target="_blank" rel="noreferrer">
        Open demo in StackBlitz
      </a>
    </div>
  );
}
