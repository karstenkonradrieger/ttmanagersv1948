import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Club {
  id: string;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  chairman: string;
  logo_url: string | null;
  phone: string;
  email: string;
  website: string;
}

export function useClubs() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClubs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, street, house_number, postal_code, city, chairman, logo_url, phone, email, website')
        .order('name');
      if (error) throw error;
      setClubs(data || []);
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const addClub = useCallback(async (name: string): Promise<Club | null> => {
    if (!user) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    // Check if already exists
    const existing = clubs.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .insert({ name: trimmed, created_by: user.id })
        .select('id, name, street, house_number, postal_code, city, chairman, logo_url, phone, email, website')
        .single();
      if (error) throw error;
      setClubs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (error: any) {
      if (error?.code === '23505') {
        // Unique constraint - reload to get latest
        await loadClubs();
        return clubs.find(c => c.name.toLowerCase() === trimmed.toLowerCase()) || null;
      }
      console.error('Error adding club:', error);
      toast.error('Fehler beim Hinzufügen des Vereins');
      return null;
    }
  }, [user, clubs, loadClubs]);

  const removeClub = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('clubs').delete().eq('id', id);
      if (error) throw error;
      setClubs(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error removing club:', error);
      toast.error('Fehler beim Entfernen des Vereins');
    }
  }, []);

  return { clubs, loading, addClub, removeClub, reload: loadClubs };
}
