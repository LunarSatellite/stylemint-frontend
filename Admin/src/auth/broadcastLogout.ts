import { useAuth } from './store'

const bc = new BroadcastChannel('auth')

export function initBroadcastLogout() {
  useAuth.subscribe((s, p) => {
    if (p.token && !s.token) bc.postMessage({ type: 'logout' })
  })
  bc.onmessage = (e) => {
    if (e.data.type === 'logout') useAuth.getState().clear()
  }
}
