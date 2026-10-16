let audioContext;

export function enableNotificationSound() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return Promise.resolve(false);

  try {
    audioContext ||= new AudioContextConstructor();
  } catch {
    return Promise.resolve(false);
  }

  if (audioContext.state === 'running') return Promise.resolve(true);
  if (typeof audioContext.resume !== 'function') return Promise.resolve(false);
  return audioContext.resume()
    .then(() => audioContext.state === 'running')
    .catch(() => false);
}

export function playNotificationSound() {
  if (!audioContext || audioContext.state !== 'running') return false;

  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.19);
    return true;
  } catch {
    return false;
  }
}