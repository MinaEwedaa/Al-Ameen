import { useEffect, useState } from 'react';
import { NotebookText } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { ROOM_STATUS_OPTIONS, ROOM_STATUS_TRANSITIONS } from '../constants/roomOptions';
import { validateRoomActivity } from '../schemas/roomActivity.schema';
import type { AddRoomActivityInput, Room, RoomStatus } from '../types/room.types';
import './AddRoomActivityDrawer.css';

interface AddRoomActivityDrawerProps {
  open: boolean;
  rooms: Room[];
  language: Language;
  onClose: () => void;
  onSave: (input: AddRoomActivityInput) => void;
  isSaving: boolean;
}

export function AddRoomActivityDrawer({ open, rooms, language, onClose, onSave, isSaving }: AddRoomActivityDrawerProps) {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState<RoomStatus | ''>('');
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ roomId?: string; status?: string; guestName?: string }>({});
  const t = (key: string) => getTranslation(language, key);

  useEffect(() => {
    if (!open) return;
    setRoomId('');
    setStatus('');
    setGuestName('');
    setNotes('');
    setErrors({});
  }, [open]);

  const roomOptions = [...rooms]
    .sort((left, right) => Number(left.number) - Number(right.number))
    .map((room) => ({ value: room.id, label: t('rooms.drawer.roomTitle').replace('{number}', formatNumber(Number(room.number), language)) }));
  const selectedRoom = rooms.find((room) => room.id === roomId);
  const allowedStatuses = selectedRoom ? ROOM_STATUS_TRANSITIONS[selectedRoom.status] : [];
  // Only the statuses the server accepts from the room's current status (reserved/occupied come from reservations)
  const statusOptions = ROOM_STATUS_OPTIONS
    .filter((option): option is typeof option & { value: RoomStatus } => option.value !== '' && allowedStatuses.includes(option.value))
    .map((option) => ({ value: option.value, label: t(`rooms.status.${option.value}`) }));
  const statusPlaceholder = !selectedRoom
    ? t('rooms.drawer.chooseRoomFirst')
    : allowedStatuses.length === 0
      ? t('rooms.drawer.noTransitions')
      : t('rooms.drawer.chooseStatus');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateRoomActivity({ roomId, status, guestName }, {
      room: t('rooms.validation.roomRequired'),
      status: t('rooms.validation.statusRequired'),
      guest: t('rooms.validation.guestRequired'),
    });
    setErrors(validation);
    if (Object.keys(validation).length > 0 || !status) return;
    onSave({ roomId, status, guestName, notes });
  };

  return (
    <Drawer
      open={open}
      title={t('rooms.drawer.activityTitle')}
      eyebrow={t('rooms.drawer.activityEyebrow')}
      onClose={onClose}
      closeLabel={t('rooms.drawer.close')}
      className="add-room-activity-drawer"
      footer={(
        <div className="add-room-activity-drawer__footer">
          <Button type="submit" form="add-room-activity-form" disabled={isSaving}>{t('rooms.drawer.saveActivity')}</Button>
          <Button variant="secondary" type="button" onClick={onClose}>{t('rooms.drawer.cancel')}</Button>
        </div>
      )}
    >
      <form id="add-room-activity-form" className="add-room-activity-drawer__form" onSubmit={submit} noValidate>
        <div className="add-room-activity-drawer__pair">
          <Select label={t('rooms.drawer.roomNumber')} value={roomId} placeholder={t('rooms.drawer.chooseRoom')} options={roomOptions} onChange={(value) => { setRoomId(value); setStatus(''); setErrors((current) => ({ ...current, roomId: undefined, status: undefined })); }} error={errors.roomId} />
          <Select label={t('rooms.drawer.newStatus')} value={status} placeholder={statusPlaceholder} options={statusOptions} disabled={!selectedRoom || allowedStatuses.length === 0} onChange={(value) => { setStatus(value as RoomStatus); setErrors((current) => ({ ...current, status: undefined, guestName: value === 'occupied' || value === 'reserved' ? current.guestName : undefined })); }} error={errors.status} />
        </div>
        <label className="add-room-activity-drawer__field">
          <span>{t('rooms.drawer.guestName')}</span>
          <Input value={guestName} onChange={(event) => { setGuestName(event.target.value); setErrors((current) => ({ ...current, guestName: undefined })); }} placeholder={t('rooms.drawer.guestNamePlaceholder')} aria-invalid={Boolean(errors.guestName)} />
          {errors.guestName && <small>{errors.guestName}</small>}
        </label>
        <label className="add-room-activity-drawer__field">
          <span>{t('rooms.drawer.activityNotes')}</span>
          <textarea className="ui-input add-room-activity-drawer__notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('rooms.drawer.activityNotesPlaceholder')} />
        </label>
        <div className="add-room-activity-drawer__info"><NotebookText aria-hidden="true" /><span>{t('rooms.drawer.shiftInfo')}</span></div>
      </form>
    </Drawer>
  );
}
