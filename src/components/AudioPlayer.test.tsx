import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AudioPlayer } from './AudioPlayer';

const usePlaylistTracksMock = vi.fn(() => ({
  tracks: [],
  gongTrack: null,
  getPublicUrl: (p: string) => `https://cdn.test/${p}`,
}));

vi.mock('@/hooks/usePlaylistTracks', () => ({
  usePlaylistTracks: (id: string | null) => usePlaylistTracksMock(id as any),
}));

vi.mock('@/components/AnnouncementPhraseManager', () => ({
  AnnouncementPhraseManager: () => null,
}));

const TID_A = '11111111-1111-1111-1111-111111111111';
const TID_B = '22222222-2222-2222-2222-222222222222';
const TID_C = '33333333-3333-3333-3333-333333333333';
const TID_D = '44444444-4444-4444-4444-444444444444';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AudioPlayer />
    </MemoryRouter>
  );

describe('AudioPlayer route → tournament id', () => {
  beforeEach(() => usePlaylistTracksMock.mockClear());

  it('extracts id from /live/:id', () => {
    renderAt(`/live/${TID_A}`);
    expect(usePlaylistTracksMock).toHaveBeenCalledWith(TID_A);
  });

  it('extracts id from /standings/:id', () => {
    renderAt(`/standings/${TID_B}`);
    expect(usePlaylistTracksMock).toHaveBeenCalledWith(TID_B);
  });

  it('extracts id from /doubles/:id', () => {
    renderAt(`/doubles/${TID_C}`);
    expect(usePlaylistTracksMock).toHaveBeenCalledWith(TID_C);
  });

  it('extracts id from /groups/:id', () => {
    renderAt(`/groups/${TID_D}`);
    expect(usePlaylistTracksMock).toHaveBeenCalledWith(TID_D);
  });

  it('returns null on unrelated routes', () => {
    renderAt('/');
    expect(usePlaylistTracksMock).toHaveBeenCalledWith(null);
  });

  it('updates id when navigating between tournaments', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={[`/live/${TID_A}`]}>
        <AudioPlayer />
      </MemoryRouter>
    );
    expect(usePlaylistTracksMock).toHaveBeenLastCalledWith(TID_A);

    rerender(
      <MemoryRouter initialEntries={[`/standings/${TID_B}`]}>
        <AudioPlayer />
      </MemoryRouter>
    );
    expect(usePlaylistTracksMock).toHaveBeenLastCalledWith(TID_B);
  });
});
