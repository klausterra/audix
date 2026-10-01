// Web Audio API engine for ear training
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function playTone(freq: number, duration = 0.8): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  // Use triangle wave with slight harmonic richness
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  // Subtle second harmonic for warmer, organ-like tone
  const subOsc = ctx.createOscillator()
  subOsc.type = 'sine'
  subOsc.frequency.setValueAtTime(freq, now)

  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.3, now)

  // ADSR envelope: 0.01s attack, smooth decay
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  subOsc.connect(subGain)
  subGain.connect(gain)
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  subOsc.start(now)
  osc.stop(now + duration + 0.05)
  subOsc.stop(now + duration + 0.05)
}

export function playFeedback(isCorrect: boolean): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  gain.connect(ctx.destination)
  osc.connect(gain)

  if (isCorrect) {
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.setValueAtTime(880, now + 0.08) // A5
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc.start(now)
    osc.stop(now + 0.26)
  } else {
    osc.frequency.setValueAtTime(220, now) // A3
    osc.frequency.setValueAtTime(196, now + 0.1) // G3
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.31)
  }
}
