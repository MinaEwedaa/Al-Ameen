import { useRef, useState } from 'react';
import { Check, Receipt, Sparkles } from 'lucide-react';
import { Timeline } from '../../../components/common/Timeline';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { PRIORITY_LABEL_KEY, PRIORITY_TONE, STATUS_LABEL_KEY } from '../constants/housekeeping.constants';
import type { HousekeepingTask } from '../types/housekeeping.types';
import { formatTaskTime } from '../utils/housekeepingDisplay';
import './TaskDetailsDrawer.css';

const EMPTY_VALUE = '—';

interface TaskDetailsDrawerProps {
  task: HousekeepingTask | null;
  language: Language;
  onClose: () => void;
  onComplete: () => void;
  isSaving: boolean;
}

// The parent gives this component a `key` per task, so the confirm step resets when another task opens.
export function TaskDetailsDrawer({ task, language, onClose, onComplete, isSaving }: TaskDetailsDrawerProps) {
  const t = (key: string) => getTranslation(language, key);
  const statusRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLElement>(null);
  // Marking a task done cannot be undone, so it takes a second click to confirm
  const [confirming, setConfirming] = useState(false);

  const scrollTo = (element: HTMLElement | null) => element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Log built from the two dates the API sends: when the task was created and when it was finished
  const logItems = task
    ? [
        ...(task.finished_date
          ? [{ id: 'done', title: t('hkLog_done'), description: t('hkLog_doneDesc'), time: formatTaskTime(task.finished_date, language) }]
          : []),
        { id: 'created', title: t('hkLog_created'), description: t('hkLog_createdDesc'), time: formatTaskTime(task.assigned_date, language) },
      ]
    : [];

  const footer = task && task.status === 'pending' ? (
    confirming ? (
      <div className="task-details__footer">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isSaving}>{t('cancel')}</Button>
        <Button onClick={onComplete} disabled={isSaving}>{t('hkConfirmDone')}</Button>
      </div>
    ) : (
      <div className="task-details__footer task-details__footer--single">
        <Button onClick={() => setConfirming(true)}>
          <Check aria-hidden="true" />
          {t('hkMarkDone')}
        </Button>
      </div>
    )
  ) : undefined;

  return (
    <Drawer
      open={task !== null}
      title={task ? `${t('roomLabel')} ${Number.isFinite(Number(task.room_number || task.room_id)) ? formatNumber(Number(task.room_number || task.room_id), language) : (task.room_number || task.room_id)}` : ''}
      eyebrow={t('hkDetailsEyebrow')}
      closeLabel={t('drawerClose')}
      onClose={onClose}
      className="task-details-drawer"
      footer={footer}
    >
      {task && (
        <div className="task-details">
          <section className="task-details__summary">
            <span className="task-details__icon"><Sparkles aria-hidden="true" /></span>
            <div className="task-details__summary-text">
              <strong>{t('hkTaskTitle')}</strong>
              <span>{`${t('hkColCreatedAt')}: ${formatTaskTime(task.assigned_date, language)}`}</span>
            </div>
            <Badge tone={PRIORITY_TONE[task.priority]}>{t(PRIORITY_LABEL_KEY[task.priority])}</Badge>
          </section>

          <div className="task-details__grid">
            <div ref={statusRef} className="task-details__info">
              <span>{t('statusLabel')}</span>
              <strong>{t(STATUS_LABEL_KEY[task.status])}</strong>
            </div>
            <div className="task-details__info">
              <span>{t('hkCleaner')}</span>
              <strong>{task.cleaner_name || EMPTY_VALUE}</strong>
            </div>
            <div className="task-details__info">
              <span>{t('priorityLabel')}</span>
              <strong>{t(PRIORITY_LABEL_KEY[task.priority])}</strong>
            </div>
          </div>

          <section>
            <h3 className="task-details__heading">{t('hkNotes')}</h3>
            <p className="task-details__box">{task.notes || EMPTY_VALUE}</p>
          </section>

          <section ref={logRef}>
            <h3 className="task-details__heading">{t('hkLog')}</h3>
            <Timeline items={logItems} />
          </section>

          <div className="task-details__actions">
            <button type="button" className="task-details__action" onClick={() => scrollTo(statusRef.current)}>
              <Check aria-hidden="true" />
              {t('followStatus')}
            </button>
            <button type="button" className="task-details__action" onClick={() => scrollTo(logRef.current)}>
              <Receipt aria-hidden="true" />
              {t('viewLog')}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
