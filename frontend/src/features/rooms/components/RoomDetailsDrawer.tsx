
import { useEffect, useState } from 'react';
import { BedDouble } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Select } from '../../../components/ui/Select';
import { Timeline } from '../../../components/common/Timeline';
import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';
import { formatDate, formatRelativeTime } from '../../../utils/date';
import { formatNumber } from '../../../utils/format';
import { ROOM_STATUS_TRANSITIONS } from '../constants/roomOptions';
import type { Room, RoomStatus } from '../types/room.types';
import { getRoomGuestName } from '../utils/roomDisplay';
import { RoomStatusBadge } from './RoomStatusBadge';
import './RoomDetailsDrawer.css';

interface RoomDetailsDrawerProps {
  room: Room | undefined;
  language: Language;
  onClose: () => void;
  onSave: (status: RoomStatus, notes: string) => void;
  isSaving: boolean;
}

export function RoomDetailsDrawer({
  room,
  language,
  onClose,
  onSave,
  isSaving,
}: RoomDetailsDrawerProps) {
  const [draftStatus, setDraftStatus] = useState<RoomStatus | undefined>(room?.status);
  const [draftNotes, setDraftNotes] = useState('');
  const [showStatusSelect, setShowStatusSelect] = useState(false);
  const t = (key: string) => getTranslation(language, key);

  useEffect(() => {
    setDraftStatus(room?.status);
    setDraftNotes('');
    setShowStatusSelect(false);
  }, [language, room]);

  if (!room) return null;

  const currentStatus = draftStatus ?? room.status;
  const allowedStatuses = ROOM_STATUS_TRANSITIONS[room.status];
  const changed = currentStatus !== room.status;
  const statusOptions = allowedStatuses.map((status) => ({
    value: status,
    label: t(`rooms.status.${status}`),
  }));

  const detailTitle = t('rooms.drawer.roomTitle').replace(
    '{number}',
    formatNumber(Number(room.number), language),
  );

  const viewDescription = t('rooms.drawer.viewOn')
    .replace('{floor}', t(`rooms.floor.${room.floor}`))
    .replace('{view}', t(`rooms.views.${room.view}`));

  return (
    <Drawer
      open
      title={detailTitle}
      eyebrow={t('rooms.drawer.detailsEyebrow')}
      onClose={onClose}
      closeLabel={t('rooms.drawer.close')}
      className="room-details-drawer"
      footer={(
        <div className="room-details-drawer__footer">
          <Button
            variant="secondary"
            type="button"
            disabled={allowedStatuses.length === 0}
            onClick={() => setShowStatusSelect((visible) => !visible)}
          >
            {t('rooms.drawer.updateStatus')}
          </Button>
          <Button
            type="button"
            disabled={!changed || isSaving}
            onClick={() => onSave(currentStatus, draftNotes)}
          >
            {t('rooms.drawer.saveChanges')}
          </Button>
        </div>
      )}
    >
      <section className="room-details-drawer__summary">
        <span className="room-details-drawer__bed-icon">
          <BedDouble aria-hidden="true" />
        </span>
        <div>
          <strong>{t(`rooms.type.${room.type}`)}</strong>
          <span>{viewDescription}</span>
        </div>
        <RoomStatusBadge status={currentStatus} language={language} />
      </section>

      <section
        className="room-details-drawer__info-grid"
        aria-label={t('rooms.drawer.detailsEyebrow')}
      >
        <div>
          <span>{t('rooms.drawer.guest')}</span>
          <strong>{getRoomGuestName(room, language)}</strong>
        </div>
        <div>
          <span>{t('rooms.drawer.arrival')}</span>
          <strong>
            {room.arrivalDate
              ? formatDate(room.arrivalDate, language)
              : t('rooms.drawer.arrivalEmpty')}
          </strong>
        </div>
        <div>
          <span>{t('rooms.drawer.currentStatus')}</span>
          <strong>{t(`rooms.status.${currentStatus}`)}</strong>
        </div>
        <div>
          <span>{t('rooms.drawer.lastUpdated')}</span>
          <strong>{formatRelativeTime(room.updatedAt, language)}</strong>
        </div>
      </section>

      {showStatusSelect && (
        <div className="room-details-drawer__status-select">
          <Select
            label={t('rooms.drawer.chooseStatus')}
            value={allowedStatuses.includes(currentStatus) ? currentStatus : ''}
            options={statusOptions}
            onChange={(value) => {
              setDraftStatus(value as RoomStatus);
              setShowStatusSelect(false);
            }}
            autoOpen
          />
        </div>
      )}

      <section className="room-details-drawer__section">
        <label
          className="room-details-drawer__section-label"
          htmlFor="room-notes"
        >
          {t('rooms.drawer.notes')}
        </label>
        <textarea
          id="room-notes"
          className="ui-input room-details-drawer__notes"
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
          placeholder={t('rooms.drawer.notesPlaceholder')}
        />
      </section>

      <section className="room-details-drawer__section">
        <h3>{t('rooms.drawer.roomLog')}</h3>
        {room.log.length > 0 ? (
          <Timeline
            markerTone="gold"
            items={[...room.log]
              .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))
              .map((item) => ({
                id: item.id,
                title: t(item.titleKey),
                description: t(item.descriptionKey),
                time: formatRelativeTime(item.time, language),
              }))}
          />
        ) : (
          <p className="room-details-drawer__empty-log">
            {t('rooms.drawer.logEmpty')}
          </p>
        )}
      </section>

    </Drawer>
  );
}
