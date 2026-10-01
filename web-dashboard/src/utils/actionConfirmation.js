const actionLabelPattern = /\b(save|update|create|delete|remove|confirm|accept|decline|resolve|arrive|assign|send|submit|clear|activate|deactivate|read|retry|refresh|export|download|upload|login|sign in|register)\b/i;

let pendingAction = null;

function trackAction(button) {
  if (!(button instanceof HTMLElement) || button.matches(':disabled')) return;
  const label = button.getAttribute('aria-label') || button.textContent || button.value || '';
  if (!button.matches('button, input[type="submit"], input[type="button"]')) return;
  if (!actionLabelPattern.test(label) && button.getAttribute('type') !== 'submit') return;
  if (button.form && !button.form.checkValidity()) return;

  const bounds = button.getBoundingClientRect();
  pendingAction = {
    button,
    bounds: { left: bounds.left, top: bounds.top, width: bounds.width },
    createdAt: Date.now(),
  };
}

export function startTrackingActionButtons() {
  const trackClick = (event) => {
    const target = event.target;
    if (target instanceof Element) {
      const button = target.closest('button, input[type="submit"], input[type="button"]');
      if (button) trackAction(button);
    }
  };
  const trackSubmit = (event) => {
    const button = event.submitter;
    if (button instanceof HTMLElement) trackAction(button);
  };

  document.addEventListener('click', trackClick, true);
  document.addEventListener('submit', trackSubmit, true);
  return () => {
    document.removeEventListener('click', trackClick, true);
    document.removeEventListener('submit', trackSubmit, true);
    pendingAction = null;
  };
}

export function consumePendingAction() {
  if (!pendingAction || Date.now() - pendingAction.createdAt > 5000) {
    pendingAction = null;
    return null;
  }
  const action = pendingAction;
  pendingAction = null;
  return action;
}
