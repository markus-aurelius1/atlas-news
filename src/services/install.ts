/** Capture the browser's install prompt so we can offer "Install app" at a calm moment. */
import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const useInstall = create<{ event: BeforeInstallPromptEvent | null; installed: boolean }>(() => ({ event: null, installed: false }))

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useInstall.setState({ event: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstall.setState({ event: null, installed: true }))
}

export async function promptInstall(): Promise<boolean> {
  const e = useInstall.getState().event
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  useInstall.setState({ event: null })
  return outcome === 'accepted'
}
