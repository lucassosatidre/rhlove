import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Collaborator, DayOfWeek } from '@/types/collaborator';

type CollaboratorInsert = Omit<Collaborator, 'id' | 'created_at' | 'updated_at'>;
type CollaboratorUpdate = Partial<CollaboratorInsert> & { id: string };

async function fetchCollaborators(): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .order('sector')
    .order('collaborator_name');
  if (error) throw error;
  return (data ?? []) as Collaborator[];
}

export function useCollaborators() {
  return useQuery({
    queryKey: ['collaborators'],
    queryFn: fetchCollaborators,
  });
}

export function useCreateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CollaboratorInsert) => {
      const { data, error } = await supabase.from('collaborators').insert(c).select().single();
      if (error) throw error;
      return data as Collaborator;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useUpdateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: CollaboratorUpdate) => {
      const { data, error } = await supabase.from('collaborators').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Collaborator;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useDeleteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useBulkInsertCollaborators() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CollaboratorInsert[]) => {
      const { error } = await supabase.from('collaborators').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}
