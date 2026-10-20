import { Card } from '../../../components/ui/Card';
import { getTranslation, type Language } from '../../../core/i18n';
import { PAYMENT_METHODS } from '../../../core/constants/paymentMethods';
import { toDayKey } from '../../../core/utils/date';
import { formatAmount, formatPaymentDate, formatShare } from '../utils/paymentsFormat';
import type { Payment } from '../types/payment.types';
import './PaymentsRevenueCard.css';

interface PaymentsRevenueCardProps {
  payments: Payment[];
  language: Language;
}

interface DayPoint {
  day: string;
  total: number;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 150;
const CHART_PAD = 14;

function totalOf(payments: Payment[], method?: string): number {
  return payments
    .filter((payment) => !method || payment.method === method)
    .reduce((sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0), 0);
}

/** Buckets amounts per calendar day (oldest → newest) for the revenue line. */
function buildDayPoints(payments: Payment[]): DayPoint[] {
  const buckets = new Map<string, number>();

  payments.forEach((payment) => {
    if (!payment.paidAt) return;
    const day = toDayKey(payment.paidAt);
    if (!day) return;
    buckets.set(day, (buckets.get(day) ?? 0) + (Number.isFinite(payment.amount) ? payment.amount : 0));
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day, total }));
}

function buildChartPaths(points: DayPoint[]) {
  const max = Math.max(...points.map((point) => point.total), 1);
  const innerWidth = CHART_WIDTH - CHART_PAD * 2;
  const innerHeight = CHART_HEIGHT - CHART_PAD * 2;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    x: CHART_PAD + index * stepX,
    y: CHART_HEIGHT - CHART_PAD - (point.total / max) * innerHeight,
  }));

  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(' ');

  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L ${last.x.toFixed(1)} ${CHART_HEIGHT - CHART_PAD / 2} L ${first.x.toFixed(1)} ${CHART_HEIGHT - CHART_PAD / 2} Z`;

  return { line, area, last };
}

// Totals on the start side, the revenue line on the end side (as in the prototype)
export function PaymentsRevenueCard({ payments, language }: PaymentsRevenueCardProps) {
  const t = (key: string) => getTranslation(language, key);
  const total = totalOf(payments);
  const cash = totalOf(payments, PAYMENT_METHODS.cash);
  const wallets = totalOf(payments, PAYMENT_METHODS.card) + totalOf(payments, PAYMENT_METHODS.transfer);
  const share = (value: number) => (total > 0 ? value / total : 0);

  const points = buildDayPoints(payments);
  const chart = points.length > 0 ? buildChartPaths(points) : null;
  const dayLabel = (index: number) => formatPaymentDate(`${points[index].day}T12:00:00Z`, language);

  return (
    <Card className="payments-revenue" aria-label={t('paymentsPage.revenue.label')}>
      <div className="payments-revenue__panel">
        <span className="payments-revenue__label">{t('paymentsPage.revenue.label')}</span>
        <strong className="payments-revenue__total">{formatAmount(total, language)}</strong>
        <p className="payments-revenue__hint">{t('paymentsPage.revenue.hint')}</p>
        <div className="payments-revenue__legend">
          <span><i className="payments-revenue__dot" />{t('paymentsPage.revenue.cash')} · {formatShare(share(cash), language)}</span>
          <span><i className="payments-revenue__dot payments-revenue__dot--gold" />{t('paymentsPage.revenue.wallets')} · {formatShare(share(wallets), language)}</span>
        </div>
      </div>

      <div className="payments-revenue__chart">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={t('paymentsPage.revenue.chartLabel')}>
          <defs>
            <linearGradient id="payments-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {chart ? (
            <>
              <path d={chart.area} fill="url(#payments-revenue-fill)" />
              <path d={chart.line} fill="none" style={{ stroke: 'var(--color-primary)' }} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={chart.last.x} cy={chart.last.y} r="4.5" style={{ fill: 'var(--color-primary)', stroke: 'var(--color-surface)' }} strokeWidth="2" />
            </>
          ) : (
            <path
              d={`M ${CHART_PAD} ${CHART_HEIGHT / 2} L ${CHART_WIDTH - CHART_PAD} ${CHART_HEIGHT / 2}`}
              style={{ stroke: 'var(--color-border)' }}
              strokeWidth="2"
              strokeDasharray="6 7"
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="payments-revenue__axis">
          <span>{points.length > 0 ? dayLabel(0) : '—'}</span>
          <span>{points.length > 2 ? dayLabel(Math.floor(points.length / 2)) : ''}</span>
          <span>{points.length > 1 ? dayLabel(points.length - 1) : ''}</span>
        </div>
      </div>
    </Card>
  );
}
