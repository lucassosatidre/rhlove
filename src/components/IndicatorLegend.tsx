import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const INDICATOR_DEFINITIONS = [
  { sigla: 'PCS', desc: 'Pedidos por colaborador do setor' },
  { sigla: 'TCS', desc: 'Ticket por colaborador do setor' },
  { sigla: 'PCT', desc: 'Pedidos por colaborador do time' },
  { sigla: 'TCT', desc: 'Ticket por colaborador do time' },
] as const;

const INDICATOR_MAP: Record<string, string> = Object.fromEntries(
  INDICATOR_DEFINITIONS.map(i => [i.sigla, i.desc])
);

/** Inline tooltip for a single indicator sigla */
export function IndicatorTooltip({ sigla, children }: { sigla: string; children?: React.ReactNode }) {
  const desc = INDICATOR_MAP[sigla];
  if (!desc) return <>{children ?? sigla}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground/40">
            {children ?? sigla}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          <strong>{sigla}</strong> — {desc}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Full legend card block — can be used on dashboards, print, etc. */
export default function IndicatorLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Legenda dos Indicadores</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {INDICATOR_DEFINITIONS.map(({ sigla, desc }) => (
          <div key={sigla} className="flex items-baseline gap-1.5 text-xs">
            <span className="font-bold text-foreground min-w-[30px]">{sigla}</span>
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
