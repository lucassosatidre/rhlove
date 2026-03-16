import { useState, useMemo } from 'react';
import { useDailySales } from '@/hooks/useDailySales';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useFreelancers } from '@/hooks/useFreelancers';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAvisosPrevios, computeAvisosAlerts } from '@/hooks/useAvisosPrevios';
import { Loader2 } from 'lucide-react';
import {
  getDateRange,
  getPreviousRange,
  computeOverview,
  computeSectorMetrics,
  computeEvolution,
  computeTeamDist,
  computeFreelancerSummary,
  computeAlerts,
  computeHealth,
  computeMonthlyTrends,
} from '@/lib/dashboardEngine';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import OverviewCards from '@/components/dashboard/OverviewCards';
import SectorProductivity from '@/components/dashboard/SectorProductivity';
import OperationEvolution from '@/components/dashboard/OperationEvolution';
import TeamDistribution from '@/components/dashboard/TeamDistribution';
import OperationalAlerts from '@/components/dashboard/OperationalAlerts';
import OperationHealth from '@/components/dashboard/OperationHealth';
import AdvisorInsights from '@/components/dashboard/AdvisorInsights';
import OperationalTrends from '@/components/dashboard/OperationalTrends';
import IndicatorLegend from '@/components/IndicatorLegend';

export default function Dashboard() {
  const [period, setPeriod] = useState('hoje');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { start, end } = useMemo(() => getDateRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const prev = useMemo(() => getPreviousRange(start, end), [start, end]);

  // Fetch all data - broad range for historical
  const { data: sales = [], isLoading: loadingSales } = useDailySales(start, end);
  const { data: prevSales = [] } = useDailySales(prev.start, prev.end);
  const { data: allSales = [] } = useDailySales(); // all historical
  const { data: collaborators = [], isLoading: loadingCollab } = useCollaborators();
  const { data: freelancers = [] } = useFreelancers(start, end);
  const { data: prevFreelancers = [] } = useFreelancers(prev.start, prev.end);
  const { data: allFreelancers = [] } = useFreelancers();
  const { data: scheduledVacations = [] } = useScheduledVacations();
  const { data: avisosPrevios = [] } = useAvisosPrevios();

  const loading = loadingSales || loadingCollab;

  const overview = useMemo(() =>
    computeOverview(sales, prevSales, collaborators, freelancers, prevFreelancers, scheduledVacations),
    [sales, prevSales, collaborators, freelancers, prevFreelancers, scheduledVacations]
  );

  const sectorMetrics = useMemo(() =>
    computeSectorMetrics(sales, collaborators, freelancers, scheduledVacations),
    [sales, collaborators, freelancers, scheduledVacations]
  );

  const evolution = useMemo(() =>
    computeEvolution(sales, collaborators, freelancers, scheduledVacations),
    [sales, collaborators, freelancers, scheduledVacations]
  );

  const today = new Date().toISOString().slice(0, 10);
  const teamDist = useMemo(() =>
    computeTeamDist(collaborators, freelancers, scheduledVacations, today),
    [collaborators, freelancers, scheduledVacations, today]
  );

  const flSummary = useMemo(() => computeFreelancerSummary(allFreelancers), [allFreelancers]);

  const baseAlerts = useMemo(() =>
    computeAlerts(collaborators, scheduledVacations, compensations, sales, freelancers),
    [collaborators, scheduledVacations, compensations, sales, freelancers]
  );

  const avisosAlerts = useMemo(() => computeAvisosAlerts(avisosPrevios), [avisosPrevios]);

  const alerts = useMemo(() => [...baseAlerts, ...avisosAlerts], [baseAlerts, avisosAlerts]);

  const health = useMemo(() =>
    computeHealth(sales, allSales, collaborators, freelancers, allFreelancers, scheduledVacations),
    [sales, allSales, collaborators, freelancers, allFreelancers, scheduledVacations]
  );

  const trends = useMemo(() =>
    computeMonthlyTrends(allSales, collaborators, allFreelancers, scheduledVacations),
    [allSales, collaborators, allFreelancers, scheduledVacations]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <DashboardHeader
        period={period}
        setPeriod={setPeriod}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
      />

      {/* Block 2: Overview */}
      <OverviewCards data={overview} />

      {/* Block 3 & 5: Sector + Team side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectorProductivity data={sectorMetrics} />
        <TeamDistribution data={teamDist} freelancerWeek={flSummary.week} freelancerMonth={flSummary.month} />
      </div>

      {/* Block 4: Evolution */}
      <OperationEvolution data={evolution} />

      {/* Block 6: Health */}
      <OperationHealth metrics={health} />

      {/* Block 7: HR Calendar + Alerts below */}
      <HRCalendar
        collaborators={collaborators}
        vacations={scheduledVacations}
        avisos={avisosPrevios}
        compensations={compensations}
      />
      <OperationalAlerts alerts={alerts} />

      {/* Block 9: AI Advisor */}
      <AdvisorInsights overview={overview} sectorMetrics={sectorMetrics} healthMetrics={health} />

      {/* Block 10: Trends */}
      <OperationalTrends data={trends} />

      {/* Legenda dos Indicadores */}
      <IndicatorLegend />
    </div>
  );
}
