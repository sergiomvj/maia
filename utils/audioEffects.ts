let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const playSound = (type: OscillatorType, frequency: number, duration: number, volume: number) => {
  try {
    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);
  } catch (e) {
    console.error('Failed to play sound', e);
  }
};

// Subtle notification sound for adding/saving
export const playSuccessSound = () => {
  playSound('sine', 880, 0.1, 0.1);
  setTimeout(() => playSound('sine', 1046.5, 0.15, 0.1), 80);
};

// Quick, soft click for toggling
export const playToggleSound = () => {
  playSound('triangle', 300, 0.05, 0.05);
};

// A slightly more distinct sound for deletion or clearing
export const playClearSound = () => {
    playSound('square', 220, 0.1, 0.08);
}