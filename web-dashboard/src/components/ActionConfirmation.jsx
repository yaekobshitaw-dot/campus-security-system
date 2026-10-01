import { useEffect, useRef, useState } from 'react';
import { startTrackingActionButtons } from '../utils/actionConfirmation';

export default function ActionConfirmation() {
  const [confirmation, setConfirmation] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const stopTracking = startTrackingActionButtons();
    const showConfirmation = (event) => {
      const { button, bounds } = event.detail;
      const currentBounds = button?.isConnected ? button.getBoundingClientRect() : bounds;
      const left = Math.min(Math.max(currentBounds.left + currentBounds.width / 2, 90), window.innerWidth - 90);
      const top = Math.max(currentBounds.top - 8, 8);
      window.clearTimeout(timeoutRef.current);
      setConfirmation({ left, top, id: Date.now() });
      timeoutRef.current = window.setTimeout(() => setConfirmation(null), 1800);
    };

    window.addEventListener('campus-security:action-succeeded', showConfirmation);
    return () => {
      stopTracking();
      window.removeEventListener('campus-security:action-succeeded', showConfirmation);
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!confirmation) return null;

  return (
    <div
      key={confirmation.id}
      className="action-confirmation"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{ left: confirmation.left, top: confirmation.top }}
    >
      Action completed
    </div>
  );
}
