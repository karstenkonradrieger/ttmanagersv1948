import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const TOKEN_KEY = 'sb-testproject-auth-token';

const authState = {
  session: null as any,
  callback: null as null | ((event: string, session: any) => void),
};

const signOutMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        authState.callback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: async () => ({ data: { session: authState.session } }),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

const fakeSession = { user: { id: 'u1', email: 'a@b.de' }, access_token: 'a', refresh_token: 'r' };

async function importAuth() {
  return await import('./useAuth');
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  authState.session = null;
  authState.callback = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAuth – Logout-Flow', () => {
  it('meldet ab und entfernt gespeicherte Tokens', async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    authState.session = fakeSession;
    const { useAuth } = await importAuth();
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('meldet lokal ab, wenn der Refresh-Token ungültig ist (kein SIGNED_OUT-Event)', async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    authState.session = fakeSession;
    signOutMock.mockRejectedValue(new Error('Invalid Refresh Token: Refresh Token Not Found'));

    const { useAuth } = await importAuth();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => {
      await result.current.signOut();
    });

    // Kein SIGNED_OUT-Event vom Server – trotzdem lokal abgemeldet
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('erkennt entfernte Tokens aus einem anderen Tab (storage-Event)', async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    authState.session = fakeSession;
    const { useAuth } = await importAuth();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeTruthy());

    await act(async () => {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY }));
    });

    expect(result.current.user).toBeNull();
  });

  it('erkennt entfernte Tokens auch ohne Event über den Watchdog-Intervall', async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    authState.session = fakeSession;
    const { useAuth } = await importAuth();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeTruthy());

    localStorage.removeItem(TOKEN_KEY);
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.user).toBeNull();
  });
});

describe('hasStoredAuthToken', () => {
  it('ist false ohne Token und true mit Token', async () => {
    const { hasStoredAuthToken } = await importAuth();
    expect(hasStoredAuthToken()).toBe(false);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    expect(hasStoredAuthToken()).toBe(true);
  });
});

describe('ProtectedRoute Guard', () => {
  it('leitet ohne Token sofort auf /auth um', async () => {
    const { ProtectedRoute } = await import('@/App');
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><div>Geschützt</div></ProtectedRoute>} />
          <Route path="/auth" element={<div>Login-Seite</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Login-Seite')).toBeInTheDocument();
  });

  it('zeigt geschützten Inhalt mit gültiger Session', async () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(fakeSession));
    authState.session = fakeSession;
    const { ProtectedRoute } = await import('@/App');
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><div>Geschützt</div></ProtectedRoute>} />
          <Route path="/auth" element={<div>Login-Seite</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Geschützt')).toBeInTheDocument();
  });
});
