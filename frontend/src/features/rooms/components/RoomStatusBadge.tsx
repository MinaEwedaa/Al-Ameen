import { Badge } from '../../../components/ui/Badge';
import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';
import type { RoomStatus } from '../types/room.types';
import './RoomStatusBadge.css';

const toneByStatus: Record<RoomStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  available: 'success',
  occupied: 'success',
  reserved: 'warning',
  cleaning: 'info',
  maintenance: 'warning',
};

export function RoomStatusBadge({ status, language }: { status: RoomStatus; language: Language }) {
  return (
    <Badge tone={toneByStatus[status]} className={`room-status-badge room-status-badge--${status}`}>
      {getTranslation(language, `rooms.status.${status}`)}
    </Badge>
  );
}
