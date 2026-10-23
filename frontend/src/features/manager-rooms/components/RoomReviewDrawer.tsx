import { BedDouble } from 'lucide-react';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { Timeline, type TimelineItem } from '../../../components/common/Timeline';
import { RoomInfoTile } from './RoomInfoTile';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { useToast } from '../../../components/ui/ToastContext';
import { exportRoomLogCsv } from '../utils/roomsExport';
import type { ManagerRoom } from '../types/manager-rooms.types';
import './RoomReviewDrawer.css';

export interface RoomReviewDrawerProps {
  room: ManagerRoom | null;
  open: boolean;
  onClose: () => void;
}

export function RoomReviewDrawer({ room, open, onClose }: RoomReviewDrawerProps) {
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  if (!room) return null;

  const isVip = room.type === 'vip';
  const typeLabel = isVip
    ? t('manager.rooms.tile.vip')
    : t('manager.rooms.tile.standard');

  const statusKey = `manager.rooms.tile.status.${room.status}`;
  const statusLabel = t(statusKey);

  const guestText =
    room.guestName ||
    (room.status === 'occupied'
      ? t('manager.rooms.tile.currentGuest')
      : t('manager.rooms.tile.noGuest'));

  const priceText = `${formatNumber(room.price, language)} ${t('manager.rooms.tile.egp')}`;

  const drawerTitle = t('manager.rooms.drawer.title').replace(
    '{number}',
    formatNumber(Number(room.number), language)
  );

  const handleDownloadLog = () => {
    const success = exportRoomLogCsv(room, language);
    if (success) {
      const toastMsg = t('manager.rooms.drawer.logReportDownloaded').replace(
        '{number}',
        formatNumber(Number(room.number), language)
      );
      showToast(toastMsg, 'success');
    } else {
      showToast(t('manager.rooms.exportError'), 'error');
    }
  };

  const timelineItems: TimelineItem[] = (room.log ?? []).map((item) => ({
    id: item.id,
    title: item.action,
    description: item.details,
    time: item.time,
  }));

  const drawerFooter = (
    <div className="room-drawer__footer">
      <Button
        variant="primary"
        className="room-drawer__btn-report"
        type="button"
        onClick={handleDownloadLog}
      >
        {t('manager.rooms.drawer.viewReport')}
      </Button>
      <Button
        variant="secondary"
        className="room-drawer__btn-close"
        type="button"
        onClick={onClose}
      >
        {t('manager.rooms.drawer.close')}
      </Button>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={t('manager.rooms.drawer.eyebrow')}
      title={drawerTitle}
      closeLabel={t('manager.rooms.drawer.closeLabel')}
      footer={drawerFooter}
    >
      <div className="room-drawer__content">
        {/* Summary Card */}
        <div className="room-drawer__summary-card">
          <div className="room-drawer__summary-info">
            <div className="room-drawer__summary-top">
              <span className="room-drawer__summary-type">{typeLabel}</span>
              <span
                className={`room-tile__status-badge room-tile__status-badge--${room.status}`}
              >
                {statusLabel}
              </span>
            </div>
            <span className="room-drawer__summary-price">{priceText}</span>
          </div>
          <div className="room-drawer__summary-icon" aria-hidden="true">
            <BedDouble size={24} />
          </div>
        </div>

        {/* 4 Info Tiles */}
        <div className="room-drawer__info-grid">
          <RoomInfoTile label={t('manager.rooms.drawer.info.guest')} value={guestText} />
          <RoomInfoTile label={t('manager.rooms.drawer.info.type')} value={typeLabel} />
          <RoomInfoTile label={t('manager.rooms.drawer.info.status')} value={statusLabel} />
          <RoomInfoTile label={t('manager.rooms.drawer.info.price')} value={priceText} />
        </div>

        {/* Operations Log */}
        <div className="room-drawer__log-section">
          <h3 className="room-drawer__log-title">
            {t('manager.rooms.drawer.operationsLog')}
          </h3>
          {timelineItems.length > 0 ? (
            <Timeline items={timelineItems} markerTone="gold" />
          ) : (
            <p className="room-drawer__empty-log">
              {t('manager.rooms.drawer.emptyLog')}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
