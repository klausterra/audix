declare global {
  interface Window {
    _paq?: unknown[][]
  }
}

export const MATOMO_URL = 'https://matomo.hipercube.ia.br/'
export const MATOMO_SITE_ID = '26'

export function initMatomo(): void {
  if (typeof window === 'undefined') return
  if (document.querySelector('script[data-matomo="audix"]')) return

  const _paq = (window._paq = window._paq || [])
  _paq.push(['enableHeartBeatTimer', 15])
  _paq.push(['enableLinkTracking'])
  _paq.push(['setTrackerUrl', `${MATOMO_URL}matomo.php`])
  _paq.push(['setSiteId', MATOMO_SITE_ID])

  const g = document.createElement('script')
  g.async = true
  g.src = `${MATOMO_URL}matomo.js`
  g.dataset.matomo = 'audix'
  const s = document.getElementsByTagName('script')[0]
  s?.parentNode?.insertBefore(g, s)
}

export function trackPageView(path: string, title?: string): void {
  const _paq = window._paq
  if (!_paq) return
  const url = path.startsWith('/') ? path : `/${path}`
  _paq.push(['setCustomUrl', url])
  if (title) {
    _paq.push(['setDocumentTitle', title])
  }
  _paq.push(['trackPageView'])
}

export function trackEvent(category: string, action: string, name?: string, value?: number): void {
  const _paq = window._paq
  if (!_paq) return
  const args: unknown[] = ['trackEvent', category, action]
  if (name !== undefined) args.push(name)
  if (value !== undefined) args.push(value)
  _paq.push(args)
}

export function trackGoal(goalId: number, revenue?: number): void {
  const _paq = window._paq
  if (!_paq) return
  if (revenue !== undefined) {
    _paq.push(['trackGoal', goalId, revenue])
  } else {
    _paq.push(['trackGoal', goalId])
  }
}

export function setMatomoUser(userId: string): void {
  const _paq = window._paq
  if (!_paq) return
  _paq.push(['setUserId', userId])
}

export function resetMatomoUser(): void {
  const _paq = window._paq
  if (!_paq) return
  _paq.push(['resetUserId'])
}
