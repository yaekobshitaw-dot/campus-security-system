import { useState } from 'react';

const backendOrigin = () => {
  const configured = import.meta.env.VITE_MEDIA_BASE_URL || import.meta.env.VITE_API_URL;
  if (configured?.startsWith('http')) return configured.replace(/\/api\/?$/, '');
  return 'http://localhost:5002';
};

const mediaUrl = (reference) => {
  if (typeof reference !== 'string') return null;
  if (reference.startsWith('/uploads/')) return `${backendOrigin()}${reference}`;

  try {
    const url = new URL(reference);
    if (url.pathname.startsWith('/uploads/')) return `${backendOrigin()}${url.pathname}`;
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

export default function EvidencePreview({ photos }) {
  const photoReferences = Array.isArray(photos) ? photos : typeof photos === 'string' ? (() => {
    try {
      const parsed = JSON.parse(photos);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() : [];
  const references = photoReferences.map(mediaUrl).filter(Boolean);
  const [failedUrls, setFailedUrls] = useState([]);
  const availableReferences = references.filter((url) => !failedUrls.includes(url));

  if (!availableReferences.length) return <small>No evidence</small>;

  return (
    <div className="flex h-[72px] w-[110px] items-center gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50" onClick={(event) => event.stopPropagation()}>
      {availableReferences.map((url) => <EvidenceImage key={url} url={url} onError={() => setFailedUrls((current) => [...current, url])} />)}
    </div>
  );
}

function EvidenceImage({ url, onError }) {
  const [state, setState] = useState('loading');
  const filename = decodeURIComponent(new URL(url).pathname.split('/').pop());

  return (
    <div className="evidence-item">
      {state !== 'error' && <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${filename}`}><img src={url} alt={filename} loading="lazy" onLoad={() => setState('loaded')} onError={() => { setState('error'); onError(); }} /></a>}
      <small>{filename}</small>
    </div>
  );
}