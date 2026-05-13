import { describe, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@test.de' } }) }));
vi.mock('@/hooks/useClubAuthority', () => ({ useClubAuthority: () => ({ canManageClub: () => true, userEmail: 'me@test.de' }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => {
      console.log('FROM', t);
      const b: any = {
        select: (...a: any[]) => { console.log('select', a); return b; },
        eq: (...a: any[]) => { console.log('eq', a); if (t === 'club_players') return Promise.resolve({ data: [{ email: 'me@test.de' }] }); return b; },
        or: (...a: any[]) => { console.log('or', a); return b; },
        order: () => b,
        range: (...a: any[]) => { console.log('range', a); return Promise.resolve({ data: [], count: 0 }); },
      };
      return b;
    }
  }
}));

import { ClubRoleHistory } from '@/components/ClubRoleHistory';

describe('debug', () => {
  it('renders', async () => {
    render(<ClubRoleHistory clubId="c1" />);
    await new Promise(r => setTimeout(r, 500));
    console.log('HTML:', document.body.innerHTML.slice(0, 500));
  });
});
