import { Clock } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatCurrency, formatNumber } from '../../../utils/format';
import { RUN_STATUS_TONE, SHIFTS_I18N } from '../constants/shifts.constants';
import type { ShiftOverview } from '../types/shift.types';
import { formatShiftRange, handoverKey, pluralText } from '../utils/shiftDisplay';
import { ShiftInfoTile } from './ShiftInfoTile';
import './ShiftCard.css';

interface ShiftCardProps {
  shift: ShiftOverview;
  onReport: () => void;
  onDetails: () => void;
  onReview: (reportId: string) => void;
}

// One shift from GET /shifts/overview (image 4): header, 6 info tiles, handover status row and the two actions
export function ShiftCard({ shift, onReport, onDetails, onReview }: ShiftCardProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const isActive = shift.status === 'ACTIVE';
  const statusKey = handoverKey(shift);
  const tone = shift.report?.review_status === 'APPROVED' || !shift.report ? 'success' : shift.report.review_status === 'NEEDS_REVIEW' ? 'danger' : 'warning';

  return (
    <Card className={`shift-card${isActive ? ' shift-card--active' : ''}`} aria-label={t(`names.${shift.shift_type}`)}>
      <header className="shift-card__header">
        <Badge tone={RUN_STATUS_TONE[shift.status]} className="shift-card__status">{t(`runStatus.${shift.status}`)}</Badge>
        <div className="shift-card__title">
          <span>{t('shiftLabel')}</span>
          <h2>{t(`names.${shift.shift_type}`)}</h2>
          <small dir="auto">{formatShiftRange(shift.start_time, shift.end_time, language)}</small>
        </div>
        <span className="shift-card__icon" aria-hidden="true"><Clock /></span>
      </header>

      <div className="shift-card__grid">
        <ShiftInfoTile label={t('tiles.employee')}>{shift.staff?.full_name ?? t('noEmployee')}</ShiftInfoTile>
        <ShiftInfoTile label={t('tiles.rooms')}>{pluralText(t, 'units.rooms', shift.rooms_handled, language)}</ShiftInfoTile>
        <ShiftInfoTile label={t('tiles.revenue')}>{formatCurrency(shift.gross_revenue, language)}</ShiftInfoTile>
        <ShiftInfoTile label={t('tiles.cleaning')}>{pluralText(t, 'units.tasks', shift.cleaning_tasks, language)}</ShiftInfoTile>
        <ShiftInfoTile label={t('tiles.maintenance')}>{pluralText(t, 'units.reports', shift.maintenance_requests, language)}</ShiftInfoTile>
        <ShiftInfoTile label={t('tiles.pending')}>{formatNumber(shift.pending_items, language)}</ShiftInfoTile>
      </div>

      <div className="shift-card__handover">
        <span>{t('handoverStatus')}</span>
        <strong className={`shift-card__handover-value shift-card__handover-value--${tone}`}>{t(statusKey)}</strong>
      </div>

      <div className="shift-card__actions">
        <Button variant="secondary" onClick={onReport}>{t('viewReport')}</Button>
        {shift.report
          ? <Button onClick={() => onReview((shift.report as NonNullable<ShiftOverview['report']>).report_id)}>{t('reviewHandover')}</Button>
          : <Button onClick={onDetails}>{t('viewDetails')}</Button>}
      </div>
    </Card>
  );
}
