import Close from '@mui/icons-material/Close';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ProfilePhotoPreview({ src, alt, className = '', onError }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  const preview = open && createPortal(
    <div className="profile-photo-preview-backdrop" onClick={() => setOpen(false)}>
      <div
        className="profile-photo-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile photo preview for ${alt}`}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="profile-photo-preview-close"
          aria-label="Close profile photo preview"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <Close aria-hidden="true" />
        </button>
        <img
          className="profile-photo-preview-image"
          src={src}
          alt={alt}
          onError={onError}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="profile-photo-preview-trigger"
        aria-label={`View ${alt} photo`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <img className={className} src={src} alt={alt} onError={onError} />
      </button>
      {preview}
    </>
  );
}
