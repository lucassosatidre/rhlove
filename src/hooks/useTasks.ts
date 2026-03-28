import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_by: string;
  assigned_to: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  created_at: string;
}

export function useTasks() {
  const { usuario } = useAuth();
  const qc = useQueryClient();

  // Unified query: all tasks where user is creator OR assignee
  const allTasksQuery = useQuery({
    queryKey: ['tasks', 'all', usuario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks' as any)
        .select('*')
        .or(`created_by.eq.${usuario!.id},assigned_to.eq.${usuario!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
    enabled: !!usuario,
  });

  // Keep legacy queries for backward compat (derived from allTasksQuery)
  const receivedQuery = {
    ...allTasksQuery,
    data: allTasksQuery.data?.filter(t => t.assigned_to === usuario?.id),
  };
  const sentQuery = {
    ...allTasksQuery,
    data: allTasksQuery.data?.filter(t => t.created_by === usuario?.id),
  };

  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      const { data, error } = await supabase
        .from('tasks' as any)
        .insert({ ...task, status: 'aberta' } as any)
        .select()
        .single();
      if (error) throw error;
      await supabase.from('task_status_history' as any).insert({
        task_id: (data as any).id,
        old_status: null,
        new_status: 'aberta',
        changed_by: task.created_by,
      } as any);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, oldStatus, newStatus, userId }: { taskId: string; oldStatus: string; newStatus: string; userId: string }) => {
      const { error } = await supabase
        .from('tasks' as any)
        .update({ status: newStatus } as any)
        .eq('id', taskId);
      if (error) throw error;
      await supabase.from('task_status_history' as any).insert({
        task_id: taskId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: userId,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return { allTasksQuery, receivedQuery, sentQuery, createTask, updateTaskStatus };
}

/** Count of received tasks with status 'aberta' for badge in nav */
export function useOpenReceivedTasksCount() {
  const { usuario } = useAuth();
  return useQuery({
    queryKey: ['tasks', 'open_received_count', usuario?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tasks' as any)
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', usuario!.id)
        .eq('status', 'aberta');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!usuario,
    refetchInterval: 30000,
  });
}

export function useTaskComments(taskId: string) {
  const qc = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ['task_comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments' as any)
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TaskComment[];
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async ({ userId, comment }: { userId: string; comment: string }) => {
      const { error } = await supabase
        .from('task_comments' as any)
        .insert({ task_id: taskId, user_id: userId, comment } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task_comments', taskId] });
    },
  });

  return { commentsQuery, addComment };
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: ['task_status_history', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history' as any)
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TaskStatusHistory[];
    },
    enabled: !!taskId,
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, collaborator_id' as any)
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}
