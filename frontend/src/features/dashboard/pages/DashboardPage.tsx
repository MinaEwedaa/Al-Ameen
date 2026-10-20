import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, ChevronLeft, ChevronRight, ArrowUpRight, BedDouble, Check, CircleAlert, Clock, FileText, LogIn, MoreHorizontal, Sparkles, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatCurrency, formatNumber, formatPercent } from '../../../utils/format';
import { getDashboardSummary } from '../services/dashboard.api';
import type { DashboardIconKey, RevenuePoint } from '../types/dashboard.types';
import { ROUTES } from '../../../core/constants/routes';
import { getAuthSession } from '../../../core/auth/authManager';
import { computeShiftProgress, useCurrentShift } from '../../shift-handover/services/currentShift';
import './DashboardPage.css';

const iconMap: Record<DashboardIconKey, LucideIcon> = {
  bed: BedDouble,
  sparkles: Sparkles,
  wrench: Wrench,
  wallet: Wallet,
  login: LogIn,
  transfer: ArrowLeftRight,
  check: Check,
  clock: Clock,
  file: FileText,
};

function DashboardIcon({ name, className = '' }: { name: DashboardIconKey; className?: string }) {
  const Icon = iconMap[name];
  return <Icon className={className} aria-hidden="true" strokeWidth={1.7} />;
}

function translation(language: Language, key: string): string {
  return getTranslation(language, key);
}

function makeRevenuePath(points: RevenuePoint[], closeArea = false): string {
  if (points.length === 0) return '';

  const max = Math.max(...points.map((point) => point.value), 1);
  const coords = points.map((point, index) => ({
    x: 16 + (index * 288) / Math.max(points.length - 1, 1),
    y: 94 - (point.value / max) * 68,
  }));
  let path = `M ${coords[0].x} ${coords[0].y}`;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index];
    const next = coords[index + 1];
    const distance = (next.x - current.x) / 3;
    path += ` C ${current.x + distance} ${current.y}, ${next.x - distance} ${next.y}, ${next.x} ${next.y}`;
  }

  if (closeArea) {
    path += ` L ${coords[coords.length - 1].x} 104 L ${coords[0].x} 104 Z`;
  }

  return path;
}

function RevenueChart({ values, language }: { values: RevenuePoint[]; language: Language }) {
  const linePath = makeRevenuePath(values);
  const areaPath = makeRevenuePath(values, true);

  return (
    <div className="dashboard-page__chart-wrap">
      <svg className="dashboard-page__chart" viewBox="0 0 320 112" role="img" aria-label={translation(language, 'dashboard.revenue.chartLabel')}>
        {[28, 53, 78, 103].map((y) => <line key={y} x1="12" x2="308" y1={y} y2={y} className="dashboard-page__chart-gridline" />)}
        <path d={areaPath} className="dashboard-page__chart-area" />
        <path d={linePath} className="dashboard-page__chart-line" />
        {values.length > 0 && <circle cx="304" cy={94 - (values[values.length - 1].value / Math.max(...values.map((point) => point.value), 1)) * 68} r="3.5" className="dashboard-page__chart-point" />}
      </svg>
      <div className="dashboard-page__chart-axis">
        {values.map((point) => <span key={point.dayKey}>{translation(language, `dashboard.revenue.days.${point.dayKey}`)}</span>)}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { language } = useOutletContext<{ language: Language }>();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    staleTime: 0,
  });
  const t = (key: string) => translation(language, key);
  const { data: currentShift } = useCurrentShift();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const staffName = getAuthSession()?.staffName || '';
  const cairoHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const greeting = language === 'ar'
    ? (cairoHour >= 5 && cairoHour < 12 ? 'صباح الخير' : cairoHour >= 12 && cairoHour < 18 ? 'مساء الخير' : 'مساء الخير')
    : (cairoHour >= 5 && cairoHour < 12 ? 'Good morning' : cairoHour >= 12 && cairoHour < 18 ? 'Good afternoon' : 'Good evening');
  const heroName = staffName
    ? (language === 'ar' ? `مرحبًا بعودتك يا ${staffName}.` : `Welcome back, ${staffName}.`)
    : t('dashboard.heroTitle');
  const progress = currentShift ? computeShiftProgress(currentShift, now) : null;
  const shiftName = currentShift ? t(`handoverPage.shiftType.${currentShift.shift_type}`) : t('handoverPage.info.shift');
  const shiftFoot = !currentShift || !progress
    ? '—'
    : progress.ended
      ? `${currentShift.start_time} — ${currentShift.end_time}`
      : t('sidebar.shiftEnds')
          .replace('{hours}', formatNumber(progress.remainingHours, language))
          .replace('{minutes}', formatNumber(progress.remainingMinutes, language));

  if (isPending) return <LoadingState label={t('loading')} />;
  if (isError || !data) return <ErrorState title={t('dashboard.loadError')} message={getErrorMessage(error, language)} />;
  if (data.stats.length === 0) return <EmptyState title={t('dashboard.empty')} />;

  return (
    <div className="feature-page dashboard-page">
      <section className="dashboard-page__hero">
        <div className="dashboard-page__hero-copy">
          <span className="dashboard-page__eyebrow">{greeting}</span>
          <h1>{heroName}</h1>
          <p>{t('dashboard.heroDescription')}</p>
        </div>
        <div className="dashboard-page__hero-shift">
          <div className="dashboard-page__hero-shift-heading">
            <div>
              <span>{t('dashboard.shiftProgress')}</span>
              <strong>{shiftName}</strong>
            </div>
            <Clock aria-hidden="true" />
          </div>
          <div className="dashboard-page__hero-progress"><span style={{ width: `${progress?.progressPercent ?? 0}%` }} /></div>
          <div className="dashboard-page__hero-shift-foot">
            <span>{shiftFoot}</span>
            <span>{formatNumber(progress?.progressPercent ?? 0, language)}%</span>
          </div>
        </div>
      </section>

      <section className="dashboard-page__overview" aria-labelledby="dashboard-overview-title">
        <div className="dashboard-page__section-heading">
          <div>
            <h2 id="dashboard-overview-title">{t('dashboard.overviewTitle')}</h2>
            <p>{t('dashboard.overviewCaption')}</p>
          </div>
          <Link className="dashboard-page__text-link" to={ROUTES.shiftReport}>
            {t('dashboard.viewSummary')}<ArrowLeft aria-hidden="true" />
          </Link>
        </div>

        <div className="dashboard-page__stat-grid">
          {data.stats.map((stat) => (
            <Card className={`dashboard-page__stat-card dashboard-page__stat-card--${stat.tone}`} key={stat.id}>
              <span className="dashboard-page__stat-icon"><DashboardIcon name={stat.icon} /></span>
              <div className="dashboard-page__stat-value-row">
                <strong>{stat.format === 'currency' ? formatCurrency(stat.value, language) : formatNumber(stat.value, language)}</strong>
                <span className={`dashboard-page__stat-marker dashboard-page__stat-marker--${stat.marker}`} aria-label={t(`dashboard.stats.${stat.marker}`)}>
                  {stat.marker === 'warning' ? <CircleAlert aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                </span>
              </div>
              <span className="dashboard-page__stat-label">{t(stat.labelKey)}</span>
              <span className="dashboard-page__stat-caption">{t(stat.captionKey)}</span>
            </Card>
          ))}
        </div>
      </section>

      <section className="dashboard-page__content-grid" aria-label={t('dashboard.overviewTitle')}>
        <Card className="dashboard-page__panel dashboard-page__revenue-panel">
          <div className="dashboard-page__panel-heading">
            <div>
              <h2>{t('dashboard.revenue.title')}</h2>
              <p>{t('dashboard.revenue.caption')}</p>
            </div>
            <span className="dashboard-page__trend">{t('dashboard.revenue.change').replace('{value}', formatPercent(data.revenueChangePercent, language))}</span>
          </div>
          <strong className="dashboard-page__revenue-total">{formatCurrency(data.revenueTotal, language)}</strong>
          <RevenueChart values={data.revenue} language={language} />
          <div className="dashboard-page__legend">
            <span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--primary" />{t('dashboard.revenue.cash')} <strong>{formatCurrency(data.cashRevenue, language)}</strong></span>
            <span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--gold" />{t('dashboard.revenue.digital')} <strong>{formatCurrency(data.digitalRevenue, language)}</strong></span>
          </div>
        </Card>

        <Card className="dashboard-page__panel dashboard-page__activity-panel">
          <div className="dashboard-page__panel-heading">
            <div>
              <h2>{t('dashboard.activity.title')}</h2>
              <p>{t('dashboard.activity.caption')}</p>
            </div>
            <MoreHorizontal className="dashboard-page__more" aria-hidden="true" />
          </div>
          <ul className="dashboard-page__activity-list">
            {data.activity.map((activity) => (
              <li key={activity.id}>
                <span className={`dashboard-page__activity-icon dashboard-page__activity-icon--${activity.tone}`}><DashboardIcon name={activity.icon} /></span>
                <div className="dashboard-page__activity-copy">
                  <strong>{t(activity.titleKey)}</strong>
                  <span>{t(activity.descriptionKey)}</span>
                </div>
                <time>{t('dashboard.activity.agoMinutes').replace('{value}', formatNumber(activity.timeMinutesAgo, language))}</time>
              </li>
            ))}
          </ul>
          <Link className="dashboard-page__view-all" to={ROUTES.shiftReport}>{t('dashboard.activity.viewAll')}<ArrowLeft aria-hidden="true" /></Link>
        </Card>
      </section>

      <section className="dashboard-page__content-grid dashboard-page__actions-grid">
        <Card className="dashboard-page__panel dashboard-page__quick-panel">
          <div className="dashboard-page__panel-heading">
            <div><h2>{t('dashboard.quickActions.title')}</h2><p>{t('dashboard.quickActions.caption')}</p></div>
          </div>
          <div className="dashboard-page__quick-actions">
            {data.quickActions.map((action) => (
              <Link className={`dashboard-page__quick-action${action.primary ? ' dashboard-page__quick-action--primary' : ''}`} key={action.id} to={action.route}>
                <span><DashboardIcon name={action.icon} /></span>
                <strong>{t(action.labelKey)}</strong>
                <ArrowLeft className="dashboard-page__quick-chevron" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="dashboard-page__panel dashboard-page__attention-panel">
          <div className="dashboard-page__panel-heading">
            <div><h2>{t('dashboard.attention.title')}</h2><p>{t('dashboard.attention.caption')}</p></div>
            <span className="dashboard-page__open-pill">{t('dashboard.attention.openCount')}</span>
          </div>
          <ul className="dashboard-page__attention-list">
            {data.needsAttention.map((item) => (
              <li className={`dashboard-page__attention-item dashboard-page__attention-item--${item.severity}`} key={item.id}>
                <div><strong>{t(item.titleKey)}</strong><span>{t(item.detailKey)}</span></div>
                <span className="dashboard-page__attention-icon"><DashboardIcon name={item.icon} /></span>
              </li>
            ))}
          </ul>
          <div className="dashboard-page__attention-legend">
            <strong>{t('dashboard.attention.legend')}</strong>
            <span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--danger" />{t('dashboard.attention.critical')}</span>
            <span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--amber" />{t('dashboard.attention.high')}</span>
            <span><i className="dashboard-page__legend-dot dashboard-page__legend-dot--gold" />{t('dashboard.attention.normal')}</span>
            <span><Wrench aria-hidden="true" />{t('dashboard.attention.maintenance')}</span>
            <span><Sparkles aria-hidden="true" />{t('dashboard.attention.housekeeping')}</span>
          </div>
        </Card>
      </section>

      <footer className="dashboard-page__pulse">
        <div className="dashboard-page__pulse-copy"><span>{t('dashboard.pulse.title')}</span><strong>{t('dashboard.pulse.headline')}</strong><p>{t('dashboard.pulse.message')}</p></div>
        <div className="dashboard-page__pulse-metrics">
          <div><span>{t('dashboard.pulse.arrivals')}</span><strong>{formatNumber(data.pulse.arrivals, language)}</strong></div>
          <div><span>{t('dashboard.pulse.completed')}</span><strong>{formatNumber(data.pulse.completedTasks, language)}</strong></div>
          <div><span>{t('dashboard.pulse.pending')}</span><strong>{formatNumber(data.pulse.pendingTasks, language)}</strong></div>
          <div><span>{t('dashboard.pulse.revenue')}</span><strong>{formatCurrency(data.pulse.revenue, language)}</strong></div>
        </div>
        <Link className="ui-button ui-button--gold dashboard-page__pulse-action" to={ROUTES.shiftReport}>
          {t('dashboard.pulse.openSummary')}
          {language === 'ar' ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </Link>
      </footer>
    </div>
  );
}
