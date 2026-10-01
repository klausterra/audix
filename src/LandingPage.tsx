import React from 'react'
import type { User } from 'firebase/auth'

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
          O <strong>Audix</strong> é uma plataforma aberta e sem limites para você escolher exatamente
          quais notas quer treinar, customizar oitavas, acompanhar sua precisão e sincronizar seu histórico na nuvem.
        </p>

        <div className="hero-cta-group">
          <button className="btn-hero-primary" onClick={onStartTraining}>
            <span>Começar Treino Grátis</span>
            <span className="arrow-icon">➔</span>
          </button>

          {!user ? (
            <button className="btn-hero-secondary" onClick={onLogin}>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Salvar com Google</span>
            </button>
          ) : (
            <div className="user-logged-badge">
              <img src={user.photoURL || ''} alt="" className="avatar-img" />
              <span>Olá, {user.displayName?.split(' ')[0]}</span>
            </div>
          )}

          {canInstall && (
            <button className="btn-hero-install" onClick={onInstall}>
              📲 Instalar no Dispositivo
            </button>
          )}
        </div>
      </section>

      {/* Free Promise Banner */}
      <section className="free-banner">
        <div className="free-banner-content">
          <div className="free-badge-big">GRATIS</div>
          <div className="free-banner-text">
            <h3>Por que o Audix é gratuito?</h3>
            <p>
              Acreditamos que a percepção musical deve ser acessível para todo instrumentista, cantor e produtor.
              Sem planos premium, sem bloqueio de notas cromáticas e sem popups de compra.
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
            Entre com sua conta Google e mantenha recordes, histórico de precisão e notas ativas sincronizados no Firestore do projeto Hipercube.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🎹</div>
          <h3>Síntese Sonora Instantânea</h3>
          <p>
            Áudio sintetizado em tempo real pelo navegador com Web Audio API. Zero delay, timbre orgânico e controle de volume integrado.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">📱</div>
          <h3>PWA Instalável e Offline</h3>
          <p>
            Instale como aplicativo nativo no celular ou computador. Pratique onde estiver com carregamento instantâneo.
          </p>
        </div>
      </section>

      {/* Quick CTA Bottom */}
      <section className="bottom-cta">
        <h2>Pronto para afiar seu ouvido?</h2>
        <p>Pratique 5 minutos por dia e veja a diferença na percepção de intervalos e melodias.</p>
        <button className="btn-hero-primary" onClick={onStartTraining}>
          Abrir o Treinador ➔
        </button>
      </section>
    </div>
  )
}
