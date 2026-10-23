import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Select } from '../../../components/ui/Select';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { ROSTER_STAFF_TYPES, SHIFT_ORDER, SHIFTS_I18N } from '../constants/shifts.constants';
import { EMPTY_ASSIGNMENT, validateAssignment } from '../schemas/assignment.schema';
import type { AssignmentFormErrors, AssignmentFormValues } from '../schemas/assignment.schema';
import type { Assignee, ShiftType } from '../types/shift.types';
import { apiErrorText, pluralText } from '../utils/shiftDisplay';
import { ShiftInfoTile } from './ShiftInfoTile';
import './ShiftDrawers.css';

const FORM_ID = 'manager-shift-assignment-form';

interface AssignmentsDrawerProps {
  open: boolean;
  assignees: Assignee[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isSaving: boolean;
  onClose: () => void;
  /** Resolves true when the move was saved */
  onMove: (assignee: Assignee, shift: ShiftType) => Promise<boolean>;
}

// "إدارة التعيينات": put an employee on today's shift or move a scheduled one (POST / PATCH /shifts).
// A shift that already started can't be changed (SHIFT_ALREADY_STARTED). Not in the design.
export function AssignmentsDrawer({ open, assignees, isLoading, error, onRetry, isSaving, onClose, onMove }: AssignmentsDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const [values, setValues] = useState<AssignmentFormValues>(EMPTY_ASSIGNMENT);
  const [errors, setErrors] = useState<AssignmentFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const roster = assignees.filter((item) => ROSTER_STAFF_TYPES.includes(item.staff_type));
  const isLocked = (item: Assignee) => Boolean(item.today_shift && item.today_shift.status !== 'SCHEDULED');
  // Only people who can still be moved are offered, and never the shift they are already on
  const movable = roster.filter((item) => !isLocked(item));
  const selected = roster.find((item) => item.staff_id === values.staffId) ?? null;
  const targetShifts = SHIFT_ORDER.filter((id) => id !== selected?.today_shift?.shift_type);
  const shiftLabel = (assignee: Assignee | null) => {
    if (!assignee?.today_shift) return t('unassigned');
    const name = t(`names.${assignee.today_shift.shift_type}`);
    return assignee.today_shift.status === 'SCHEDULED' ? name : `${name} · ${t(`runStatus.${assignee.today_shift.status}`)}`;
  };

  const setField = <K extends keyof AssignmentFormValues>(field: K, value: AssignmentFormValues[K]) => {
    const next = { ...values, [field]: value };
    // A newly picked employee may already be on the chosen target shift: clear it instead of showing a hidden value
    if (field === 'staffId' && next.shift && roster.find((item) => item.staff_id === value)?.today_shift?.shift_type === next.shift) next.shift = '';
    setValues(next);
    if (submitted) setErrors(validateAssignment(next, roster));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setSubmitted(true);
    const nextErrors = validateAssignment(values, roster);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !selected || !values.shift) return;
    void onMove(selected, values.shift).then((saved) => {
      if (!saved) return;
      // Ready for the next move
      setValues(EMPTY_ASSIGNMENT);
      setErrors({});
      setSubmitted(false);
    });
  };

  const groups: Array<{ id: ShiftType | null; members: Assignee[] }> = [
    ...SHIFT_ORDER.map((id) => ({ id, members: roster.filter((item) => item.today_shift?.shift_type === id) })),
    { id: null, members: roster.filter((item) => !item.today_shift) },
  ];

  let content;
  if (isLoading) content = <LoadingState label={t('loadingTeam')} />;
  else if (error) {
    content = (
      <ErrorState
        title={t('teamLoadError')}
        message={apiErrorText(error, t, language)}
        action={<Button variant="secondary" onClick={onRetry}>{t('retry')}</Button>}
      />
    );
  } else {
    content = (
      <div className="shift-drawer__body">
        <p className="shift-drawer__muted">{t('assignHint')}</p>
        <form id={FORM_ID} className="shift-assign" onSubmit={handleSubmit} noValidate>
          <Select
            label={t('assignEmployee')}
            value={values.staffId}
            placeholder={t('assignEmployeePlaceholder')}
            options={movable.map((item) => ({
              value: item.staff_id,
              label: `${item.full_name} · ${t(`roles.${item.staff_type}`)}`,
            }))}
            onChange={(next) => setField('staffId', next)}
            error={errors.staffId ? t(`errors.${errors.staffId}`) : undefined}
            disabled={isSaving}
          />
          <div className="shift-assign__row">
            <ShiftInfoTile label={t('assignCurrent')}>{selected ? shiftLabel(selected) : '—'}</ShiftInfoTile>
            <Select
              label={t('assignTarget')}
              value={values.shift}
              placeholder={t('assignTargetPlaceholder')}
              options={targetShifts.map((id) => ({ value: id, label: t(`names.${id}`) }))}
              onChange={(next) => setField('shift', next as ShiftType)}
              error={errors.shift ? t(`errors.${errors.shift}`) : undefined}
              disabled={isSaving}
            />
          </div>
        </form>

        <section>
          <h3 className="shift-drawer__heading">{t('assignTeams')}</h3>
          <div className="shift-assign__groups">
            {groups.map((group) => (
              <div key={group.id ?? 'none'} className={`shift-assign__group${group.id === null ? ' shift-assign__group--pending' : ''}`}>
                <header>
                  <strong>{group.id ? t(`names.${group.id}`) : t('unassigned')}</strong>
                  <span>{pluralText(t, 'units.people', group.members.length, language)}</span>
                </header>
                {group.members.length === 0 ? (
                  <p className="shift-drawer__muted">{t('teamEmpty')}</p>
                ) : (
                  <ul className="shift-assign__chips">
                    {group.members.map((member) => (
                      <li key={member.staff_id} className={member.staff_id === values.staffId ? 'shift-assign__chip--selected' : undefined}>
                        {isLocked(member) ? (
                          // Already working: shown as part of the team, but not a pickable chip
                          <span className="shift-assign__chip-static" title={t('errors.shiftStarted')}>
                            {member.full_name}
                            <small>{t(member.today_shift?.status === 'COMPLETED' ? 'chipShiftEnded' : 'chipOnShift')}</small>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setField('staffId', member.staff_id)} disabled={isSaving}>
                            {member.full_name}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <Drawer
      open={open}
      eyebrow={t('assignEyebrow')}
      title={t('assignTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      className="shift-drawer"
      footer={(
        <div className="shift-drawer__footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('close')}</Button>
          <Button type="submit" form={FORM_ID} disabled={isSaving || isLoading || Boolean(error)}>
            <ArrowLeftRight aria-hidden="true" />
            {isSaving ? t('saving') : t('assignSave')}
          </Button>
        </div>
      )}
    >
      {content}
    </Drawer>
  );
}
