import { useId, useRef, useState } from 'react';
import { Check, Receipt, Wrench } from 'lucide-react';
import { Timeline } from '../../../components/common/Timeline';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Select } from '../../../components/ui/Select';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import {
  NEXT_STATUSES,
  PRIORITY_LABEL_KEY,
  PRIORITY_TONE,
  STATUS_LABEL_KEY,
} from '../constants/maintenance.constants';
import { validateStatusChange } from '../schemas/maintenanceRequest.schema';
import type { MaintenanceIssueUpdate, MaintenanceRequest } from '../types/maintenance.types';
import { formatReference, formatRequestTime, formatTimeAgo, lastUpdateOf } from '../utils/maintenanceDisplay';
import './MaintenanceDetailsDrawer.css';

const EMPTY_VALUE = '—';

type NextStatus = NonNullable<MaintenanceIssueUpdate['status']>;

interface MaintenanceDetailsDrawerProps {
  request: MaintenanceRequest | null;
  language: Language;
  onClose: () => void;
  onSave: (status: NextStatus) => void;
  isSaving: boolean;
}

// The parent gives this component a `key` per request, so the editor resets when another request opens.
export function MaintenanceDetailsDrawer({ request, language, onClose, onSave, isSaving }: MaintenanceDetailsDrawerProps) {
  const t = (key: string) => getTranslation(language, key);
  const statusSelectId = useId();
  const statusRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLElement>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [draftStatus, setDraftStatus] = useState<NextStatus | ''>('');
  const [statusError, setStatusError] = useState<string>();

  const nextStatuses = request ? NEXT_STATUSES[request.status] : [];
  const canChangeStatus = nextStatuses.length > 0;

  const scrollTo = (element: HTMLElement | null) => element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const focusStatusSelect = () => {
    // The select appears on the next render, so wait one frame before focusing it
    requestAnimationFrame(() => document.getElementById(statusSelectId)?.focus({ preventScroll: true }));
    scrollTo(statusRef.current);
  };

  const startEditingStatus = () => {
    setIsEditingStatus(true);
    focusStatusSelect();
  };

  const changeDraftStatus = (next: string) => {
    const status = next as NextStatus;
    setDraftStatus(status);
    if (statusError && request) setStatusError(validateStatusChange(request.status, status));
  };

  const save = () => {
    if (!request || isSaving) return;
    const error = validateStatusChange(request.status, draftStatus);
    if (error) {
      setStatusError(error);
      setIsEditingStatus(true);
      focusStatusSelect();
      return;
    }
    onSave(draftStatus as NextStatus);
  };

  // Log built from the two dates the API sends: when the issue was reported and when it was resolved
  const logItems = request
    ? [
        ...(request.resolved_date
          ? [{ id: 'resolved', title: t('mtLog_resolved'), description: t('mtLog_resolvedDesc'), time: formatRequestTime(request.resolved_date, language) }]
          : []),
        { id: 'reported', title: t('mtLog_reported'), description: t('mtLog_reportedDesc'), time: formatRequestTime(request.created_date, language) },
      ]
    : [];

  return (
    <Drawer
      open={request !== null}
      title={request ? `${t('roomLabel')} ${Number.isFinite(Number(request.room_number || request.room_id)) ? formatNumber(Number(request.room_number || request.room_id), language) : (request.room_number || request.room_id)}` : ''}
      eyebrow={t('mtDetailsEyebrow')}
      closeLabel={t('drawerClose')}
      onClose={onClose}
      className="maintenance-details-drawer"
      footer={canChangeStatus ? (
        <div className="maintenance-details__footer">
          <Button variant="secondary" onClick={startEditingStatus} disabled={isSaving}>{t('updateStatus')}</Button>
          <Button onClick={save} disabled={isSaving}>{t('mtSaveChanges')}</Button>
        </div>
      ) : undefined}
    >
      {request && (
        <div className="maintenance-details">
          <section className="maintenance-details__summary">
            <span className="maintenance-details__icon"><Wrench aria-hidden="true" /></span>
            <div className="maintenance-details__summary-text">
              <strong>{request.problem}</strong>
              <span>
                {formatReference(request.issue_id, language)}
                {' · '}
                {t('mtReportedAt').replace('{time}', formatRequestTime(request.created_date, language))}
              </span>
            </div>
            <Badge tone={PRIORITY_TONE[request.priority]}>{t(PRIORITY_LABEL_KEY[request.priority])}</Badge>
          </section>

          <div className="maintenance-details__grid">
            <div ref={statusRef} className={`maintenance-details__info${isEditingStatus ? ' maintenance-details__info--editing' : ''}`}>
              <span>{t('statusLabel')}</span>
              {isEditingStatus && canChangeStatus ? (
                <Select
                  id={statusSelectId}
                  value={draftStatus}
                  placeholder={t('mtChooseStatus')}
                  options={nextStatuses.map((option) => ({ value: option, label: t(STATUS_LABEL_KEY[option]) }))}
                  onChange={changeDraftStatus}
                  error={statusError ? t(statusError) : undefined}
                  disabled={isSaving}
                />
              ) : (
                <strong>{t(STATUS_LABEL_KEY[request.status])}</strong>
              )}
            </div>
            <div className="maintenance-details__info">
              <span>{t('mtResolvedAt')}</span>
              <strong>{request.resolved_date ? formatRequestTime(request.resolved_date, language) : EMPTY_VALUE}</strong>
            </div>
            <div className="maintenance-details__info">
              <span>{t('mtColLastUpdate')}</span>
              <strong>{formatTimeAgo(lastUpdateOf(request), language)}</strong>
            </div>
          </div>

          <section>
            <h3 className="maintenance-details__heading">{t('mtDescription')}</h3>
            <p className="maintenance-details__box">{request.notes || EMPTY_VALUE}</p>
          </section>

          <section ref={logRef}>
            <h3 className="maintenance-details__heading">{t('mtLog')}</h3>
            <Timeline items={logItems} />
          </section>

          <div className="maintenance-details__actions">
            <button type="button" className="maintenance-details__action" onClick={() => scrollTo(statusRef.current)}>
              <Check aria-hidden="true" />
              {t('followStatus')}
            </button>
            <button type="button" className="maintenance-details__action" onClick={() => scrollTo(logRef.current)}>
              <Receipt aria-hidden="true" />
              {t('viewLog')}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
