import React, { useState } from 'react'
import type { User } from 'firebase/auth'
import { recordLeadForm } from './firebase'
import {
  trackEvent,
  trackGoal,
  trackOutboundLink,
  INSTAGRAM_URL,
  HIPERCUBE_URL,
} from './matomo'

interface LandingPageProps {
  onStartTraining: () => void
  user: User | null
  onLogin: () => void
  onInstall?: () => void
  isInstalled?: boolean
  isLoggingIn?: boolean
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartTraining,
  user,
  onLogin,
  onInstall,
  isInstalled,
  isLoggingIn,
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
        goal: 'Lista VIP de novos módulos',
      })
      trackEvent('Lead', 'form_submit', instrument)
      trackGoal(2)
      setLeadSubmitted(true)
    } catch (err) {
      console.warn('Erro ao salvar lead:', err)
      alert('Erro ao enviar cadastro. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAction = () => {
    trackEvent('Landing', 'click_cta', user ? 'logged_in' : 'anonymous')
    if (user) {
      onStartTraining()
    } else {
      onLogin()
    }
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <span className="hero-tag">✦ 100% Gratuito</span>

        <h1>
          Treine seu ouvido musical.<br />
          <span>Do zero ao absoluto.</span>
        </h1>

        <p>
          Escolha quais notas quer ouvir, identifique os sons no seu ritmo e acompanhe sua precisão dia após dia. Sem limites, sem assinaturas.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={handleAction} disabled={isLoggingIn}>
            {user ? (
              <>Acessar Meu Treino ➔</>
            ) : isLoggingIn ? (
              'Conectando com o Google...'
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Começar Treino Grátis ➔
              </>
            )}
          </button>

          {!isInstalled && (
            <button className="btn-secondary-outline" onClick={onInstall}>
              📲 Instalar App
            </button>
          )}
        </div>

        <span className="hero-note">Login com Google salva seu histórico e recordes.</span>
      </section>

      {/* Features */}
      <section className="features">
        <div className="feature-card">
          <span className="feature-icon">🎯</span>
          <h3>Filtre as Notas</h3>
          <p>Comece com 2 ou 3 notas e avance até a escala cromática completa no seu tempo.</p>
        </div>

        <div className="feature-card">
          <span className="feature-icon">⚡</span>
          <h3>Zero Latência</h3>
          <p>Áudio sintetizado no próprio navegador pela Web Audio API. Resposta instantânea.</p>
        </div>

        <div className="feature-card">
          <span className="feature-icon">☁️</span>
          <h3>Progresso na Nuvem</h3>
          <p>Seus acertos, sequência diária e preferências sincronizados no Firestore.</p>
        </div>
      </section>

      {/* Lead capture */}
      <section className="lead-section">
        <span className="badge-vip">Novidades</span>
        <h2>Receba novos módulos em primeira mão</h2>
        <p>
          Em breve: treino de intervalos, acordes e múltiplos instrumentos. Cadastre-se para ser avisado.
        </p>

        {!leadSubmitted ? (
          <form className="lead-form" onSubmit={handleLeadSubmit}>
            <div className="lead-row">
              <input
                type="text"
                placeholder="Seu nome"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                required
                className="input-field"
              />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="select-field"
            >
              <option value="Violão/Guitarra">Violão / Guitarra</option>
              <option value="Piano/Teclado">Piano / Teclado</option>
              <option value="Voz/Canto">Voz / Canto</option>
              <option value="Baixo">Baixo</option>
              <option value="Outro">Outro</option>
            </select>
            <button type="submit" className="btn-lead" disabled={isSubmitting}>
              {isSubmitting ? 'Cadastrando...' : 'Quero Acesso VIP ➔'}
            </button>
            <span className="lead-privacy">Zero spam. Cancele quando quiser.</span>
          </form>
        ) : (
          <div className="lead-success">
            <span>✅</span>
            <h3>Cadastro confirmado!</h3>
            <p>Você será o primeiro a testar os módulos de intervalos e acordes.</p>
          </div>
        )}
      </section>

      {/* Showcase */}
      <section className="showcase">
        <div className="sc-card creator-card">
          <span className="sc-tag creator">Criador</span>
          <div className="sc-body">
            <img src="/klaus-terra.jpg" alt="Klaus Terra" className="sc-photo" />
            <div className="sc-text">
              <h3>Klaus Terra</h3>
              <p className="sc-bio">
                Engenheiro de IA, músico e fundador. Compartilho bastidores de software e ferramentas musicais.
              </p>
            </div>
          </div>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sc-link ig"
            onClick={() => trackOutboundLink(INSTAGRAM_URL, 'instagram_showcase')}
          >
            Instagram @klausterra ➔
          </a>
        </div>

        <div className="sc-card hc-card">
          <span className="sc-tag hc">Desenvolvedora</span>
          <div className="sc-body">
            <div className="sc-logo-wrap">
              <img src="/hipercube-logo.png" alt="Hipercube" className="sc-logo" />
            </div>
            <div className="sc-text">
              <h3>Hipercube</h3>
              <p className="sc-bio">
                Ecossistema de IA e software que potencializa pessoas e negócios com tecnologia de ponta.
              </p>
            </div>
          </div>
          <a
            href={HIPERCUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sc-link hc"
            onClick={() => trackOutboundLink(HIPERCUBE_URL, 'hipercube_showcase')}
          >
            hipercube.ia.br ➔
          </a>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bottom-cta">
        <h2>Pronto para começar?</h2>
        <p>5 minutos de treino diário transformam a sua percepção musical.</p>
        <button className="btn-primary" onClick={handleAction} disabled={isLoggingIn}>
          {user ? 'Abrir Meu Treino ➔' : 'Entrar com Google e Treinar ➔'}
        </button>
      </section>
    </div>
  )
}
