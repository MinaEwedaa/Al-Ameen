import { BedDouble, Check, NotebookText, Sparkles, UserRound, Wrench } from 'lucide-react';
import { StatCard } from '../../../components/ui/StatCard';
import { getTranslation, type Language } from '../../../core/i18n';
import type { RoomStats } from '../types/room.types';
import './RoomsStatsRow.css';

interface RoomsStatsRowProps {
  stats: RoomStats;
  language: Language;
}

export function RoomsStatsRow({ stats, language }: RoomsStatsRowProps) {
  const t = (key: string) => getTranslation(language, key);
  const metrics = [
    { id: 'total', label: t('rooms.stats.total'), value: stats.total, tone: 'gold' as const, icon: <BedDouble aria-hidden="true" /> },
    { id: 'available', label: t('rooms.stats.available'), value: stats.available, tone: 'green' as const, icon: <Check aria-hidden="true" /> },
    { id: 'occupied', label: t('rooms.stats.occupied'), value: stats.occupied, tone: 'green' as const, icon: <UserRound aria-hidden="true" /> },
    { id: 'cleaning', label: t('rooms.stats.cleaning'), value: stats.cleaning, tone: 'amber' as const, icon: <Sparkles aria-hidden="true" /> },
    { id: 'maintenance', label: t('rooms.stats.maintenance'), value: stats.maintenance, tone: 'amber' as const, icon: <Wrench aria-hidden="true" /> },
    { id: 'vip', label: t('rooms.stats.vip'), value: stats.vip, tone: 'gold' as const, icon: <NotebookText aria-hidden="true" /> },
  ];

  return (
    <section className="rooms-stats-row" aria-label={t('rooms.stats.total')}>
      {metrics.map((metric) => (
        <StatCard key={metric.id} className="rooms-stats-row__card" label={metric.label} value={metric.value} icon={metric.icon} tone={metric.tone} />
      ))}
    </section>
  );
}
