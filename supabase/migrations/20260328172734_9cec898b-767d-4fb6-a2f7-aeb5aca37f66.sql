
-- Create demands table
CREATE TABLE public.demands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'tarefa',
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  sector TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  due_date DATE,
  photos TEXT[] NOT NULL DEFAULT '{}',
  item_name TEXT,
  stock_quantity TEXT,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create demand_comments table
CREATE TABLE public.demand_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create demand_status_history table
CREATE TABLE public.demand_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_status_history ENABLE ROW LEVEL SECURITY;

-- RLS for demands: creator or assignee can see
CREATE POLICY "Users can view demands" ON public.demands FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can insert demands" ON public.demands FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update demands" ON public.demands FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- Admins can see all demands
CREATE POLICY "Admins can view all demands" ON public.demands FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- RLS for demand_comments
CREATE POLICY "Users can view demand comments" ON public.demand_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.demands WHERE demands.id = demand_comments.demand_id AND (demands.created_by = auth.uid() OR demands.assigned_to = auth.uid())));

CREATE POLICY "Users can insert demand comments" ON public.demand_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.demands WHERE demands.id = demand_comments.demand_id AND (demands.created_by = auth.uid() OR demands.assigned_to = auth.uid())));

-- RLS for demand_status_history
CREATE POLICY "Users can view demand status history" ON public.demand_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.demands WHERE demands.id = demand_status_history.demand_id AND (demands.created_by = auth.uid() OR demands.assigned_to = auth.uid())));

CREATE POLICY "Users can insert demand status history" ON public.demand_status_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);
