import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from 'firebase/auth'
import { ALL_NOTES, PRESETS, type NoteItem } from './types'
import { playTone, playFeedback, midiToFrequency, setMasterVolume, setSoundTimbre, type SoundTimbre } from './audio'
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
  trackOutboundLink,
  setMatomoUser,
  resetMatomoUser,
  INSTAGRAM_URL,
  HIPERCUBE_URL,
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
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  // Training state
  const [timbre, setTimbre] = useState<SoundTimbre>('piano')
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

  // PWA
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const timerRef = useRef<number | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)

  const activeNotes = ALL_NOTES.filter((n) => selectedNotes.includes(n.id))

  useEffect(() => {
    initMatomo()
    trackPageView('/', 'Audix • Início')
  }, [])

  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return
    setIsLoggingIn(true)
    trackEvent('Auth', 'click_google_login')
    try {
      const loggedUser = await loginWithGoogle()
      setShowAuthModal(false)
      trackEvent('Auth', 'login_success', loggedUser.email || '')
      trackGoal(1)
      setCurrentView('app')
      trackPageView('/app', 'Audix • Treino de Ouvido')
    } catch (err: unknown) {
      const errorCode = (err as { code?: string })?.code || ''
      if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
        return
      }
      console.warn('Google sign-in error:', err)
      alert('Erro ao conectar com Google. Tente novamente.')
    } finally {
      setIsLoggingIn(false)
    }
  }, [isLoggingIn])

  const changeView = useCallback(
    (view: 'landing' | 'app') => {
      if (view === 'app' && !user) {
        handleLogin()
        return
      }
      setCurrentView(view)
      if (view === 'landing') {
        trackPageView('/', 'Audix • Início')
      } else {
        trackPageView('/app', 'Audix • Treino de Ouvido')
        trackGoal(3)
      }
    },
    [user, handleLogin]
  )

  useEffect(() => {
    setMasterVolume(isMuted ? 0 : volume / 100)
  }, [volume, isMuted])

  useEffect(() => {
    setSoundTimbre(timbre)
  }, [timbre])

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        setMatomoUser(currentUser.uid)
        setCurrentView('app')
        trackPageView('/app', 'Audix • Treino de Ouvido')
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

  const syncToCloud = useCallback(
    (updatedStats: UserStats, notes: string[]) => {
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
    },
    [user]
  )

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      trackEvent('PWA', 'prompt_available')
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      trackEvent('PWA', 'installed')
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
    trackEvent('PWA', 'click_install')
    if (installPrompt) {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
      }
    } else {
      setShowInstallModal(true)
    }
  }

  const handleLogout = async () => {
    trackEvent('Auth', 'logout')
    await logoutUser()
    setUser(null)
    setCurrentView('landing')
    trackPageView('/', 'Audix • Início')
  }

  const getNoteLabel = useCallback(
    (note: NoteItem) => (notation === 'solfege' ? `${note.solfege} (${note.name})` : note.name),
    [notation]
  )

  const pickNewRound = useCallback(
    (notesToUse: NoteItem[] = activeNotes) => {
      if (notesToUse.length === 0) return
      const randomNote = notesToUse[Math.floor(Math.random() * notesToUse.length)]
      const chosenOctave = octave === 'random' ? Math.floor(Math.random() * 3) + 3 : octave
      setCurrentNote(randomNote)
      setCurrentOctave(chosenOctave)
      setLastGuess(null)
      setFeedbackText('')

      const midi = (chosenOctave + 1) * 12 + randomNote.semitoneOffset
      const freq = midiToFrequency(midi)
      setIsPlaying(true)
      playTone(freq, 0.9)
      trackEvent('Training', 'play_note', randomNote.name)
      setTimeout(() => setIsPlaying(false), 800)
    },
    [activeNotes, octave]
  )

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
    const freq = midiToFrequency((4 + 1) * 12)
    playTone(freq, 0.9)
    trackEvent('Training', 'play_ref_c')
  }

  useEffect(() => {
    if (currentView === 'app' && user && !currentNote && activeNotes.length > 0) {
      pickNewRound()
    }
  }, [currentView, user, activeNotes, currentNote, pickNewRound])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [])

  const toggleNote = (id: string) => {
    setSelectedNotes((prev) => {
      const exists = prev.includes(id)
      if (exists && prev.length <= 2) {
        alert('Selecione ao menos 2 notas para treinar.')
        return prev
      }
      const updated = exists ? prev.filter((n) => n !== id) : [...prev, id]
      trackEvent('Training', 'toggle_note', id, exists ? 0 : 1)
      syncToCloud(stats, updated)
      return updated
    })
  }

  const handleGuess = (guessedNote: NoteItem) => {
    if (!currentNote || lastGuess) return

    const isCorrect = guessedNote.id === currentNote.id
    setLastGuess({ id: guessedNote.id, correct: isCorrect })
    playFeedback(isCorrect)

    trackEvent('Training', isCorrect ? 'correct' : 'wrong', `${guessedNote.name}_${currentNote.name}`)

    setStats((prev) => {
      const nextTotal = prev.total + 1
      const nextCorrect = isCorrect ? prev.correct + 1 : prev.correct
      const nextStreak = isCorrect ? prev.streak + 1 : 0
      const nextBest = Math.max(prev.bestStreak, nextStreak)
      const updated = { total: nextTotal, correct: nextCorrect, streak: nextStreak, bestStreak: nextBest }
      syncToCloud(updated, selectedNotes)
      return updated
    })

    if (isCorrect) {
      setFeedbackText(`Acertou! ${getNoteLabel(currentNote)} (${currentOctave}ª oitava)`)
    } else {
      setFeedbackText(`Era ${getNoteLabel(currentNote)} (${currentOctave}ª oitava)`)
    }

    if (autoAdvance) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(
        () => {
          pickNewRound()
        },
        isCorrect ? 850 : 1500
      )
    }
  }

  const resetStats = () => {
    trackEvent('Training', 'reset_stats')
    const zero = { total: 0, correct: 0, streak: 0, bestStreak: 0 }
    setStats(zero)
    setLastGuess(null)
    setFeedbackText('')
    syncToCloud(zero, selectedNotes)
  }

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
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand" onClick={() => changeView('landing')}>
          <span className="logo-icon">🎵</span>
          <span className="logo-title">Audix</span>
          <span className="badge-free">Free</span>
        </div>

        <div className="nav-right">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${currentView === 'landing' ? 'active' : ''}`}
              onClick={() => changeView('landing')}
            >
              Início
            </button>
            <button
              className={`nav-tab ${currentView === 'app' ? 'active' : ''}`}
              onClick={() => changeView('app')}
            >
              Treinar
            </button>
          </div>

          {!user ? (
            <button className="btn-nav-login" onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? '...' : 'Entrar'}
            </button>
          ) : (
            <>
              <div className="user-chip" title={user.email || ''}>
                {user.photoURL && <img src={user.photoURL} alt="" className="user-avatar" />}
                <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                {isSyncing && <span className="sync-dot" />}
              </div>
              <button className="btn-sign-out" onClick={handleLogout} title="Sair da conta">
                Sair
              </button>
            </>
          )}

          {!isInstalled && (
            <button className="btn-nav-install" onClick={handleInstallClick} title="Instalar aplicativo">
              📲
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      {currentView === 'landing' ? (
        <LandingPage
          onStartTraining={() => changeView('app')}
          user={user}
          onLogin={handleLogin}
          onInstall={handleInstallClick}
          isInstalled={isInstalled}
          isLoggingIn={isLoggingIn}
        />
      ) : (
        <div className="training-view">
          {/* Header */}
          <div className="training-header">
            <h2>Treino de Percepção</h2>
            <div className="training-meta">
              <span>Criado por</span>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackOutboundLink(INSTAGRAM_URL, 'instagram_training')}
              >
                @klausterra
              </a>
              <span>•</span>
              <a
                href={HIPERCUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackOutboundLink(HIPERCUBE_URL, 'hipercube_training')}
              >
                Hipercube
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="stats-bar">
            <div className="stat-group">
              <div className="stat">
                <span className="stat-label">Precisão</span>
                <span className="stat-value">{accuracy}%</span>
                <span className="stat-sub">{stats.correct}/{stats.total}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Sequência</span>
                <span className="stat-value streak">🔥 {stats.streak}</span>
                <span className="stat-sub">Recorde: {stats.bestStreak}</span>
              </div>
            </div>
            <button className="btn-reset" onClick={resetStats}>
              Zerar
            </button>
          </div>

          {/* Practice Panel */}
          <div className="play-panel">
            <div className="play-row">
              <button
                className={`btn-play ${isPlaying ? 'playing' : ''}`}
                onClick={replayCurrentNote}
              >
                <span>{isPlaying ? '🔊 Tocando...' : '▶ Ouvir Nota'}</span>
              </button>
              <button className="btn-ref" onClick={playReferenceC} title="Tocar Dó central">
                🎯 Dó (C4)
              </button>
            </div>

            {/* Volume */}
            <div className="vol-row">
              <button
                className="btn-vol"
                onClick={() => setIsMuted((p) => !p)}
                title={isMuted ? 'Desmutar' : 'Mutar'}
              >
                {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value))
                  if (isMuted) setIsMuted(false)
                }}
                className="vol-slider"
                aria-label="Volume"
              />
              <span className="vol-pct">{isMuted ? '0%' : `${volume}%`}</span>
            </div>

            <span className="play-hint">
              Pressione <kbd>Espaço</kbd> para repetir o som
            </span>

            {/* Feedback message */}
            <div className={`feedback ${lastGuess ? (lastGuess.correct ? 'correct' : 'wrong') : ''}`}>
              {feedbackText || 'Escute e escolha a nota correspondente:'}
            </div>

            {/* Note buttons */}
            <div className="notes-grid">
              {activeNotes.map((note) => {
                const isSelected = lastGuess?.id === note.id
                const isCorrect = currentNote?.id === note.id
                let stateClass = ''

                if (lastGuess) {
                  if (isCorrect) stateClass = 'state-correct'
                  else if (isSelected && !lastGuess.correct) stateClass = 'state-wrong'
                  else stateClass = 'state-dim'
                }

                return (
                  <button
                    key={note.id}
                    className={`btn-note ${stateClass}`}
                    disabled={Boolean(lastGuess)}
                    onClick={() => handleGuess(note)}
                  >
                    <span className="note-primary">{notation === 'solfege' ? note.solfege : note.name}</span>
                    <span className="note-secondary">{notation === 'solfege' ? note.name : note.solfege}</span>
                  </button>
                )
              })}
            </div>

            {lastGuess && !autoAdvance && (
              <button className="btn-next-note" onClick={() => pickNewRound()}>
                Próxima Nota ➔
              </button>
            )}
          </div>

          {/* Settings / Notes selector */}
          <div className="settings-panel">
            <span className="settings-title">Notas Ativas ({activeNotes.length}/12)</span>

            <div className="presets-row">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="btn-preset"
                  onClick={() => {
                    setSelectedNotes(p.notes)
                    setLastGuess(null)
                    setFeedbackText('')
                    trackEvent('Training', 'preset', p.id)
                    syncToCloud(stats, p.notes)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="note-toggles">
              {ALL_NOTES.map((n) => {
                const on = selectedNotes.includes(n.id)
                return (
                  <label key={n.id} className={`note-toggle ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleNote(n.id)} />
                    <span className="nt-main">{n.name}</span>
                    <span className="nt-sub">{n.solfege}</span>
                  </label>
                )
              })}
            </div>

            <div className="settings-controls">
              <div className="ctrl">
                <label>Timbre:</label>
                <select
                  value={timbre}
                  onChange={(e) => {
                    const t = e.target.value as SoundTimbre
                    setTimbre(t)
                    trackEvent('Training', 'timbre', t)
                  }}
                >
                  <option value="piano">🎹 Piano Acústico</option>
                  <option value="acoustic_guitar">🎸 Violão Acústico</option>
                  <option value="electric_guitar">⚡ Guitarra Elétrica</option>
                  <option value="synth">🔊 Sintetizador</option>
                </select>
              </div>

              <div className="ctrl">
                <label>Notação:</label>
                <select
                  value={notation}
                  onChange={(e) => {
                    const v = e.target.value as 'letter' | 'solfege'
                    setNotation(v)
                    trackEvent('Training', 'notation', v)
                  }}
                >
                  <option value="solfege">Dó, Ré, Mi</option>
                  <option value="letter">C, D, E</option>
                </select>
              </div>

              <div className="ctrl">
                <label>Oitava:</label>
                <select
                  value={octave}
                  onChange={(e) => {
                    const v = e.target.value === 'random' ? 'random' : Number(e.target.value)
                    setOctave(v)
                    trackEvent('Training', 'octave', String(v))
                  }}
                >
                  <option value="4">4ª (Médio)</option>
                  <option value="3">3ª (Grave)</option>
                  <option value="5">5ª (Agudo)</option>
                  <option value="random">Aleatória</option>
                </select>
              </div>

              <div className="ctrl checkbox-ctrl">
                <label>
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                  />
                  Avanço automático
                </label>
              </div>
            </div>
          </div>

          {/* Pro Teaser */}
          <div className="pro-teaser">
            <span className="pro-badge">Em Breve</span>
            <span>Módulos de Intervalos (2ª a 8ª) e Acordes por R$ 9,90/mês.</span>
            <button className="btn-pro-more" onClick={() => changeView('landing')}>
              Ver Roadmap
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            <span className="modal-icon">🎵</span>
            <h3>Entrar no Audix</h3>
            <p>O treino de notas é 100% gratuito. Faça login para salvar seus recordes e preferências.</p>
            <button className="btn-google-modal" onClick={handleLogin}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continuar com Google
            </button>
            <span className="modal-note">Autenticado com segurança pelo Firebase.</span>
          </div>
        </div>
      )}

      {/* Install Modal */}
      {showInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInstallModal(false)}>✕</button>
            <span className="modal-icon">📲</span>
            <h3>Instalar o Audix</h3>
            <p>Adicione à tela inicial para praticar em tela cheia, mesmo sem internet.</p>
            <div className="install-steps">
              <div className="install-step">
                <span className="install-step-icon">💻</span>
                <div>
                  <strong>Chrome / Edge (PC)</strong>
                  <p>Clique no ícone de instalar na barra de navegação ou no menu ⋮.</p>
                </div>
              </div>
              <div className="install-step">
                <span className="install-step-icon">🤖</span>
                <div>
                  <strong>Android (Chrome)</strong>
                  <p>Toque em ⋮ ➔ "Instalar aplicativo" ou "Adicionar à tela inicial".</p>
                </div>
              </div>
              <div className="install-step">
                <span className="install-step-icon">🍏</span>
                <div>
                  <strong>iPhone / iPad (Safari)</strong>
                  <p>Toque em Compartilhar ➔ "Adicionar à Tela de Início".</p>
                </div>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowInstallModal(false)}
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-credits">
          <span>Criado por</span>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackOutboundLink(INSTAGRAM_URL, 'instagram_footer')}
          >
            Klaus Terra
          </a>
          <span className="footer-sep">•</span>
          <span>Desenvolvido pela</span>
          <a
            href={HIPERCUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackOutboundLink(HIPERCUBE_URL, 'hipercube_footer')}
          >
            Hipercube
          </a>
        </div>
        <span className="footer-sub">Audix • Treino de Ouvido 100% Gratuito</span>
      </footer>
    </div>
  )
}
