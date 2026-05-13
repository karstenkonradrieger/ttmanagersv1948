import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const fromSpy = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@test.de' } }) }));
vi.mock('@/hooks/useClubAuthority', () => ({ useClubAuthority: () => ({ canManageClub: () => true, userEmail: 'me@test.de' }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: any[]) => { fromSpy(...a); const b: any = { select: () => b, eq: (c: string) => c === 'club_id' && a[0] === 'club_players' ? Promise.resolve({ data: [{ email: 'me@test.de' }] }) : b, or: () => b, order: () => b, range: () => Promise.resolve({ data: [], count: 0 }) }; return b; } }
}));

import { ClubRoleHistory } from '@/components/ClubRoleHistory';

describe('debug', () => {
  it('mock used', async () => {
    render(<ClubRoleHistory clubId="c1" />);
    await new Promise(r => setTimeout(r, 800));
    process.stdout.write('CALLS: ' + JSON.stringify(fromSpy.mock.calls) + '\n');
    process.stdout.write('HTML: ' + document.body.innerHTML + '\n');
  });
});
