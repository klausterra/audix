import { useState, useEffect, useCallback, useRef } from 'react'
import { ALL_NOTES, PRESETS, type NoteItem } from './types'
import { playTone, playFeedback, midiToFrequency, setMasterVolume } from './audio'
import './App.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function App() {
  const [selectedNotes, setSelectedNotes] = useState<string[]>(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  const [notation, setNotation] = useState<'letter' | 'solfege'>('solfege')
  const [octave, setOctave] = useState<number | 'random'>(4)
  const [currentNote, setCurrentNote] = useState<NoteItem | null>(null)
  const [currentOctave, setCurrentOctave] = useState<number>(4)
  const [lastGuess, setLastGuess] = useState<{ id: string; correct: boolean } | null>(null)
  const [stats, setStats] = useState({ total: 0, correct: 0, streak: 0, bestStreak: 0 })
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [feedbackText, setFeedbackText] = useState<string>('')
  const [volume, setVolume] = useState<number>(75)
  const [isMuted, setIsMuted] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const timerRef = useRef<number | null>(null)

  const activeNotes = ALL_NOTES.filter(n => selectedNotes.includes(n.id))

  // Sync volume with audio engine
  useEffect(() => {
    setMasterVolume(isMuted ? 0 : volume / 100)
  }, [volume, isMuted])

  // PWA beforeinstallprompt capture
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!installPrompt) {
      alert('Para instalar no iOS/Safari: toque no botão Compartilhar e selecione "Adicionar à Tela de Início".')
      return
    }
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
  }

  const getNoteLabel = useCallback((note: NoteItem) => {
    if (notation === 'solfege') {
      return `${note.solfege} (${note.name})`
    }
    return note.name
  }, [notation])

  const pickNewRound = useCallback((notesToUse: NoteItem[] = activeNotes) => {
    if (notesToUse.length === 0) return
    const randomNote = notesToUse[Math.floor(Math.random() * notesToUse.length)]
    const chosenOctave = octave === 'random' ? Math.floor(Math.random() * 3) + 3 : octave
    setCurrentNote(randomNote)
    setCurrentOctave(chosenOctave)
    setLastGuess(null)
    setFeedbackText('')

    // Play note sound
    const midi = (chosenOctave + 1) * 12 + randomNote.semitoneOffset
    const freq = midiToFrequency(midi)
    setIsPlaying(true)
    playTone(freq, 0.9)
    setTimeout(() => setIsPlaying(false), 800)
  }, [activeNotes, octave])

  const replayCurrentNote = useCallback(() => {
    if (!currentNote) {
      pickNewRound()
      return
    }
    const midi = (currentOctave + 1) * 12 + currentNote.semitoneOffset
    const freq = midiToFrequency(midi)
    setIsPlaying(true)
    playTone(freq, 0.9)
    setTimeout(() => setIsPlaying(false), 800)
  }, [currentNote, currentOctave, pickNewRound])

  const playReferenceC = () => {
    const freq = midiToFrequency((4 + 1) * 12) // C4
    playTone(freq, 0.9)
  }

  // Initial round
  useEffect(() => {
    if (!currentNote && activeNotes.length > 0) {
      pickNewRound()
    }
  }, [activeNotes, currentNote, pickNewRound])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Handle note selection toggle
  const toggleNote = (id: string) => {
    setSelectedNotes(prev => {
      const exists = prev.includes(id)
      if (exists && prev.length <= 2) {
        alert('Selecione pelo menos 2 notas para treinar.')
        return prev
      }
      const updated = exists ? prev.filter(n => n !== id) : [...prev, id]
      return updated
    })
  }

  // Handle answer guess
  const handleGuess = (guessedNote: NoteItem) => {
    if (!currentNote || lastGuess) return

    const isCorrect = guessedNote.id === currentNote.id
    setLastGuess({ id: guessedNote.id, correct: isCorrect })
    playFeedback(isCorrect)

    setStats(prev => {
      const nextTotal = prev.total + 1
      const nextCorrect = isCorrect ? prev.correct + 1 : prev.correct
      const nextStreak = isCorrect ? prev.streak + 1 : 0
      const nextBest = Math.max(prev.bestStreak, nextStreak)
      return { total: nextTotal, correct: nextCorrect, streak: nextStreak, bestStreak: nextBest }
    })

    if (isCorrect) {
      setFeedbackText(`Correto! Era ${getNoteLabel(currentNote)} (${currentOctave}ª oitava)`)
    } else {
      setFeedbackText(`Errou. Era ${getNoteLabel(currentNote)} (${currentOctave}ª oitava)`)
    }

    if (autoAdvance) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        pickNewRound()
      }, isCorrect ? 900 : 1600)
    }
  }

  const resetStats = () => {
    setStats({ total: 0, correct: 0, streak: 0, bestStreak: 0 })
    setLastGuess(null)
    setFeedbackText('')
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        replayCurrentNote()
      } else if (e.code === 'Enter' && lastGuess) {
        e.preventDefault()
        pickNewRound()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [replayCurrentNote, pickNewRound, lastGuess])

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <span className="logo-icon">🎵</span>
            <h1>Audix</h1>
            <span className="badge">Treino Auditivo</span>
          </div>

          <div className="header-actions">
            {!isInstalled && (
              <button
                className="btn-install"
                onClick={handleInstallClick}
                title="Instalar Audix no seu dispositivo"
              >
                📲 Instalar App
              </button>
            )}
          </div>
        </div>
        <p className="subtitle">Selecione notas para treinar seu ouvido relativo e absoluto</p>
      </header>

      {/* Stats bar */}
      <section className="stats-card">
        <div className="stat-item">
          <span className="stat-label">Precisão</span>
          <span className="stat-value">{accuracy}%</span>
          <span className="stat-sub">{stats.correct}/{stats.total}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Sequência</span>
          <span className="stat-value streak">🔥 {stats.streak}</span>
          <span className="stat-sub">Recorde: {stats.bestStreak}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <button className="btn-secondary btn-sm" onClick={resetStats}>
            Zerar Placar
          </button>
        </div>
      </section>

      {/* Main player area */}
      <main className="practice-box">
        <div className="sound-controls">
          <button
            className={`btn-play ${isPlaying ? 'playing' : ''}`}
            onClick={replayCurrentNote}
            title="Pressione [Espaço] para ouvir"
          >
            <span className="play-icon">{isPlaying ? '🔊' : '▶'}</span>
            <span>{isPlaying ? 'Tocando...' : 'Ouvir Nota'}</span>
          </button>

          <button className="btn-ref" onClick={playReferenceC} title="Tocar Dó central (C4)">
            🎯 Referência C4
          </button>
        </div>

        {/* Volume control */}
        <div className="volume-bar">
          <button
            className="btn-volume-icon"
            onClick={() => setIsMuted(prev => !prev)}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={e => {
              setVolume(Number(e.target.value))
              if (isMuted) setIsMuted(false)
            }}
            className="volume-slider"
            aria-label="Controle de volume"
          />
          <span className="volume-label">{isMuted ? 'Mudo' : `${volume}%`}</span>
        </div>

        <div className="shortcut-hint">
          <span>Dica: <b>Espaço</b> para repetir som {lastGuess ? '• <b>Enter</b> para próxima nota' : ''}</span>
        </div>

        {/* Feedback message */}
        <div className={`feedback-banner ${lastGuess ? (lastGuess.correct ? 'success' : 'error') : ''}`}>
          {feedbackText || 'Escute o som e clique na nota correspondente'}
        </div>

        {/* Note guess buttons */}
        <div className="options-grid">
          {activeNotes.map(note => {
            const isSelected = lastGuess?.id === note.id
            const isCorrectAnswer = currentNote?.id === note.id
            let buttonClass = 'btn-note'

            if (lastGuess) {
              if (isCorrectAnswer) {
                buttonClass += ' is-correct'
              } else if (isSelected && !lastGuess.correct) {
                buttonClass += ' is-wrong'
              } else {
                buttonClass += ' is-disabled'
              }
            }

            return (
              <button
                key={note.id}
                className={buttonClass}
                disabled={Boolean(lastGuess)}
                onClick={() => handleGuess(note)}
              >
                <span className="note-name">{notation === 'solfege' ? note.solfege : note.name}</span>
                <span className="note-alt">{notation === 'solfege' ? note.name : note.solfege}</span>
              </button>
            )
          })}
        </div>

        {lastGuess && !autoAdvance && (
          <button className="btn-next" onClick={() => pickNewRound()}>
            Próxima Nota ➔
          </button>
        )}
      </main>

      {/* Configuration section */}
      <section className="config-section">
        <h2>Notas selecionadas para treino ({activeNotes.length}/12)</h2>

        <div className="presets-row">
          <span className="presets-label">Pré-ajustes:</span>
          {PRESETS.map(p => (
            <button
              key={p.id}
              className="btn-preset"
              onClick={() => {
                setSelectedNotes(p.notes)
                setLastGuess(null)
                setFeedbackText('')
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="notes-selector-grid">
          {ALL_NOTES.map(note => {
            const isChecked = selectedNotes.includes(note.id)
            return (
              <label
                key={note.id}
                className={`note-toggle-card ${isChecked ? 'active' : ''} ${note.isAccidental ? 'accidental' : 'natural'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleNote(note.id)}
                />
                <div className="toggle-info">
                  <span className="toggle-main">{note.name}</span>
                  <span className="toggle-sub">{note.solfege}</span>
                </div>
              </label>
            )
          })}
        </div>

        {/* Global Settings */}
        <div className="preferences-row">
          <div className="pref-item">
            <label htmlFor="notation-select">Notação:</label>
            <select
              id="notation-select"
              value={notation}
              onChange={e => setNotation(e.target.value as 'letter' | 'solfege')}
            >
              <option value="solfege">Dó, Ré, Mi (Solfège)</option>
              <option value="letter">C, D, E (Cifras)</option>
            </select>
          </div>

          <div className="pref-item">
            <label htmlFor="octave-select">Oitava:</label>
            <select
              id="octave-select"
              value={octave}
              onChange={e => setOctave(e.target.value === 'random' ? 'random' : Number(e.target.value))}
            >
              <option value="4">4ª Oitava (Médio - C4 a B4)</option>
              <option value="3">3ª Oitava (Grave - C3 a B3)</option>
              <option value="5">5ª Oitava (Agudo - C5 a B5)</option>
              <option value="random">Aleatória (3ª a 5ª)</option>
            </select>
          </div>

          <div className="pref-item checkbox-pref">
            <label>
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={e => setAutoAdvance(e.target.checked)}
              />
              Avanço Automático
            </label>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Audix • PWA Instalável • Treino Auditivo Musical</p>
      </footer>
    </div>
  )
}
