import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// --- Mocks ---
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@test.de' } }),
}));
vi.mock('@/hooks/useClubAuthority', () => ({
  useClubAuthority: () => ({ canManageClub: () => true, userEmail: 'me@test.de' }),
}));

type Row = {
  id: string;
  player_name: string;
  player_email: string;
  old_role: string | null;
  new_role: string | null;
  action: 'insert' | 'update' | 'delete';
  changed_by_email: string | null;
  created_at: string;
};

const ALL_ROWS: Row[] = [
  { id: '1', player_name: 'A', player_email: 'a@x', old_role: null, new_role: 'admin', action: 'insert', changed_by_email: 'b@x', created_at: new Date().toISOString() },
  { id: '2', player_name: 'B', player_email: 'b@x', old_role: 'player', new_role: 'chairman', action: 'update', changed_by_email: 'b@x', created_at: new Date().toISOString() },
  { id: '3', player_name: 'C', player_email: 'c@x', old_role: 'admin', new_role: 'player', action: 'update', changed_by_email: 'b@x', created_at: new Date().toISOString() },
  { id: '4', player_name: 'D', player_email: 'd@x', old_role: 'chairman', new_role: null, action: 'delete', changed_by_email: 'b@x', created_at: new Date().toISOString() },
  { id: '5', player_name: 'E', player_email: 'e@x', old_role: null, new_role: 'player', action: 'insert', changed_by_email: 'b@x', created_at: new Date().toISOString() },
];

// Simuliert die Postgrest-Filter (eq + or admin/chairman)
function applyFilters(rows: Row[], opts: { action?: string; role?: string }) {
  return rows.filter(r => {
    if (opts.action && opts.action !== 'all' && r.action !== opts.action) return false;
    if (opts.role && opts.role !== 'all') {
      if (r.new_role !== opts.role && r.old_role !== opts.role) return false;
    }
    return true;
  });
}

const captured: { table?: string; eqs: [string, any][]; ors: string[]; range?: [number, number] } = { eqs: [], ors: [] };

function makeBuilder(table: string, dataset: Row[]) {
  const state = { eqs: [] as [string, any][], ors: [] as string[], range: [0, 9] as [number, number] };
  const b: any = {
    select: (_cols: string, _opts?: any) => b,
    eq: (col: string, val: any) => { state.eqs.push([col, val]); captured.eqs.push([col, val]); return b; },
    or: (expr: string) => { state.ors.push(expr); captured.ors.push(expr); return b; },
    order: () => b,
    range: (from: number, to: number) => {
      state.range = [from, to];
      captured.range = [from, to];
      captured.table = table;
      // Apply our captured filters to dataset to simulate DB
      let role: string | undefined;
      let action: string | undefined;
      for (const [c, v] of state.eqs) {
        if (c === 'action') action = v;
      }
      for (const expr of state.ors) {
        const m = expr.match(/new_role\.eq\.(\w+),old_role\.eq\.(\w+)/);
        if (m && m[1] === m[2]) role = m[1];
      }
      const filtered = applyFilters(dataset, { action, role });
      const slice = filtered.slice(from, to + 1);
      return Promise.resolve({ data: slice, count: filtered.length, error: null });
    },
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'club_players') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ email: 'me@test.de' }], error: null }) }),
        };
      }
      return makeBuilder(table, ALL_ROWS);
    },
  },
}));

import { ClubRoleHistory } from './ClubRoleHistory';

describe('ClubRoleHistory – Rollenfilter', () => {
  beforeEach(() => {
    captured.eqs = [];
    captured.ors = [];
    captured.range = undefined;
    captured.table = undefined;
  });

  it('lädt initial ohne Filter alle Einträge', async () => {
    render(<ClubRoleHistory clubId="club-1" />);
    await waitFor(() => expect(screen.getByText(/Rollenverlauf/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/\(5\/5\)/)).toBeInTheDocument());
    expect(captured.ors.length).toBe(0);
  });

  it('filtert "admin" über old_role ODER new_role (kein false positive)', async () => {
    const user = userEvent.setup();
    render(<ClubRoleHistory clubId="club-1" />);
    await waitFor(() => screen.getByText(/\(5\/5\)/));

    await user.click(screen.getByRole('button', { name: 'Admin' }));

    await waitFor(() => {
      expect(captured.ors.some(o => o === 'new_role.eq.admin,old_role.eq.admin')).toBe(true);
    });
    // Erwartete Treffer: id 1 (new=admin) und id 3 (old=admin)
    await waitFor(() => expect(screen.getByText(/\(2\/2\)/)).toBeInTheDocument());
  });

  it('filtert "chairman" korrekt und schließt admin-only Einträge aus', async () => {
    const user = userEvent.setup();
    render(<ClubRoleHistory clubId="club-1" />);
    await waitFor(() => screen.getByText(/\(5\/5\)/));

    await user.click(screen.getByRole('button', { name: 'Vorsitz' }));

    await waitFor(() => {
      expect(captured.ors.some(o => o === 'new_role.eq.chairman,old_role.eq.chairman')).toBe(true);
    });
    // Erwartete Treffer: id 2 (new=chairman), id 4 (old=chairman)
    await waitFor(() => expect(screen.getByText(/\(2\/2\)/)).toBeInTheDocument());
  });

  it('kombiniert Action- und Rollenfilter korrekt', async () => {
    const user = userEvent.setup();
    render(<ClubRoleHistory clubId="club-1" />);
    await waitFor(() => screen.getByText(/\(5\/5\)/));

    await user.click(screen.getByRole('button', { name: 'Admin' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(captured.eqs.some(([c, v]) => c === 'action' && v === 'update')).toBe(true);
      expect(captured.ors.some(o => o === 'new_role.eq.admin,old_role.eq.admin')).toBe(true);
    });
    // Nur id 3 (admin + update)
    await waitFor(() => expect(screen.getByText(/\(1\/1\)/)).toBeInTheDocument());
  });

  it('applyFilters: keine false positives für player-only Einträge bei admin/chairman', () => {
    expect(applyFilters(ALL_ROWS, { role: 'admin' }).map(r => r.id).sort()).toEqual(['1', '3']);
    expect(applyFilters(ALL_ROWS, { role: 'chairman' }).map(r => r.id).sort()).toEqual(['2', '4']);
    // Eintrag id 5 (player → player) darf NIE bei admin/chairman erscheinen
    expect(applyFilters(ALL_ROWS, { role: 'admin' }).find(r => r.id === '5')).toBeUndefined();
    expect(applyFilters(ALL_ROWS, { role: 'chairman' }).find(r => r.id === '5')).toBeUndefined();
  });
});
