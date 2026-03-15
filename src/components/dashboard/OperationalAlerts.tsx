import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import type { Alert } from '@/lib/dashboardEngine';

const STYLES: Record<Alert['type'], { icon: typeof Info; bg: string; text: string; border: string }> = {
  info: { icon: Info, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  critical: { icon: AlertOctagon, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export default function OperationalAlerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Alertas do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Nenhum alerta no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Alertas do Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => {
          const s = STYLES[alert.type];
          const Icon = s.icon;
          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${s.bg} ${s.text} ${s.border}`}>
              <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{alert.message}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
