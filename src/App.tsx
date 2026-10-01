import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from 'firebase/auth'
import { ALL_NOTES, PRESETS, type NoteItem } from './types'
import { playTone, playFeedback, midiToFrequency, setMasterVolume } from './audio'
import {
  loginWithGoogle,
  logoutUser,
  subscribeToAuth,
  syncUserStatsToFirestore,
  fetchUserStatsFromFirestore,
  type UserStats,
} from './firebase'
import {
  initMatomo,
  trackPageView,
  trackEvent,
  trackGoal,
  setMatomoUser,
  resetMatomoUser,
} from './matomo'
import { LandingPage } from './LandingPage'
import './App.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing')
  const [user, setUser] = useState<User | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  // App Training State
  const [selectedNotes, setSelectedNotes] = useState<string[]>(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  const [notation, setNotation] = useState<'letter' | 'solfege'>('solfege')
  const [octave, setOctave] = useState<number | 'random'>(4)
  const [currentNote, setCurrentNote] = useState<NoteItem | null>(null)
  const [currentOctave, setCurrentOctave] = useState<number>(4)
  const [lastGuess, setLastGuess] = useState<{ id: string; correct: boolean } | null>(null)
  const [stats, setStats] = useState<UserStats>({ total: 0, correct: 0, streak: 0, bestStreak: 0 })
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [feedbackText, setFeedbackText] = useState<string>('')
  const [volume, setVolume] = useState<number>(75)
  const [isMuted, setIsMuted] = useState(false)

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const timerRef = useRef<number | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)

  const activeNotes = ALL_NOTES.filter(n => selectedNotes.includes(n.id))

  // Initialize Matomo Analytics on boot
  useEffect(() => {
    initMatomo()
    trackPageView('/', 'Audix • Início')
  }, [])

  // Track view changes in Matomo
  const changeView = useCallback((view: 'landing' | 'app') => {
    if (view === 'app' && !user) {
      setShowAuthModal(true)
      trackEvent('Auth', 'gated_access_prompt')
      return
    }
    setCurrentView(view)
    if (view === 'landing') {
      trackPageView('/', 'Audix • Início')
    } else {
      trackPageView('/app', 'Audix • Treino de Ouvido')
      trackGoal(3) // Training_Started
    }
  }, [user])

  // Sync master volume
  useEffect(() => {
    setMasterVolume(isMuted ? 0 : volume / 100)
  }, [volume, isMuted])

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        setMatomoUser(currentUser.uid)
        setIsSyncing(true)
        const cloudStats = await fetchUserStatsFromFirestore(currentUser.uid)
        if (cloudStats) {
          setStats({
            total: cloudStats.total || 0,
            correct: cloudStats.correct || 0,
            streak: cloudStats.streak || 0,
            bestStreak: cloudStats.bestStreak || 0,
          })
          if (cloudStats.selectedNotes && cloudStats.selectedNotes.length >= 2) {
            setSelectedNotes(cloudStats.selectedNotes)
          }
        }
        setIsSyncing(false)
      } else {
        resetMatomoUser()
      }
    })
    return () => unsubscribe()
  }, [])

  // Sync stats to Firestore
  const syncToCloud = useCallback((updatedStats: UserStats, notes: string[]) => {
    if (!user) return
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = window.setTimeout(async () => {
      setIsSyncing(true)
      await syncUserStatsToFirestore(user.uid, {
        ...updatedStats,
        selectedNotes: notes,
      })
      setIsSyncing(false)
    }, 500)
  }, [user])

  // PWA listener
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      trackEvent('PWA', 'install_prompt_available')
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      trackEvent('PWA', 'app_installed')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    trackEvent('PWA', 'click_install_button')
    if (installPrompt) {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
        trackEvent('PWA', 'install_accepted')
      }
    } else {
      setShowInstallModal(true)
    }
  }

  const handleLogin = async () => {
    trackEvent('Auth', 'click_google_login')
    try {
      const loggedUser = await loginWithGoogle()
      setShowAuthModal(false)
      trackEvent('Auth', 'login_success', loggedUser.email || '')
      trackGoal(1) // User_Login
      setCurrentView('app')
      trackPageView('/app', 'Audix • Treino de Ouvido')
    } catch (err: unknown) {
      console.warn('Google sign-in error:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert('Erro ao conectar com Google: ' + errorMsg)
    }
  }

  const handleLogout = async () => {
    trackEvent('Auth', 'click_logout')
    await logoutUser()
    setUser(null)
    setCurrentView('landing')
    trackPageView('/', 'Audix • Início')
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
    trackEvent('Training', 'play_note', randomNote.name)
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
    trackEvent('Training', 'replay_note', currentNote.name)
    setTimeout(() => setIsPlaying(false), 800)
  }, [currentNote, currentOctave, pickNewRound])

  const playReferenceC = () => {
    const freq = midiToFrequency((4 + 1) * 12) // C4
    playTone(freq, 0.9)
    trackEvent('Training', 'play_reference_c')
  }

  // Initial round when entering app view
  useEffect(() => {
    if (currentView === 'app' && user && !currentNote && activeNotes.length > 0) {
      pickNewRound()
    }
  }, [currentView, user, activeNotes, currentNote, pickNewRound])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
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
      trackEvent('Training', 'toggle_note', id, exists ? 0 : 1)
      syncToCloud(stats, updated)
      return updated
    })
  }

  // Handle answer guess
  const handleGuess = (guessedNote: NoteItem) => {
    if (!currentNote || lastGuess) return

    const isCorrect = guessedNote.id === currentNote.id
    setLastGuess({ id: guessedNote.id, correct: isCorrect })
    playFeedback(isCorrect)

    trackEvent('Training', isCorrect ? 'guess_correct' : 'guess_wrong', `${guessedNote.name}_vs_${currentNote.name}`)

    setStats(prev => {
      const nextTotal = prev.total + 1
      const nextCorrect = isCorrect ? prev.correct + 1 : prev.correct
      const nextStreak = isCorrect ? prev.streak + 1 : 0
      const nextBest = Math.max(prev.bestStreak, nextStreak)
      const updated = { total: nextTotal, correct: nextCorrect, streak: nextStreak, bestStreak: nextBest }
      syncToCloud(updated, selectedNotes)
      return updated
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
    trackEvent('Training', 'reset_stats')
    const zeroStats = { total: 0, correct: 0, streak: 0, bestStreak: 0 }
    setStats(zeroStats)
    setLastGuess(null)
    setFeedbackText('')
    syncToCloud(zeroStats, selectedNotes)
  }

  // Keyboard shortcut listener
  useEffect(() => {
    if (currentView !== 'app') return
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
  }, [currentView, replayCurrentNote, pickNewRound, lastGuess])

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="nav-brand" onClick={() => changeView('landing')}>
          <span className="logo-icon">🎵</span>
          <span className="logo-title">Audix</span>
          <span className="badge">100% Free</span>
        </div>

        <div className="nav-links">
          <button
            className={`nav-btn ${currentView === 'landing' ? 'active' : ''}`}
            onClick={() => changeView('landing')}
          >
            Início
          </button>
          <button
            className={`nav-btn ${currentView === 'app' ? 'active' : ''}`}
            onClick={() => changeView('app')}
          >
            Treinar
          </button>
        </div>

        <div className="nav-auth">
          {!user ? (
            <button className="btn-auth-google" onClick={() => setShowAuthModal(true)}>
              <svg className="google-icon" viewBox="0 0 24 24" width="16" height="16">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Entrar</span>
            </button>
          ) : (
            <div className="user-profile-menu">
              <div className="user-info-pill" title={`Conectado como ${user.email}`}>
                {user.photoURL && <img src={user.photoURL} alt="" className="nav-avatar" />}
                <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                {isSyncing && <span className="sync-indicator" title="Sincronizando com Firestore...">☁️</span>}
              </div>
              <button className="btn-logoff" onClick={handleLogout} title="Fazer logoff">
                Sair
              </button>
            </div>
          )}

          {!isInstalled && (
            <button className="btn-install-nav" onClick={handleInstallClick} title="Instalar Aplicativo">
              📲 <span>Instalar</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      {currentView === 'landing' ? (
        <LandingPage
          onStartTraining={() => changeView('app')}
          user={user}
          onLogin={() => setShowAuthModal(true)}
          onInstall={handleInstallClick}
          isInstalled={isInstalled}
        />
      ) : (
        <div className="training-view">
          {/* Header info with Logoff button */}
          <div className="training-header">
            <div>
              <h2>Treino de Percepção</h2>
              <p className="subtitle">
                {user ? `Conectado como ${user.email} • Progresso salvo no Firestore` : 'Faça login para salvar seus dados'}
              </p>
              <div className="training-creator-mini">
                <span>Criado por <a href="https://www.instagram.com/klausterra" target="_blank" rel="noopener noreferrer">@klausterra</a></span>
                <span className="dot">•</span>
                <span>Desenvolvido pela <a href="https://hipercube.ia.br" target="_blank" rel="noopener noreferrer">Hipercube</a></span>
              </div>
            </div>
            <div className="training-actions">
              {isSyncing && <span className="sync-badge">☁️ Sincronizando...</span>}
              {user && (
                <button className="btn-logoff-prominent" onClick={handleLogout}>
                  🚪 Sair da Conta
                </button>
              )}
            </div>
          </div>

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
                    trackEvent('Training', 'select_preset', p.id)
                    syncToCloud(stats, p.notes)
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
                  onChange={e => {
                    const val = e.target.value as 'letter' | 'solfege'
                    setNotation(val)
                    trackEvent('Training', 'change_notation', val)
                  }}
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
                  onChange={e => {
                    const val = e.target.value === 'random' ? 'random' : Number(e.target.value)
                    setOctave(val)
                    trackEvent('Training', 'change_octave', String(val))
                  }}
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
        </div>
      )}

      {/* Gated Access / Auth Modal */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            <div className="modal-header">
              <span className="modal-icon">🎵</span>
              <h3>Entrar no Audix</h3>
              <p>O acesso ao treino é 100% gratuito. Faça login com Google para salvar seu histórico e recordes na nuvem.</p>
            </div>

            <button className="btn-modal-google" onClick={handleLogin}>
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continuar com Google</span>
            </button>

            <span className="modal-footer-note">
              🔒 Seus dados são salvos com segurança no Firebase do projeto Hipercube.
            </span>
          </div>
        </div>
      )}

      {/* PWA Install Instructions Modal */}
      {showInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallModal(false)}>
          <div className="modal-box install-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInstallModal(false)}>✕</button>
            <div className="modal-header">
              <span className="modal-icon">📲</span>
              <h3>Instalar o Audix</h3>
              <p>Você pode instalar o Audix diretamente na tela inicial para treinar em tela cheia e offline.</p>
            </div>

            <div className="install-steps">
              <div className="install-step-item">
                <span className="step-num">💻</span>
                <div>
                  <strong>No Computador (Chrome ou Edge):</strong>
                  <p>Clique no ícone de instalar (computador com seta para baixo) na barra de endereços, ou no menu <strong>⋮</strong> ➔ <strong>"Instalar Audix"</strong>.</p>
                </div>
              </div>

              <div className="install-step-item">
                <span className="step-num">🤖</span>
                <div>
                  <strong>No Celular Android:</strong>
                  <p>Toque no menu <strong>⋮</strong> (três pontinhos) ➔ <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
                </div>
              </div>

              <div className="install-step-item">
                <span className="step-num">🍏</span>
                <div>
                  <strong>No iPhone / iPad (Safari):</strong>
                  <p>Toque no botão de <strong>Compartilhar</strong> (quadrado com seta para cima) ➔ selecione <strong>"Adicionar à Tela de Início"</strong>.</p>
                </div>
              </div>
            </div>

            <button className="btn-hero-primary" onClick={() => setShowInstallModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
              Entendi, obrigado!
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer-credits">
          <span>Criado por <a href="https://www.instagram.com/klausterra" target="_blank" rel="noopener noreferrer">Klaus Terra</a></span>
          <span className="footer-divider">•</span>
          <span>Desenvolvido pela <a href="https://hipercube.ia.br" target="_blank" rel="noopener noreferrer">Hipercube</a></span>
        </div>
        <p className="footer-sub">Audix • Treino Auditivo Musical 100% Gratuito</p>
      </footer>
    </div>
  )
}
