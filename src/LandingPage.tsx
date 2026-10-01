import React, { useState } from 'react'
import type { User } from 'firebase/auth'
import { recordLeadForm } from './firebase'
import { trackEvent, trackGoal, trackOutboundLink, INSTAGRAM_URL, HIPERCUBE_URL } from './matomo'

interface LandingPageProps {
  onStartTraining: () => void
  user: User | null
  onLogin: () => void
  onInstall?: () => void
  isInstalled?: boolean
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartTraining,
  user,
  onLogin,
  onInstall,
  isInstalled,
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
        goal: 'Treino de percepção auditiva e lista VIP de novos módulos',
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

          {!isInstalled && (
            <button
              className="btn-hero-install"
              onClick={() => {
                trackEvent('PWA', 'click_hero_install')
                onInstall?.()
              }}
            >
              📲 Instalar App (PWA)
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
            <h3>O treino de notas é 100% gratuito e para sempre</h3>
            <p>
              Toda a base de percepção de notas cromáticas, oitavas, Web Audio sintetizado e sincronização na nuvem
              é livre para qualquer músico praticar sem limites e sem propagandas chatas.
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

      {/* Roadmap & Future Pro Modules */}
      <section className="roadmap-card">
        <div className="roadmap-header">
          <span className="roadmap-tag">Roadmap de Expansão</span>
          <h2>Próximas Funcionalidades & Módulos Pro</h2>
          <p>
            O treino de notas individuais permanecerá <strong>100% gratuito</strong>. Para os módulos avançados abaixo,
            vamos disponibilizar uma assinatura simbólica e super acessível (R$ 9,90/mês):
          </p>
        </div>

        <div className="modules-grid">
          <div className="module-item">
            <span className="module-icon">🎼</span>
            <h4>Treino de Intervalos</h4>
            <p>Identifique segundas, terças, quartas, quintas e oitavas ascendentes e descendentes.</p>
            <span className="module-badge">Em Breve</span>
          </div>

          <div className="module-item">
            <span className="module-icon">🎸</span>
            <h4>Acordes & Tétrades</h4>
            <p>Reconheça tríades maiores, menores, diminutas e tétrades com 7M/m7 ao ouvir.</p>
            <span className="module-badge">Em Breve</span>
          </div>

          <div className="module-item">
            <span className="module-icon">🎹</span>
            <h4>Timbres Instrumentais</h4>
            <p>Alterne entre piano de cauda acústico, violão nylon/aço, rhodes e sintetizador.</p>
            <span className="module-badge">Em Breve</span>
          </div>

          <div className="module-item">
            <span className="module-icon">📊</span>
            <h4>Diagnóstico de Dificuldades</h4>
            <p>Análise estatística para focar automaticamente nas notas e intervalos onde você mais erra.</p>
            <span className="module-badge">Em Breve</span>
          </div>
        </div>

        <div className="roadmap-footer">
          <p>💡 Cadastre-se abaixo para garantir <strong>condição especial de fundador</strong> quando os módulos forem lançados.</p>
        </div>
      </section>

      {/* Lead Capture Section */}
      <section className="lead-capture-card">
        <div className="lead-header">
          <span className="lead-pill">Lista VIP de Fundadores</span>
          <h2>Quer receber novos exercícios e avisos de lançamento?</h2>
          <p>Cadastre seu e-mail para receber guias práticos de treino de ouvido e garantir acesso antecipado aos módulos Pro.</p>
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
              {isSubmitting ? 'Cadastrando...' : 'Quero Acesso VIP e Dicas de Percepção ➔'}
            </button>
            <span className="lead-privacy">Respeitamos sua privacidade. Zero spam.</span>
          </form>
        ) : (
          <div className="lead-success-box">
            <span className="success-icon">✅</span>
            <h3>Você está na Lista VIP do Audix!</h3>
            <p>Seus dados foram registrados com sucesso no Firestore. Agora faça login com sua conta Google para começar a treinar.</p>
            {!user && (
              <button className="btn-hero-primary" onClick={onLogin} style={{ marginTop: '12px' }}>
                Entrar com Google ➔
              </button>
            )}
          </div>
        )}
      </section>

      {/* Prominent Creator & Hipercube Showcase */}
      <section className="showcase-section">
        <div className="showcase-card creator-showcase">
          <div className="showcase-badge">Criador</div>
          <div className="showcase-body">
            <div className="showcase-avatar">KT</div>
            <div className="showcase-text">
              <h3>Klaus Terra</h3>
              <p className="showcase-bio">
                Engenheiro de IA, músico e fundador de produtos de alta tecnologia.
                Compartilho bastidores de desenvolvimento de ferramentas musicais, inteligência artificial e código em produção.
              </p>
            </div>
          </div>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-showcase instagram"
            onClick={() => trackOutboundLink(INSTAGRAM_URL, 'instagram_klausterra_showcase')}
          >
            <svg className="social-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span>Seguir @klausterra no Instagram ➔</span>
          </a>
        </div>

        <div className="showcase-card hipercube-showcase">
          <div className="showcase-badge company">Desenvolvedora</div>
          <div className="showcase-body">
            <div className="showcase-avatar hc">HC</div>
            <div className="showcase-text">
              <h3>Hipercube</h3>
              <p className="showcase-bio">
                Ecossistema de inteligência artificial, engenharia de software e produtos digitais que potencializam pessoas e empresas.
              </p>
            </div>
          </div>
          <a
            href={HIPERCUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-showcase hipercube"
            onClick={() => trackOutboundLink(HIPERCUBE_URL, 'hipercube_portal_showcase')}
          >
            <span>🌐</span>
            <span>Conhecer o portal hipercube.ia.br ➔</span>
          </a>
        </div>
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
