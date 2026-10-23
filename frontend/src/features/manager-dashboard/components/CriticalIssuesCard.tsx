import { Wrench, Sparkles, Wallet, BedDouble } from 'lucide-react';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { Card } from '../../../components/ui/Card';
import type { CriticalIssueItem, CriticalIssueSeverity } from '../types/manager-dashboard.types';
import './CriticalIssuesCard.css';

export interface CriticalIssuesCardProps {
  issues: CriticalIssueItem[];
  className?: string;
  onSelectIssue?: (issue: CriticalIssueItem) => void;
}

function renderIssueIcon(icon: string) {
  switch (icon) {
    case 'wrench':
      return <Wrench size={18} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles size={18} aria-hidden="true" />;
    case 'wallet':
      return <Wallet size={18} aria-hidden="true" />;
    case 'bed':
    default:
      return <BedDouble size={18} aria-hidden="true" />;
  }
}

function getIconTone(severity: CriticalIssueSeverity) {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'amber';
    case 'followup':
      return 'gold';
    case 'medium':
    default:
      return 'neutral';
  }
}

export function CriticalIssuesCard({ issues, className = '', onSelectIssue }: CriticalIssuesCardProps) {
  const { language, t } = useLanguage();

  const countBadgeText =
    language === 'ar'
      ? `${formatNumber(issues.length, language)} عناصر`
      : `${issues.length} items`;

  return (
    <Card className={`critical-issues-card ${className}`.trim()}>
      <header className="critical-issues-card__header">
        <div className="critical-issues-card__title-group">
          <h3 className="critical-issues-card__title">
            {t('manager.dashboard.criticalIssuesCard.title')}
          </h3>
          <p className="critical-issues-card__subtitle">
            {t('manager.dashboard.criticalIssuesCard.subtitle')}
          </p>
        </div>
        <span className="critical-issues-card__badge">{countBadgeText}</span>
      </header>

      <ul className="critical-issues-card__list">
        {issues.map((issue) => {
          const tone = getIconTone(issue.severity);
          const severityLabel =
            t(`manager.dashboard.criticalIssuesCard.severities.${issue.severity}`) ||
            issue.severityLabel;

          return (
            <li
              key={issue.id}
              className="critical-issues-card__item"
              onClick={() => onSelectIssue?.(issue)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectIssue?.(issue);
                }
              }}
            >
              <div className="critical-issues-card__item-main">
                <div className={`critical-issues-card__icon-box critical-issues-card__icon-box--${tone}`}>
                  {renderIssueIcon(issue.icon)}
                </div>
                <span className="critical-issues-card__item-title">{issue.title}</span>
              </div>
              <span
                className={`critical-issues-card__severity-pill critical-issues-card__severity-pill--${issue.severity}`}
              >
                {severityLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
