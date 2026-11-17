// Tiny WebAudio synth: no audio files. Call unlockAudio() from a user tap (iOS rule).
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state !== 'running') void ctx.resume();
  } catch {
    /* audio is optional */
  }
}

function tone(freq: number, end: number, dur: number, type: OscillatorType = 'square', vol = 0.15, delay = 0): void {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  pop: () => tone(500, 1100, 0.1, 'sine', 0.2),
  boing: () => tone(180, 520, 0.3, 'sine', 0.25),
  whoosh: () => tone(900, 200, 0.25, 'triangle', 0.12),
  chomp: () => { tone(220, 70, 0.12, 'sawtooth', 0.2); tone(180, 60, 0.12, 'sawtooth', 0.2, 0.12); },
  burp: () => tone(110, 55, 0.5, 'sawtooth', 0.2),
  yay: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.15, 'square', 0.12, i * 0.1)),
  beep: () => tone(1400, 1400, 0.08, 'square', 0.12),
  coin: () => { tone(988, 988, 0.08, 'square', 0.12); tone(1319, 1319, 0.2, 'square', 0.12, 0.08); },
  poof: () => tone(300, 40, 0.5, 'triangle', 0.25),
  bang: () => { tone(160, 30, 0.2, 'sawtooth', 0.3); tone(900, 60, 0.12, 'square', 0.15); },
  cluck: () => { tone(700, 450, 0.08, 'square', 0.1); tone(800, 500, 0.1, 'square', 0.1, 0.1); },
  chop: () => { tone(300, 60, 0.07, 'sawtooth', 0.22); tone(1200, 200, 0.05, 'square', 0.08); },
  crack: () => { tone(900, 300, 0.05, 'square', 0.12); tone(700, 200, 0.07, 'square', 0.12, 0.06); },
  splash: () => { tone(600, 200, 0.2, 'sine', 0.2); tone(900, 300, 0.15, 'triangle', 0.1, 0.05); },
  sizzle: () => [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(d => tone(2400, 1600, 0.12, 'sawtooth', 0.05, d)),
  oink:() => { tone(160, 110, 0.15, 'sawtooth', 0.15); tone(130, 90, 0.18, 'sawtooth', 0.15, 0.15); },
};
