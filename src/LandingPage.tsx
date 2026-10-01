import React, { useState } from 'react'
import type { User } from 'firebase/auth'
import { recordLeadForm } from './firebase'
import { trackEvent, trackGoal } from './matomo'

interface LandingPageProps {
  onStartTraining: () => void
  user: User | null
  onLogin: () => void
  onInstall?: () => void
  canInstall?: boolean
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartTraining,
  user,
  onLogin,
  onInstall,
  canInstall,
}) => {
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [instrument, setInstrument] = useState('Violão/Guitarra')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName || !leadEmail) return

    setIsSubmitting(true)
    try {
      await recordLeadForm({
        name: leadName,
        email: leadEmail,
        instrument,
        goal: 'Treino de percepção auditiva',
      })
      trackEvent('Lead', 'form_submit', instrument)
      trackGoal(2) // Lead_Captured
      setLeadSubmitted(true)
    } catch (err) {
      console.warn('Erro ao salvar lead:', err)
      alert('Erro ao enviar cadastro. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrimaryCta = () => {
    trackEvent('Landing', 'click_cta_start_training', user ? 'logged_in' : 'anonymous')
    if (user) {
      onStartTraining()
    } else {
      onLogin()
    }
  }

  return (
    <div className="landing-wrap">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="free-pill">
          <span className="sparkle">✦</span> 100% Gratuito • Sem Assinaturas • Sem Anúncios
        </div>

        <h1 className="hero-title">
          Treine seu ouvido musical.<br />
          <span className="gradient-text">Do iniciante ao ouvido absoluto.</span>
        </h1>

        <p className="hero-desc">
          O <strong>Audix</strong> é uma plataforma aberta para você escolher exatamente
          quais notas quer treinar, customizar oitavas, acompanhar sua evolução e sincronizar seu histórico no Firestore.
        </p>

        <div className="hero-cta-group">
          {user ? (
            <button className="btn-hero-primary" onClick={handlePrimaryCta}>
              <span>Acessar Meu Treino</span>
              <span className="arrow-icon">➔</span>
            </button>
          ) : (
            <button className="btn-hero-primary" onClick={handlePrimaryCta}>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Entrar com Google para Treinar Grátis</span>
              <span className="arrow-icon">➔</span>
            </button>
          )}

          {canInstall && (
            <button
              className="btn-hero-install"
              onClick={() => {
                trackEvent('PWA', 'click_hero_install')
                onInstall?.()
              }}
            >
              📲 Instalar no Dispositivo
            </button>
          )}
        </div>

        <p className="login-hint-text">
          🔒 Acesso gratuito com login Google para sincronização de recordes e precisão no Firestore.
        </p>
      </section>

      {/* Free Promise Banner */}
      <section className="free-banner">
        <div className="free-banner-content">
          <div className="free-badge-big">GRÁTIS</div>
          <div className="free-banner-text">
            <h3>Por que o Audix é gratuito?</h3>
            <p>
              A percepção musical deve ser acessível para todo músico.
              Sem assinaturas pagas, sem notas cromáticas trancadas e sem propagandas atrapalhando seu foco sonoro.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🎯</div>
          <h3>Filtro de Notas Flexível</h3>
          <p>
            Escolha qualquer combinação: comece com 2 ou 3 notas e vá adicionando semitons progressivamente até a escala cromática completa.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">☁️</div>
          <h3>Nuvem Google / Firestore</h3>
          <p>
            Seu progresso, sequência diária (streak) e notas favoritas salvos na nuvem do projeto Hipercube.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🎹</div>
          <h3>Síntese Sonora Instantânea</h3>
          <p>
            Áudio analógico gerado em tempo real pelo navegador via Web Audio API. Zero delay e controle de volume preciso.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">📱</div>
          <h3>PWA Instalável e Offline</h3>
          <p>
            Instale como app no celular ou desktop. Pratique no metrô, estúdio ou sala de ensaio.
          </p>
        </div>
      </section>

      {/* Lead Capture Section */}
      <section className="lead-capture-card">
        <div className="lead-header">
          <span className="lead-pill">Comunidade de Músicos</span>
          <h2>Quer evoluir seu ouvido mais rápido?</h2>
          <p>Cadastre-se para receber novos exercícios de intervalos, acordes e dicas práticas de treino diário.</p>
        </div>

        {!leadSubmitted ? (
          <form className="lead-form" onSubmit={handleLeadSubmit}>
            <div className="lead-inputs-row">
              <input
                type="text"
                placeholder="Seu nome"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                required
                className="lead-input"
              />
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                value={leadEmail}
                onChange={e => setLeadEmail(e.target.value)}
                required
                className="lead-input"
              />
              <select
                value={instrument}
                onChange={e => setInstrument(e.target.value)}
                className="lead-select"
              >
                <option value="Violão/Guitarra">Violão / Guitarra</option>
                <option value="Piano/Teclado">Piano / Teclado</option>
                <option value="Voz/Canto">Voz / Canto</option>
                <option value="Baixo">Baixo</option>
                <option value="Bateria/Percussão">Bateria / Percussão</option>
                <option value="Produção Musical">Produção Musical</option>
                <option value="Outro">Outro instrumento</option>
              </select>
            </div>

            <button type="submit" className="btn-lead-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Cadastrando...' : 'Quero Receber Dicas e Exercícios ➔'}
            </button>
            <span className="lead-privacy">Respeitamos sua privacidade. Zero spam.</span>
          </form>
        ) : (
          <div className="lead-success-box">
            <span className="success-icon">✅</span>
            <h3>Cadastro confirmado com sucesso!</h3>
            <p>Seus dados foram registrados no Audix. Agora faça login com sua conta Google para treinar.</p>
            {!user && (
              <button className="btn-hero-primary" onClick={onLogin} style={{ marginTop: '12px' }}>
                Entrar com Google ➔
              </button>
            )}
          </div>
        )}
      </section>

      {/* Quick CTA Bottom */}
      <section className="bottom-cta">
        <h2>Pronto para afiar seu ouvido?</h2>
        <p>Pratique 5 minutos por dia e veja a diferença na percepção de intervalos e melodias.</p>
        <button className="btn-hero-primary" onClick={handlePrimaryCta}>
          {user ? 'Abrir o Treinador ➔' : 'Fazer Login e Começar ➔'}
        </button>
      </section>
    </div>
  )
}
