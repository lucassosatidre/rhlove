
-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'tarefa',
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  created_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task status history table
CREATE TABLE public.task_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Tasks policies: authenticated users can see tasks they created or were assigned to
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- Task comments policies
CREATE POLICY "Users can view task comments" ON public.task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_comments.task_id AND (tasks.created_by = auth.uid() OR tasks.assigned_to = auth.uid())));

CREATE POLICY "Users can insert task comments" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_comments.task_id AND (tasks.created_by = auth.uid() OR tasks.assigned_to = auth.uid())));

-- Task status history policies
CREATE POLICY "Users can view task status history" ON public.task_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_status_history.task_id AND (tasks.created_by = auth.uid() OR tasks.assigned_to = auth.uid())));

CREATE POLICY "Users can insert task status history" ON public.task_status_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Updated_at trigger for tasks
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
