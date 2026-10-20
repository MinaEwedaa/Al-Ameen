import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  FileText,
  NotebookText,
  Printer,
  Share2,
  User,
  Wallet,
} from 'lucide-react';
import { useToast } from '../../../components/common/toast.context';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ROUTES } from '../../../core/constants/routes';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber, formatPercent } from '../../../utils/format';
import { getShiftReport } from '../services/shift-report.api';
import type { ShiftReportEvent, ShiftSummary } from '../types/shift-report.types';
import './ShiftReportPage.css';

const SHIFT_REPORT_QUERY_KEY = ['shift-report', 'summary'] as const;

type Translate = (key: string) => string;

/** DEV-only sample report, shown while the backend has no /shift-report endpoint. Texts follow the current language. */
function buildSampleSummary(t: Translate): ShiftSummary {
  const today = new Date();
  const startedAt = new Date(today);
  const endedAt = new Date(today);
  startedAt.setHours(7, 0, 0, 0);
  endedAt.setHours(15, 0, 0, 0);

  return {
    date: today.toISOString().slice(0, 10),
    checkedIn: 18,
    checkedOut: 8,
    tasksCompleted: 14,
    staffName: t('topbar.userName'),
    staffRole: t('reportPage.sample.role'),
    shiftName: t('reportPage.sample.shift'),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    performanceScore: 96,
    totalCollected: 24850,
    cashCollected: 7200,
    cardCollected: 9850,
    transferCollected: 7800,
    housekeepingTasks: 12,
    maintenanceTasks: 4,
    reservations: 9,
    guestRequests: 6,
    notes: t('reportPage.sample.notes'),
    events: [1, 2, 3, 4, 5].map((index) => ({
      id: `event-${index}`,
      title: t(`reportPage.sample.e${index}`),
      description: t(`reportPage.sample.e${index}d`),
      time: ['07:00', '08:25', '10:10', '12:40', '15:00'][index - 1],
    })),
  };
}

const locale = (language: Language) => (language === 'ar' ? 'ar-EG' : 'en-EG');

function formatAmount(value: number, language: Language): string {
  const amount = formatNumber(value, language);
  return language === 'ar' ? `${amount} ج.م` : `EGP ${amount}`;
}

function formatDay(value: string | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale(language), { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatClock(value: string | undefined, language: Language): string {
  if (!value) return '—';
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    return language === 'ar' ? value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]) : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale(language), { hour: 'numeric', minute: '2-digit' }).format(date);
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadShiftReport(summary: ShiftSummary, t: Translate): void {
  const rows = [
    [t('reportPage.csv.item'), t('reportPage.csv.value')],
    [t('reportPage.csv.date'), summary.date],
    [t('reportPage.csv.staff'), summary.staffName ?? ''],
    [t('reportPage.csv.shift'), summary.shiftName ?? ''],
    [t('reportPage.csv.checkIns'), summary.checkedIn],
    [t('reportPage.csv.checkOuts'), summary.checkedOut],
    [t('reportPage.csv.tasks'), summary.tasksCompleted],
    [t('reportPage.csv.total'), summary.totalCollected ?? 0],
    [t('reportPage.csv.cash'), summary.cashCollected ?? 0],
    [t('reportPage.csv.instapay'), summary.cardCollected ?? 0],
    [t('reportPage.csv.vodafone'), summary.transferCollected ?? 0],
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `shift-report-${summary.date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface ActivityMetric {
  label: string;
  value: number;
  maximum: number;
}

function ActivityBar({ label, value, maximum, language }: ActivityMetric & { language: Language }) {
  const percent = maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0;

  return (
    <div className="sr-activity-bar">
      <div className="sr-activity-bar__label">
        <span>{label}</span>
        <strong>{formatNumber(value, language)}</strong>
      </div>
      <div className="sr-activity-bar__track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ActivityTimeline({ events, language }: { events: ShiftReportEvent[]; language: Language }) {
  return (
    <ol className="sr-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <span className="sr-timeline__dot" />
          <div className="sr-timeline__body">
            <div className="sr-timeline__heading">
              <strong>{event.title}</strong>
              {event.time && <time>{formatClock(event.time, language)}</time>}
            </div>
            {event.description && <p>{event.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SectionHeading({ icon: Icon, title, subtitle, tone }: { icon: typeof Clock; title: string; subtitle: string; tone?: 'gold' }) {
  return (
    <div className="sr-card__heading">
      <span className={`sr-card__icon${tone ? ` sr-card__icon--${tone}` : ''}`}><Icon aria-hidden="true" /></span>
      <div><h2>{title}</h2><p>{subtitle}</p></div>
    </div>
  );
}

export function ShiftReportPage() {
  const outlet = useOutletContext<{ language?: Language } | undefined>();
  const language: Language = outlet?.language ?? 'ar';
  const t: Translate = (key) => getTranslation(language, key);
  const toast = useToast();
  const { data, isPending, isError } = useQuery({
    queryKey: SHIFT_REPORT_QUERY_KEY,
    queryFn: getShiftReport,
  });
  const sample = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false' ? buildSampleSummary(t) : undefined;
  const summary = data ? (sample ? { ...sample, ...data } : data) : sample;

  if (!summary && isPending) {
    return <div className="sr-state" role="status">{t('reportPage.loading')}</div>;
  }

  if (!summary && isError) {
    return <div className="sr-state sr-state--error" role="alert">{t('reportPage.loadError')}</div>;
  }

  if (!summary) return null;

  const { checkedIn, checkedOut, tasksCompleted } = summary;
  const totalCollected = summary.totalCollected ?? 0;
  const cashCollected = summary.cashCollected ?? 0;
  const cardCollected = summary.cardCollected ?? 0;
  const transferCollected = summary.transferCollected ?? 0;
  const events = summary.events ?? [];
  const activityMetrics: ActivityMetric[] = [
    { label: t('reportPage.activity.checkIns'), value: checkedIn, maximum: Math.max(checkedIn, checkedOut, 1) },
    { label: t('reportPage.activity.checkOuts'), value: checkedOut, maximum: Math.max(checkedIn, checkedOut, 1) },
    { label: t('reportPage.activity.housekeeping'), value: summary.housekeepingTasks ?? tasksCompleted, maximum: Math.max(tasksCompleted, 1) },
    { label: t('reportPage.activity.maintenance'), value: summary.maintenanceTasks ?? 0, maximum: Math.max(tasksCompleted, 1) },
    { label: t('reportPage.activity.reservations'), value: summary.reservations ?? 0, maximum: Math.max(checkedIn, 1) },
  ];
  const paymentTotal = cashCollected + cardCollected + transferCollected;
  const paymentShare = (amount: number) => (paymentTotal > 0 ? (amount / paymentTotal) * 100 : 0);
  const performanceScore = Math.max(0, Math.min(100, summary.performanceScore ?? 0));
  const scoreText = formatPercent(performanceScore, language);
  const formattedDate = formatDay(summary.date, language);
  const number = (value: number) => formatNumber(value, language);

  const handleShare = async () => {
    const shareText = t('reportPage.shareText')
      .replace('{date}', formattedDate)
      .replace('{total}', formatAmount(totalCollected, language));
    try {
      if (navigator.share) {
        await navigator.share({ title: t('reportPage.shareTitle'), text: shareText, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText} — ${window.location.href}`);
        toast.showToast(t('reportPage.linkCopied'), 'success');
      } else {
        toast.showToast(t('reportPage.shareUnavailable'), 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.showToast(t('reportPage.shareFailed'), 'error');
    }
  };

  return (
    <div className="feature-page shift-report-page">
      <header className="sr-header">
        <div className="sr-header__title">
          <img src="/al-amin-hotel-logo.png" alt={t('reportPage.logoAlt')} />
          <div>
            <span className="sr-eyebrow">{t('reportPage.eyebrow')}</span>
            <h1>{t('reportPage.title')}</h1>
            <p>{t('reportPage.description')}</p>
          </div>
        </div>
        <div className="sr-header__actions">
          <Button onClick={() => window.print()}><FileText aria-hidden="true" />{t('reportPage.pdf')}</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" />{t('reportPage.print')}</Button>
          <Button variant="secondary" onClick={() => downloadShiftReport(summary, t)}><Download aria-hidden="true" />{t('reportPage.export')}</Button>
          <Button variant="secondary" onClick={() => void handleShare()}><Share2 aria-hidden="true" />{t('reportPage.share')}</Button>
        </div>
      </header>

      <Card className="sr-meta" aria-label={t('reportPage.meta.label')}>
        <div><span>{t('reportPage.meta.staff')}</span><strong>{summary.staffName ?? '—'}</strong></div>
        <div><span>{t('reportPage.meta.role')}</span><strong>{summary.staffRole ?? '—'}</strong></div>
        <div><span>{t('reportPage.meta.shift')}</span><strong>{summary.shiftName ?? '—'}</strong></div>
        <div><span>{t('reportPage.meta.date')}</span><strong>{formattedDate}</strong></div>
        <div><span>{t('reportPage.meta.start')}</span><strong>{formatClock(summary.startedAt, language)}</strong></div>
        <div><span>{t('reportPage.meta.end')}</span><strong>{formatClock(summary.endedAt, language)}</strong></div>
      </Card>

      <section className="sr-highlight" aria-label={t('reportPage.highlight.label')}>
        <div className="sr-highlight__message">
          <span>{t('reportPage.highlight.eyebrow')}</span>
          <h2>{t('reportPage.highlight.title')}</h2>
          <p>{t('reportPage.highlight.message')}</p>
          <div className="sr-highlight__score">
            <span>{t('reportPage.highlight.score')}</span>
            <strong>{scoreText}</strong>
          </div>
        </div>
        <div className="sr-highlight__stats">
          <div><span>{t('reportPage.highlight.checkIns')}</span><strong>{number(checkedIn)}</strong></div>
          <div><span>{t('reportPage.highlight.checkOuts')}</span><strong>{number(checkedOut)}</strong></div>
          <div><span>{t('reportPage.highlight.tasks')}</span><strong>{number(tasksCompleted)}</strong></div>
          <div><span>{t('reportPage.highlight.requests')}</span><strong>{number(summary.guestRequests ?? 0)}</strong></div>
        </div>
      </section>

      <div className="sr-grid sr-grid--two">
        <Card className="sr-card">
          <SectionHeading icon={BarChart3} title={t('reportPage.activity.title')} subtitle={t('reportPage.activity.subtitle')} />
          <div className="sr-activity-list">
            {activityMetrics.map((metric) => <ActivityBar key={metric.label} {...metric} language={language} />)}
          </div>
        </Card>

        <Card className="sr-card sr-performance">
          <SectionHeading icon={Clock} title={t('reportPage.completion.title')} subtitle={t('reportPage.completion.subtitle')} />
          <div className="sr-performance__ring" style={{ '--sr-score': `${performanceScore}%` } as CSSProperties}>
            <div><strong>{scoreText}</strong><span>{t('reportPage.completion.score')}</span></div>
          </div>
          <div className="sr-performance__legend">
            <span><i className="sr-dot sr-dot--green" />{t('reportPage.completion.tasks')} <b>{number(tasksCompleted)}</b></span>
            <span><i className="sr-dot sr-dot--gold" />{t('reportPage.completion.requests')} <b>{number(summary.guestRequests ?? 0)}</b></span>
          </div>
        </Card>
      </div>

      <div className="sr-grid sr-grid--two">
        <Card className="sr-card">
          <SectionHeading icon={Wallet} tone="gold" title={t('reportPage.finance.title')} subtitle={t('reportPage.finance.subtitle')} />
          <div className="sr-finance-total">
            <span>{t('reportPage.finance.total')}</span>
            <strong>{formatAmount(totalCollected, language)}</strong>
          </div>
          <div className="sr-finance-breakdown">
            <div><span>{t('reportPage.finance.cash')}</span><strong>{formatAmount(cashCollected, language)}</strong></div>
            <div><span>{t('reportPage.finance.instapay')}</span><strong>{formatAmount(cardCollected, language)}</strong></div>
            <div><span>{t('reportPage.finance.vodafone')}</span><strong>{formatAmount(transferCollected, language)}</strong></div>
          </div>
          <div className="sr-payment-bar" aria-label={t('reportPage.finance.split')}>
            <span className="sr-payment-bar__cash" style={{ width: `${paymentShare(cashCollected)}%` }} />
            <span className="sr-payment-bar__card" style={{ width: `${paymentShare(cardCollected)}%` }} />
            <span className="sr-payment-bar__transfer" style={{ width: `${paymentShare(transferCollected)}%` }} />
          </div>
          <div className="sr-payment-legend">
            <span><i className="sr-dot sr-dot--green" />{t('reportPage.finance.cash')}</span>
            <span><i className="sr-dot sr-dot--gold" />{t('reportPage.finance.instapay')}</span>
            <span><i className="sr-dot sr-dot--sage" />{t('reportPage.finance.vodafone')}</span>
          </div>
        </Card>

        <Card className="sr-card">
          <SectionHeading icon={CalendarDays} tone="gold" title={t('reportPage.operations.title')} subtitle={t('reportPage.operations.subtitle')} />
          <div className="sr-operation-grid">
            <div><span className="sr-operation-tag sr-operation-tag--green">{t('reportPage.operations.done')}</span><strong>{number(tasksCompleted)}</strong><span>{t('reportPage.operations.tasks')}</span></div>
            <div><span className="sr-operation-tag sr-operation-tag--gold">{t('reportPage.operations.recorded')}</span><strong>{number(summary.reservations ?? 0)}</strong><span>{t('reportPage.operations.reservations')}</span></div>
            <div><span className="sr-operation-tag sr-operation-tag--rose">{t('reportPage.operations.followUp')}</span><strong>{number(summary.guestRequests ?? 0)}</strong><span>{t('reportPage.operations.requests')}</span></div>
            <div><span className="sr-operation-tag sr-operation-tag--info">{t('reportPage.operations.completed')}</span><strong>{number(checkedOut)}</strong><span>{t('reportPage.operations.checkOuts')}</span></div>
          </div>
        </Card>
      </div>

      <Card className="sr-card">
        <SectionHeading icon={NotebookText} title={t('reportPage.timeline.title')} subtitle={t('reportPage.timeline.subtitle')} />
        {events.length > 0 ? (
          <ActivityTimeline events={events} language={language} />
        ) : (
          <p className="sr-empty">{t('reportPage.timeline.empty')}</p>
        )}
      </Card>

      <div className="sr-grid sr-grid--two">
        <Card className="sr-card">
          <SectionHeading icon={User} tone="gold" title={t('reportPage.performance.title')} subtitle={t('reportPage.performance.subtitle')} />
          <div className="sr-performance-facts">
            <div><strong>{number(checkedIn + checkedOut)}</strong><span>{t('reportPage.performance.guests')}</span></div>
            <div><strong>{number(summary.housekeepingTasks ?? tasksCompleted)}</strong><span>{t('reportPage.performance.housekeeping')}</span></div>
            <div><strong>{number(summary.maintenanceTasks ?? 0)}</strong><span>{t('reportPage.performance.maintenance')}</span></div>
            <div><strong>{number(summary.reservations ?? 0)}</strong><span>{t('reportPage.performance.reservations')}</span></div>
          </div>
        </Card>
        <Card className="sr-card">
          <SectionHeading icon={NotebookText} tone="gold" title={t('reportPage.notes.title')} subtitle={t('reportPage.notes.subtitle')} />
          <p className="sr-notes">{summary.notes ?? t('reportPage.notes.empty')}</p>
        </Card>
      </div>

      <footer className="sr-footer">
        <Link className="ui-button ui-button--secondary" to={ROUTES.dashboard}>{t('reportPage.back')}</Link>
        <div>
          <span className="sr-footer__date">{formatDay(summary.endedAt ?? summary.date, language)} · {formatClock(summary.endedAt, language)}</span>
          <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" />{t('reportPage.print')}</Button>
          <Button variant="secondary" onClick={() => void handleShare()}><Share2 aria-hidden="true" />{t('reportPage.share')}</Button>
          <Button onClick={() => window.print()}><FileText aria-hidden="true" />{t('reportPage.savePdf')}</Button>
        </div>
      </footer>
    </div>
  );
}
