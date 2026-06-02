const CHANNEL_NAME = 'sm_auth'

let channel: BroadcastChannel | null = null

function getChannel() {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export function broadcastLogout() {
  getChannel().postMessage({ type: 'logout' })
}

export function subscribeBroadcastLogout(onLogout: () => void): () => void {
  const ch = getChannel()
  const handler = (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type === 'logout') onLogout()
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
