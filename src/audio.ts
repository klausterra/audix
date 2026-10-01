// Web Audio API engine for ear training
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let currentVolume = 0.7

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
    masterGain = audioCtx.createGain()
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime)
    masterGain.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

function getMasterGain(): GainNode {
  getAudioContext()
  return masterGain!
}

export function setMasterVolume(val: number): void {
  currentVolume = Math.max(0, Math.min(1, val))
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime)
  }
}

export function getMasterVolume(): number {
  return currentVolume
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function playTone(freq: number, duration = 0.8): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  // Triangle wave for smooth fundamental tone
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  // Subtle second harmonic for warmth
  const subOsc = ctx.createOscillator()
  subOsc.type = 'sine'
  subOsc.frequency.setValueAtTime(freq, now)

  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.3, now)

  // ADSR envelope: 0.015s attack, smooth decay
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  subOsc.connect(subGain)
  subGain.connect(gain)
  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  subOsc.start(now)
  osc.stop(now + duration + 0.05)
  subOsc.stop(now + duration + 0.05)
}

export function playFeedback(isCorrect: boolean): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  gain.connect(master)
  osc.connect(gain)

  if (isCorrect) {
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.setValueAtTime(880, now + 0.08) // A5
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc.start(now)
    osc.stop(now + 0.26)
  } else {
    osc.frequency.setValueAtTime(220, now) // A3
    osc.frequency.setValueAtTime(196, now + 0.1) // G3
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.31)
  }
}
