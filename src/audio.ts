// Web Audio API engine for ear training with realistic piano synthesis
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let currentVolume = 0.7

export type SoundTimbre = 'piano' | 'synth'
let currentTimbre: SoundTimbre = 'piano'

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

export function setSoundTimbre(timbre: SoundTimbre): void {
  currentTimbre = timbre
}

export function getSoundTimbre(): SoundTimbre {
  return currentTimbre
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * Piano physical model synthesis using additive harmonics + percussive hammer noise + lowpass filter.
 * Reproduces the acoustic attack and natural decay of an acoustic grand piano.
 */
function playPiano(freq: number, duration = 1.4): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  // Filter to model the piano soundboard damping higher frequencies over time
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  // Initial bright hammer hit decaying to warmer string tone
  filter.frequency.setValueAtTime(Math.min(freq * 8, 12000), now)
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 2.2, 3500), now + 0.3)
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.2, 1200), now + duration)
  filter.connect(master)

  // Piano harmonic series (relative amplitudes and individual decay rates)
  // Higher harmonics decay significantly faster than fundamental
  const harmonics = [
    { ratio: 1, gain: 0.55, decayMult: 1.0 },      // Fundamental
    { ratio: 2.001, gain: 0.28, decayMult: 0.8 },  // 2nd harmonic (slight inharmonicity)
    { ratio: 3.003, gain: 0.16, decayMult: 0.6 },  // 3rd
    { ratio: 4.006, gain: 0.10, decayMult: 0.45 }, // 4th
    { ratio: 5.01, gain: 0.05, decayMult: 0.35 },  // 5th
    { ratio: 6.015, gain: 0.025, decayMult: 0.25 }, // 6th
  ]

  harmonics.forEach(({ ratio, gain: hGainRatio, decayMult }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    // Sine waves summed create clean string resonance
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * ratio, now)

    // Fast 3-5ms attack simulating hammer strike
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(hGainRatio, now + 0.005)

    // Natural exponential piano decay
    const hDuration = duration * decayMult
    gain.gain.exponentialRampToValueAtTime(hGainRatio * 0.35, now + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hDuration)

    osc.connect(gain)
    gain.connect(filter)

    osc.start(now)
    osc.stop(now + hDuration + 0.05)
  })

  // Hammer percussion thud (short burst of bandpass noise)
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.04) // 40ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(Math.min(freq * 1.5, 2000), now)
    noiseFilter.Q.setValueAtTime(1.5, now)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.18, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)

    whiteNoise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)

    whiteNoise.start(now)
    whiteNoise.stop(now + 0.04)
  } catch {
    // Noise buffer fallback if restricted
  }
}

function playSynth(freq: number, duration = 0.8): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  const subOsc = ctx.createOscillator()
  subOsc.type = 'sine'
  subOsc.frequency.setValueAtTime(freq, now)

  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.3, now)

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

export function playTone(freq: number, duration?: number): void {
  if (currentTimbre === 'piano') {
    playPiano(freq, duration || 1.3)
  } else {
    playSynth(freq, duration || 0.8)
  }
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
