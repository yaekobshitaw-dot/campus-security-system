import { useEffect, useState } from 'react';
import api from '../services/api';

const mediaUrl = (reference) => {
  if (typeof reference !== 'string') return null;

  try {
    const url = new URL(reference);
    return url.pathname.includes('/api/incidents/') && url.pathname.includes('/evidence/')
      ? reference
      : null;
  } catch {
    return reference.startsWith('/api/incidents/') && reference.includes('/evidence/') ? reference : null;
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

  if (!availableReferences.length) return <small className="text-xs font-semibold text-slate-500">No evidence</small>;

  return (
    <div className="flex h-[84px] w-[124px] items-center gap-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm" onClick={(event) => event.stopPropagation()}>
      {availableReferences.map((url) => <EvidenceImage key={url} url={url} onError={() => setFailedUrls((current) => [...current, url])} />)}
    </div>
  );
}

function EvidenceImage({ url, onError }) {
  const [state, setState] = useState('loading');
  const [objectUrl, setObjectUrl] = useState(null);
  const filename = decodeURIComponent(new URL(url, window.location.origin).pathname.split('/').pop());

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const apiPath = url.replace(/^\/api(?=\/)/, '');
    api.get(apiPath, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(response.data);
        setObjectUrl(createdUrl);
        setState('loaded');
      })
      .catch(() => {
        if (active) {
          setState('error');
          onError();
        }
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url, onError]);

  return state !== 'error' && objectUrl ? (
    <div className="evidence-item">
      <a href={objectUrl} target="_blank" rel="noreferrer" aria-label={`Open ${filename}`}><img src={objectUrl} alt={filename} loading="lazy" /></a>
      <small>{filename}</small>
    </div>
  ) : state === 'loading' ? <small>Loading evidence...</small> : null;
}