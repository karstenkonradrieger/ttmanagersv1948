import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ClubPlayer {
  id: string;
  clubId: string;
  clubName?: string;
  name: string;
  gender: string;
  birthDate: string | null;
  ttr: number;
  postalCode: string;
  city: string;
  street: string;
  houseNumber: string;
  phone: string;
}

export function useClubPlayers() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<ClubPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlayers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('club_players')
        .select('*, clubs(name)')
        .order('name');
      if (error) throw error;
      setPlayers(
        (data || []).map((row: any) => ({
          id: row.id,
          clubId: row.club_id,
          clubName: row.clubs?.name || '',
          name: row.name,
          gender: row.gender || '',
          birthDate: row.birth_date,
          ttr: row.ttr,
          postalCode: row.postal_code || '',
          city: row.city || '',
          street: row.street || '',
          houseNumber: row.house_number || '',
          phone: row.phone || '',
        }))
      );
    } catch (error) {
      console.error('Error loading club players:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const addPlayer = useCallback(async (
    clubId: string,
    name: string,
    gender: string,
    birthDate: string | null,
    ttr: number,
    postalCode: string,
    city: string,
    street: string,
    houseNumber: string,
    phone: string,
  ): Promise<ClubPlayer | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('club_players')
        .insert({
          club_id: clubId,
          name,
          gender,
          birth_date: birthDate || null,
          ttr,
          postal_code: postalCode,
          city,
          street,
          house_number: houseNumber,
          phone,
          created_by: user.id,
        })
        .select('*, clubs(name)')
        .single();
      if (error) throw error;
      const mapped: ClubPlayer = {
        id: data.id,
        clubId: data.club_id,
        clubName: (data as any).clubs?.name || '',
        name: data.name,
        gender: data.gender || '',
        birthDate: data.birth_date,
        ttr: data.ttr,
        postalCode: data.postal_code || '',
        city: data.city || '',
        street: data.street || '',
        houseNumber: data.house_number || '',
        phone: data.phone || '',
      };
      setPlayers(prev => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name)));
      return mapped;
    } catch (error) {
      console.error('Error adding club player:', error);
      toast.error('Fehler beim Hinzufügen des Spielers');
      return null;
    }
  }, [user]);

  const updatePlayer = useCallback(async (id: string, updates: Partial<Omit<ClubPlayer, 'id' | 'clubId' | 'clubName'>>) => {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
      if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate || null;
      if (updates.ttr !== undefined) dbUpdates.ttr = updates.ttr;
      if (updates.postalCode !== undefined) dbUpdates.postal_code = updates.postalCode;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.street !== undefined) dbUpdates.street = updates.street;
      if (updates.houseNumber !== undefined) dbUpdates.house_number = updates.houseNumber;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

      const { error } = await supabase.from('club_players').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (error) {
      console.error('Error updating club player:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  }, []);

  const removePlayer = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('club_players').delete().eq('id', id);
      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error removing club player:', error);
      toast.error('Fehler beim Entfernen');
    }
  }, []);

  const getPlayersForClub = useCallback((clubId: string) => {
    return players.filter(p => p.clubId === clubId);
  }, [players]);

  return { players, loading, addPlayer, updatePlayer, removePlayer, getPlayersForClub, reload: loadPlayers };
}
