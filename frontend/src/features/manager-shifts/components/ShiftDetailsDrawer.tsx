import { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { RUN_STATUS_TONE, SHIFTS_I18N } from '../constants/shifts.constants';
import { useShiftTeam } from '../hooks/useShifts';
import type { ShiftEntry, ShiftOverview } from '../types/shift.types';
import { formatShiftRange, handoverKey, pluralText } from '../utils/shiftDisplay';
import { ShiftInfoTile } from './ShiftInfoTile';
import './ShiftDrawers.css';

interface ShiftDetailsDrawerProps {
  shift: ShiftOverview | null;
  isCancelling: boolean;
  onCancelShift: (entry: ShiftEntry) => Promise<boolean>;
  onAssign: () => void;
  onClose: () => void;
}

// "عرض التفاصيل" before a report exists: who is on the shift today, and cancelling a scheduled duty
// (DELETE /shifts/{id}). Not in the design (smallest sensible drawer).
export function ShiftDetailsDrawer({ shift, isCancelling, onCancelShift, onAssign, onClose }: ShiftDetailsDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const teamQuery = useShiftTeam(shift?.shift_type ?? null);
  const [toCancel, setToCancel] = useState<ShiftEntry | null>(null);
  if (!shift) return null;

  const shiftName = t(`names.${shift.shift_type}`);
  const team = teamQuery.data ?? [];

  async function confirmCancel() {
    if (!toCancel) return;
    if (await onCancelShift(toCancel)) setToCancel(null);
  }

  return (
    <>
      <Drawer
        open
        eyebrow={t('detailsEyebrow')}
        title={t('detailsTitle').replace('{shift}', shiftName)}
        closeLabel={t('close')}
        onClose={toCancel ? () => setToCancel(null) : onClose}
        className="shift-drawer"
        footer={(
          <div className="shift-drawer__footer">
            <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
            <Button onClick={onAssign}>{t('manageAssignments')}</Button>
          </div>
        )}
      >
        <div className="shift-drawer__body">
          <div className="shift-drawer__grid">
            <ShiftInfoTile label={t('tiles.time')}>{formatShiftRange(shift.start_time, shift.end_time, language)}</ShiftInfoTile>
            <ShiftInfoTile label={t('tiles.runStatus')}>{t(`runStatus.${shift.status}`)}</ShiftInfoTile>
            <ShiftInfoTile label={t('tiles.employee')}>{shift.staff?.full_name ?? t('noEmployee')}</ShiftInfoTile>
            <ShiftInfoTile label={t('handoverStatus')}>{t(handoverKey(shift))}</ShiftInfoTile>
          </div>
          <section>
            <h3 className="shift-drawer__heading">
              {t('reportTeam')} · {pluralText(t, 'units.people', team.length, language)}
            </h3>
            {teamQuery.isPending ? (
              <p className="shift-drawer__muted">{t('loadingTeam')}</p>
            ) : team.length === 0 ? (
              <p className="shift-drawer__muted">{t('teamEmpty')}</p>
            ) : (
              <ul className="shift-drawer__team">
                {team.map((member) => (
                  <li key={member.shift_id}>
                    <span>{member.staff_name}</span>
                    <span className="shift-drawer__row-actions">
                      <Badge tone={RUN_STATUS_TONE[member.status]}>{t(`runStatus.${member.status}`)}</Badge>
                      {member.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          className="shift-drawer__icon-button"
                          aria-label={t('cancelShiftAria').replace('{name}', member.staff_name)}
                          disabled={isCancelling}
                          onClick={() => setToCancel(member)}
                        >
                          <CalendarX aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Drawer>

      {toCancel && (
        <ConfirmDialog
          icon={<CalendarX />}
          title={t('cancelShiftTitle').replace('{name}', toCancel.staff_name)}
          description={t('cancelShiftText').replace('{shift}', shiftName)}
          confirmLabel={t('cancelShift')}
          cancelLabel={t('cancel')}
          variant="danger"
          busy={isCancelling}
          onConfirm={() => { void confirmCancel(); }}
          onCancel={() => setToCancel(null)}
        />
      )}
    </>
  );
}
