import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthSyncRedirect } from './AuthSyncRedirect';
import { broadcastSignOut, AUTH_SIGNOUT_KEY } from '@/lib/authSync';

const TOKEN_KEY = 'sb-testproject-auth-token';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthSyncRedirect />
      <Routes>
        <Route path="/" element={<div>Startseite</div>} />
        <Route path="/live/:id" element={<div>Live-Ansicht</div>} />
        <Route path="/auth" element={<div>Login-Seite</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AuthSyncRedirect (Cross-Tab)', () => {
  it('wechselt bei Logout-Broadcast aus einem anderen Tab sofort auf /auth', async () => {
    renderAt('/');
    expect(screen.getByText('Startseite')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: AUTH_SIGNOUT_KEY, newValue: String(Date.now()) })
      );
    });

    expect(screen.getByText('Login-Seite')).toBeInTheDocument();
  });

  it('wechselt auf /auth, wenn ein anderer Tab den Token entfernt', async () => {
    renderAt('/');

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, newValue: null }));
    });

    expect(screen.getByText('Login-Seite')).toBeInTheDocument();
  });

  it('ignoriert unrelated storage-Keys', async () => {
    renderAt('/');

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'sponsor-cache', newValue: 'x' }));
    });

    expect(screen.getByText('Startseite')).toBeInTheDocument();
  });

  it('lässt öffentliche Live-Routen unangetastet', async () => {
    renderAt('/live/abc');

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: AUTH_SIGNOUT_KEY, newValue: String(Date.now()) })
      );
    });

    expect(screen.getByText('Live-Ansicht')).toBeInTheDocument();
  });
});

describe('broadcastSignOut', () => {
  it('schreibt einen Marker in den LocalStorage', () => {
    broadcastSignOut();
    expect(localStorage.getItem(AUTH_SIGNOUT_KEY)).toBeTruthy();
  });
});
