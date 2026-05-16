// Simple Web Audio API synthesizer for 8-bit style sound effects
let audioCtx: AudioContext | null = null;

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Global state for continuous sounds
let wakaOsc: OscillatorNode | null = null;
let wakaGain: GainNode | null = null;
let sirenOsc: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let isFrightened = false;

// Waka Waka (eating dots) - slightly synthesized alternating notes
let wakaState = 0;
export function playWaka() {
  const ctx = getContext();
  const freq = wakaState % 2 === 0 ? 300 : 450;
  wakaState++;
  playTone(freq, 'triangle', 0.1, 0.05);
}

// Siren (background chase) - pulsating sound
export function startSiren() {
  const ctx = getContext();
  if (sirenOsc) return; // already playing
  sirenOsc = ctx.createOscillator();
  sirenGain = ctx.createGain();
  
  sirenOsc.type = 'triangle';
  sirenGain.gain.value = 0.05;
  
  // Frequency modulation for the siren effect
  const lfo = ctx.createOscillator();
  lfo.type = 'sawtooth';
  lfo.frequency.value = 2; // 2 pulses per second
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 50; // Pitch variation depth
  
  lfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  
  sirenOsc.frequency.value = isFrightened ? 300 : 400; // Lower pitch when frightened
  
  sirenOsc.connect(sirenGain);
  sirenGain.connect(ctx.destination);
  
  lfo.start();
  sirenOsc.start();
}

export function stopSiren() {
  if (sirenOsc) {
    try { sirenOsc.stop(); } catch(e) {}
    sirenOsc.disconnect();
    sirenOsc = null;
  }
  if (sirenGain) {
    sirenGain.disconnect();
    sirenGain = null;
  }
}

export function setFrightenedSiren(frightened: boolean) {
  isFrightened = frightened;
  if (sirenOsc) {
    sirenOsc.frequency.setValueAtTime(frightened ? 300 : 400, getContext().currentTime);
  }
}

// Power Pellet eaten
export function playPowerPellet() {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'square';
  // Fast frequency sweep up
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

// Eat Ghost
export function playEatGhost() {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sawtooth';
  // Zapp sound!
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

// Death sequence
export function playDeath() {
  stopSiren();
  const ctx = getContext();
  
  // Descending stuttering sound
  let time = ctx.currentTime;
  for (let i = 0; i < 15; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500 - (i * 30), time);
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.linearRampToValueAtTime(0, time + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
    
    time += 0.1;
  }
}

// Level clear jingle
export function playLevelClear() {
  stopSiren();
  const ctx = getContext();
  const notes = [440, 554, 659, 880]; // A, C#, E, A
  let time = ctx.currentTime;
  
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = notes[i];
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.linearRampToValueAtTime(0, time + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.15);
    time += 0.15;
  }
}

export function playExtraLife() {
  const ctx = getContext();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
  let time = ctx.currentTime;
  
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = notes[i];
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.linearRampToValueAtTime(0, time + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.1);
    time += 0.1;
  }
}

// Classic Intro Music ("ti ri ti ri to to")
export function playGameStart(): Promise<void> {
  const ctx = getContext();
  stopSiren(); // Ensure siren is off

  // Approximated Pac-Man intro notes & durations (in seconds)
  // B4, B5, F#5, D#5, B5(short), F#5, D#5
  // C5, C6, G5,  E5,  C6(short), G5,  E5
  // B4, B5, F#5, D#5, B5(short), F#5, D#5
  // D#5, E5, F5, F5, F#5, G5, G5, G#5, A5, B5
  const melody = [
    { freq: 493.88, dur: 0.15 }, // B4
    { freq: 987.77, dur: 0.15 }, // B5
    { freq: 739.99, dur: 0.15 }, // F#5
    { freq: 622.25, dur: 0.15 }, // D#5
    { freq: 987.77, dur: 0.05 }, // B5 (short)
    { freq: 739.99, dur: 0.25 }, // F#5
    { freq: 622.25, dur: 0.35 }, // D#5

    { freq: 523.25, dur: 0.15 }, // C5
    { freq: 1046.50, dur: 0.15 }, // C6
    { freq: 783.99, dur: 0.15 }, // G5
    { freq: 659.25, dur: 0.15 }, // E5
    { freq: 1046.50, dur: 0.05 }, // C6 (short)
    { freq: 783.99, dur: 0.25 }, // G5
    { freq: 659.25, dur: 0.35 }, // E5

    { freq: 493.88, dur: 0.15 }, // B4
    { freq: 987.77, dur: 0.15 }, // B5
    { freq: 739.99, dur: 0.15 }, // F#5
    { freq: 622.25, dur: 0.15 }, // D#5
    { freq: 987.77, dur: 0.05 }, // B5 (short)
    { freq: 739.99, dur: 0.25 }, // F#5
    { freq: 622.25, dur: 0.35 }, // D#5

    // Run up
    { freq: 622.25, dur: 0.08 }, // D#5
    { freq: 659.25, dur: 0.08 }, // E5
    { freq: 698.46, dur: 0.16 }, // F5
    { freq: 698.46, dur: 0.08 }, // F5
    { freq: 739.99, dur: 0.08 }, // F#5
    { freq: 783.99, dur: 0.16 }, // G5
    { freq: 783.99, dur: 0.08 }, // G5
    { freq: 830.61, dur: 0.08 }, // G#5
    { freq: 880.00, dur: 0.16 }, // A5
    { freq: 987.77, dur: 0.30 }, // B5
  ];

  let time = ctx.currentTime;
  
  for (const note of melody) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Triangle wave for a softer, 8-bit chip sound
    osc.type = 'triangle';
    osc.frequency.value = note.freq;
    
    // Very slight gap between notes for articulation
    const actualDur = note.dur * 0.9;
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.01, time + actualDur);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + note.dur);
    
    time += note.dur;
  }

  // Calculate total duration in ms
  const totalMs = (time - ctx.currentTime) * 1000;
  
  return new Promise(resolve => {
    setTimeout(resolve, totalMs + 100);
  });
}
