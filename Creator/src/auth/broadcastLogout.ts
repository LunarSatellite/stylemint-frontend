const channel = new BroadcastChannel('auth')

export function broadcastLogout() {
  channel.postMessage({ type: 'LOGOUT' })
}

export function listenForLogout(onLogout: () => void) {
  channel.addEventListener('message', (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type === 'LOGOUT') onLogout()
  })
}
