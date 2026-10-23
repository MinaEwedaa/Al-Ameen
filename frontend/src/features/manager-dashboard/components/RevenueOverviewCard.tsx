import { useLanguage } from '../../../core/i18n/useLanguage';
import type { Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { Card } from '../../../components/ui/Card';
import { AreaLineChart } from '../../../components/common/AreaLineChart';
import type { RevenueOverview } from '../types/manager-dashboard.types';
import './RevenueOverviewCard.css';

export interface RevenueOverviewCardProps {
  data: RevenueOverview;
  className?: string;
}

const DAYS_TRANSLATION_MAP: Record<string, string> = {
  'السبت': 'Sat',
  'الأحد': 'Sun',
  'الاثنين': 'Mon',
  'الإثنين': 'Mon',
  'الثلاثاء': 'Tue',
  'الأربعاء': 'Wed',
  'الخميس': 'Thu',
  'الجمعة': 'Fri',
};

function formatRevenueTile(value: number, language: Language): string {
  if (value >= 1_000_000) {
    const m = (value / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return language === 'ar' ? `${formatNumber(Number(m), language, 1)} مليون` : `${m}M`;
  }
  if (value >= 1_000) {
    const k = (value / 1_000).toFixed(1).replace(/\.0$/, '');
    return language === 'ar' ? `${formatNumber(Number(k), language, 1)} ألف` : `${k}k`;
  }
  return formatNumber(value, language);
}

export function RevenueOverviewCard({ data, className = '' }: RevenueOverviewCardProps) {
  const { language, t } = useLanguage();

  const chartLabels =
    language === 'en'
      ? data.chartSeries.labels.map((lbl) => DAYS_TRANSLATION_MAP[lbl] ?? lbl)
      : data.chartSeries.labels;

  return (
    <Card className={`revenue-overview-card ${className}`.trim()}>
      <header className="revenue-overview-card__header">
        <div className="revenue-overview-card__title-group">
          <h3 className="revenue-overview-card__title">
            {t('manager.dashboard.revenueCard.title')}
          </h3>
          <p className="revenue-overview-card__subtitle">
            {t('manager.dashboard.revenueCard.subtitle')}
          </p>
        </div>
        <span className="revenue-overview-card__badge">
          {t('manager.dashboard.revenueCard.changeBadge')}
        </span>
      </header>

      {/* 4 mini stat tiles in 2x2 grid */}
      <div className="revenue-overview-card__tiles">
        <div className="revenue-overview-card__tile">
          <span className="revenue-overview-card__tile-label">
            {t('manager.dashboard.revenueCard.today')}
          </span>
          <span className="revenue-overview-card__tile-value">
            {formatRevenueTile(data.today, language)}
          </span>
        </div>
        <div className="revenue-overview-card__tile">
          <span className="revenue-overview-card__tile-label">
            {t('manager.dashboard.revenueCard.week')}
          </span>
          <span className="revenue-overview-card__tile-value">
            {formatRevenueTile(data.week, language)}
          </span>
        </div>
        <div className="revenue-overview-card__tile">
          <span className="revenue-overview-card__tile-label">
            {t('manager.dashboard.revenueCard.month')}
          </span>
          <span className="revenue-overview-card__tile-value">
            {formatRevenueTile(data.month, language)}
          </span>
        </div>
        <div className="revenue-overview-card__tile">
          <span className="revenue-overview-card__tile-label">
            {t('manager.dashboard.revenueCard.year')}
          </span>
          <span className="revenue-overview-card__tile-value">
            {formatRevenueTile(data.year, language)}
          </span>
        </div>
      </div>

      {/* Area Line Chart */}
      <div className="revenue-overview-card__chart-wrapper">
        <AreaLineChart
          points={data.chartSeries.points}
          labels={chartLabels}
          height={160}
          ariaLabel={t('manager.dashboard.revenueCard.chartAriaLabel')}
        />
      </div>

      {/* Payment methods breakdown legend */}
      <div className="revenue-overview-card__legend">
        {data.paymentMethods.map((method) => {
          const methodName =
            method.id === 'cash'
              ? t('manager.dashboard.revenueCard.cash')
              : method.id === 'instapay'
              ? t('manager.dashboard.revenueCard.instapay')
              : method.id === 'vodafone' || method.id === 'vodafone_cash'
              ? t('manager.dashboard.revenueCard.vodafoneCash')
              : method.id === 'card'
              ? (language === 'ar' ? 'بطاقة بنكية' : 'Card')
              : method.name;

          return (
            <div key={method.id} className="revenue-overview-card__legend-item">
              <div className="revenue-overview-card__legend-header">
                <i
                  className={`revenue-overview-card__legend-dot revenue-overview-card__legend-dot--${method.tone}`}
                  aria-hidden="true"
                />
                <span className="revenue-overview-card__legend-name">{methodName}</span>
              </div>
              <span className="revenue-overview-card__legend-percent">
                {formatNumber(method.percent, language)}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
