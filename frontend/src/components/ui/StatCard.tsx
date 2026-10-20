import type { ReactNode } from 'react';
import { Card } from './Card';
import { useLanguage } from '../../core/i18n/useLanguage';
import { formatNumber } from '../../utils/format';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'teal' | 'blue' | 'amber' | 'rose' | 'neutral' | 'green' | 'gold';
  /** Optional small line under the value (e.g. "11 completed") */
  hint?: string;
  className?: string;
}

// One stat card for every page: icon at the start, small label above a large value.
export function StatCard({ label, value, icon, tone = 'teal', hint, className = '' }: StatCardProps) {
  // Read the language from the shared provider so the digits switch together with the rest of the page
  const { language } = useLanguage();
  const displayValue = typeof value === 'number'
    ? formatNumber(value, language)
    : /^\d+(?:\.\d+)?$/.test(value)
      ? formatNumber(Number(value), language)
      : value;

  return (
    <Card className={`ui-stat-card ui-stat-card--${tone} ${className}`.trim()}>
      <span className="ui-stat-card__icon" aria-hidden="true">{icon}</span>
      <div className="ui-stat-card__body">
        <span className="ui-stat-card__label">{label}</span>
        <strong className="ui-stat-card__value">{displayValue}</strong>
        {hint && <span className="ui-stat-card__hint">{hint}</span>}
      </div>
    </Card>
  );
}
