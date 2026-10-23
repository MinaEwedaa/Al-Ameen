import { Clock } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { EMPLOYEES_I18N } from '../constants/employees.constants';
import type { ShiftCoverage } from '../types/employee.types';
import { formatShiftRange, pluralText } from '../utils/employeeDisplay';
import './ShiftCoverageCard.css';

interface ShiftCoverageCardProps {
  shifts: ShiftCoverage[];
  onManage: () => void;
}

// "تعيين الورديات": one column per shift (GET /shifts/overview) with its receptionist, status and team size
export function ShiftCoverageCard({ shifts, onManage }: ShiftCoverageCardProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${EMPLOYEES_I18N}.${key}`);

  return (
    <Card className="shift-coverage">
      <header className="shift-coverage__header">
        <div>
          <h2>{t('coverageTitle')}</h2>
          <p>{t('coverageSubtitle')}</p>
        </div>
        <Button variant="secondary" className="shift-coverage__manage" onClick={onManage}>{t('manageSchedule')}</Button>
      </header>

      <div className="shift-coverage__grid">
        {shifts.map((shift) => {
          const isActive = shift.status === 'ACTIVE';
          return (
            <article key={shift.shift_type} className={`shift-coverage__column${isActive ? ' shift-coverage__column--active' : ''}`}>
              <div className="shift-coverage__head">
                <span className="shift-coverage__icon" aria-hidden="true"><Clock /></span>
                <div className="shift-coverage__name">
                  <strong>{t(`shifts.${shift.shift_type}`)}</strong>
                  <span dir="auto">{formatShiftRange(shift.start_time, shift.end_time, language)}</span>
                </div>
                <span className="shift-coverage__lead">{shift.staff?.full_name ?? t('noReceptionist')}</span>
              </div>
              <Badge tone={isActive ? 'info' : 'neutral'} className="shift-coverage__status">
                {t(`shiftStatus.${shift.status}`)}
              </Badge>
              <p className="shift-coverage__meta">
                <span>{pluralText(t, 'teamCount', shift.team_count, language)}</span>
                <span className={shift.staff ? '' : 'shift-coverage__vacancy'}>
                  {shift.staff ? t('noVacancies') : t('vacancyReception')}
                </span>
              </p>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
