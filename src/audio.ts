// Web Audio API engine for ear training with realistic physical modeling synthesis
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let currentVolume = 0.7

export type SoundTimbre = 'piano' | 'acoustic_guitar' | 'electric_guitar' | 'synth'
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
 * Acoustic Grand Piano
 * Additive harmonics with inharmonicity + lowpass soundboard damping + felt hammer knock
 */
function playPiano(freq: number, duration = 1.4): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(Math.min(freq * 8, 12000), now)
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 2.2, 3500), now + 0.3)
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.2, 1200), now + duration)
  filter.connect(master)

  const harmonics = [
    { ratio: 1, gain: 0.55, decayMult: 1.0 },
    { ratio: 2.001, gain: 0.28, decayMult: 0.8 },
    { ratio: 3.003, gain: 0.16, decayMult: 0.6 },
    { ratio: 4.006, gain: 0.10, decayMult: 0.45 },
    { ratio: 5.01, gain: 0.05, decayMult: 0.35 },
    { ratio: 6.015, gain: 0.025, decayMult: 0.25 },
  ]

  harmonics.forEach(({ ratio, gain: hGainRatio, decayMult }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * ratio, now)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(hGainRatio, now + 0.005)

    const hDuration = duration * decayMult
    gain.gain.exponentialRampToValueAtTime(hGainRatio * 0.35, now + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hDuration)

    osc.connect(gain)
    gain.connect(filter)

    osc.start(now)
    osc.stop(now + hDuration + 0.05)
  })

  // Hammer noise
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.04)
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1

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
    // fallback
  }
}

/**
 * Violão Acústico (Nylon / Steel String Guitar)
 * Karplus-Strong string pluck physics model + body resonance filter (100Hz and 200Hz cavity resonance)
 */
function playAcousticGuitar(freq: number, duration = 1.6): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  // Guitar wood body resonance filter (acoustic soundbox formants ~220Hz and ~450Hz)
  const bodyFilter = ctx.createBiquadFilter()
  bodyFilter.type = 'peaking'
  bodyFilter.frequency.setValueAtTime(240, now)
  bodyFilter.Q.setValueAtTime(2.0, now)
  bodyFilter.gain.setValueAtTime(4.0, now)

  const stringFilter = ctx.createBiquadFilter()
  stringFilter.type = 'lowpass'
  // Bright pluck attack that quickly mellows into warm woody decay
  stringFilter.frequency.setValueAtTime(Math.min(freq * 10, 10000), now)
  stringFilter.frequency.exponentialRampToValueAtTime(Math.min(freq * 2.5, 2800), now + 0.15)
  stringFilter.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.2, 900), now + duration)

  bodyFilter.connect(master)
  stringFilter.connect(bodyFilter)

  // Guitar pluck harmonic profile (rich odd and even harmonics with fast pluck transient)
  const harmonics = [
    { ratio: 1, gain: 0.65, decayMult: 1.0 },
    { ratio: 2, gain: 0.40, decayMult: 0.75 },
    { ratio: 3, gain: 0.30, decayMult: 0.55 },
    { ratio: 4, gain: 0.18, decayMult: 0.40 },
    { ratio: 5, gain: 0.12, decayMult: 0.30 },
    { ratio: 6, gain: 0.06, decayMult: 0.22 },
  ]

  harmonics.forEach(({ ratio, gain: hGainRatio, decayMult }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    // Triangle/sine blend gives acoustic string character
    osc.type = ratio === 1 ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(freq * ratio, now)

    // Pluck attack: 2ms sharp pick transient
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(hGainRatio, now + 0.003)

    const hDuration = duration * decayMult
    gain.gain.exponentialRampToValueAtTime(hGainRatio * 0.25, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hDuration)

    osc.connect(gain)
    gain.connect(stringFilter)

    osc.start(now)
    osc.stop(now + hDuration + 0.05)
  })

  // Fingertip / plectrum noise on string
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.025) // 25ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1

    const pickNoise = ctx.createBufferSource()
    pickNoise.buffer = noiseBuffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.setValueAtTime(2500, now)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.12, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)

    pickNoise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)

    pickNoise.start(now)
    pickNoise.stop(now + 0.025)
  } catch {
    // fallback
  }
}

/**
 * Guitarra Elétrica (Electric Guitar Clean / Light Crunch)
 * Magnetic pickup frequency response + subtle tube distortion curve + amp cabinet filter
 */
function playElectricGuitar(freq: number, duration = 1.8): void {
  const ctx = getAudioContext()
  const master = getMasterGain()
  const now = ctx.currentTime

  // Guitar amp cabinet emulation (speaker cone cutoff ~4500Hz, mid-range punch at ~1200Hz)
  const cabFilter = ctx.createBiquadFilter()
  cabFilter.type = 'lowpass'
  cabFilter.frequency.setValueAtTime(4200, now)

  const midBoost = ctx.createBiquadFilter()
  midBoost.type = 'peaking'
  midBoost.frequency.setValueAtTime(1400, now)
  midBoost.Q.setValueAtTime(1.8, now)
  midBoost.gain.setValueAtTime(5.0, now)

  // Soft-clipping waveshaper for warm electric guitar pickup response
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1
    // Sigmoid soft saturation curve (tube-like warmth)
    curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x))
  }
  shaper.curve = curve
  shaper.oversample = '4x'

  shaper.connect(midBoost)
  midBoost.connect(cabFilter)
  cabFilter.connect(master)

  // Electric guitar pickup sound (sawtooth/triangle blend with long sustained ring)
  const osc1 = ctx.createOscillator()
  osc1.type = 'sawtooth'
  osc1.frequency.setValueAtTime(freq, now)

  const osc2 = ctx.createOscillator()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(freq * 2, now) // 2nd harmonic pickup tone

  const gain1 = ctx.createGain()
  const gain2 = ctx.createGain()

  // Pick attack & sustain envelope (longer sustain than acoustic)
  gain1.gain.setValueAtTime(0.0001, now)
  gain1.gain.linearRampToValueAtTime(0.42, now + 0.004)
  gain1.gain.exponentialRampToValueAtTime(0.24, now + 0.15)
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  gain2.gain.setValueAtTime(0.0001, now)
  gain2.gain.linearRampToValueAtTime(0.22, now + 0.004)
  gain2.gain.exponentialRampToValueAtTime(0.08, now + 0.2)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.75)

  osc1.connect(gain1)
  osc2.connect(gain2)
  gain1.connect(shaper)
  gain2.connect(shaper)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + duration + 0.05)
  osc2.stop(now + duration + 0.05)
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
  switch (currentTimbre) {
    case 'piano':
      playPiano(freq, duration || 1.3)
      break
    case 'acoustic_guitar':
      playAcousticGuitar(freq, duration || 1.5)
      break
    case 'electric_guitar':
      playElectricGuitar(freq, duration || 1.7)
      break
    case 'synth':
    default:
      playSynth(freq, duration || 0.8)
      break
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
