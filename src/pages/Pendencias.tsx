import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import NewTaskDialog from '@/components/pendencias/NewTaskDialog';
import TaskCard from '@/components/pendencias/TaskCard';
import TaskDetailDialog from '@/components/pendencias/TaskDetailDialog';

export default function Pendencias() {
  const { usuario } = useAuth();
  const { receivedQuery, sentQuery } = useTasks();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pendências</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Pendência
        </Button>
      </div>

      <Tabs defaultValue="recebidas">
        <TabsList>
          <TabsTrigger value="recebidas">
            Recebidas {receivedQuery.data?.length ? `(${receivedQuery.data.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="enviadas">
            Enviadas {sentQuery.data?.length ? `(${sentQuery.data.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recebidas" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {receivedQuery.data?.map(task => (
              <TaskCard key={task.id} task={task} mode="received" onClick={() => setSelectedTask(task)} />
            ))}
            {receivedQuery.data?.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhuma pendência recebida.</p>}
          </div>
        </TabsContent>

        <TabsContent value="enviadas" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sentQuery.data?.map(task => (
              <TaskCard key={task.id} task={task} mode="sent" onClick={() => setSelectedTask(task)} />
            ))}
            {sentQuery.data?.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhuma pendência enviada.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} />

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
