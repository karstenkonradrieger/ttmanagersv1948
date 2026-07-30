/**
 * Cross-tab auth synchronisation.
 *
 * When one tab signs out (or its token disappears), every other open tab must
 * immediately drop its session and navigate to /auth. We use two channels for
 * redundancy: a BroadcastChannel (instant, same-origin) and a localStorage key
 * (works in every browser and also fires the native `storage` event).
 */

export const AUTH_SIGNOUT_KEY = 'tt-auth-signout';

export function isAuthTokenKey(key: string | null | undefined): boolean {
  return !!key && key.startsWith('sb-') && key.includes('-auth-token');
}

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel('tt-auth');
  return channel;
}

/** Tell all other tabs that the user is signed out. */
export function broadcastSignOut() {
  try {
    localStorage.setItem(AUTH_SIGNOUT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    getChannel()?.postMessage({ type: 'signout' });
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to sign-out signals from other tabs (explicit broadcast or a
 * removed/emptied auth token). Returns an unsubscribe function.
 */
export function onAuthSignOut(handler: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === AUTH_SIGNOUT_KEY && e.newValue) {
      handler();
      return;
    }
    // Token removed or cleared in another tab
    if ((isAuthTokenKey(e.key) && !e.newValue) || e.key === null) {
      handler();
    }
  };
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'signout') handler();
  };

  window.addEventListener('storage', onStorage);
  const ch = getChannel();
  ch?.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('storage', onStorage);
    ch?.removeEventListener('message', onMessage);
  };
}
