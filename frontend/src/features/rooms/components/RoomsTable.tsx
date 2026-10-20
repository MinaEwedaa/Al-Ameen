import { ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Language } from '../../../core/i18n';
import { getTranslation } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { formatRelativeTime } from '../../../utils/date';
import { RoomStatusBadge } from './RoomStatusBadge';
import { getRoomGuestName, getRoomNotes } from '../utils/roomDisplay';
import type { Room } from '../types/room.types';
import './RoomsTable.css';

interface RoomsTableProps {
  rooms: Room[];
  totalRooms: number;
  language: Language;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenRoom: (roomId: string) => void;
}

export function RoomsTable({ rooms, totalRooms, language, page, totalPages, onPageChange, onOpenRoom }: RoomsTableProps) {
  const t = (key: string) => getTranslation(language, key);
  const summary = t('rooms.table.summary')
    .replace('{rows}', formatNumber(rooms.length, language))
    .replace('{total}', formatNumber(totalRooms, language));
  const pageLabel = t('rooms.table.page')
    .replace('{page}', formatNumber(page, language))
    .replace('{total}', formatNumber(totalPages, language));

  const columns = [
    { key: 'number', label: t('rooms.table.roomNumber'), render: (row: unknown) => {
      const room = row as Room;
      return <span className="rooms-table__number">{formatNumber(Number(room.number), language)}</span>;
    } },
    { key: 'type', label: t('rooms.table.roomType'), render: (row: unknown) => t(`rooms.type.${(row as Room).type}`) },
    { key: 'status', label: t('rooms.table.status'), render: (row: unknown) => <RoomStatusBadge status={(row as Room).status} language={language} /> },
    { key: 'guestName', label: t('rooms.table.guest'), render: (row: unknown) => getRoomGuestName(row as Room, language) },
    { key: 'floor', label: t('rooms.table.floor'), render: (row: unknown) => t(`rooms.floor.${(row as Room).floor}`) },
    { key: 'updatedAt', label: t('rooms.table.updatedAt'), render: (row: unknown) => formatRelativeTime((row as Room).updatedAt, language) },
    { key: 'notes', label: t('rooms.table.notes'), render: (row: unknown) => <span className="rooms-table__notes">{getRoomNotes(row as Room, language) || '—'}</span> },
    { key: 'actions', label: t('rooms.table.actions'), render: (row: unknown) => {
      const room = row as Room;
      return (
        <button type="button" className="rooms-table__open" aria-label={`${t('rooms.table.actions')} ${formatNumber(Number(room.number), language)}`} onClick={() => onOpenRoom(room.id)}>
          <ChevronRight aria-hidden="true" />
        </button>
      );
    } },
  ];

  return (
    <Card className="rooms-table-card" id="rooms-table-card">
      <header className="rooms-table-card__header">
        <div>
          <h2>{t('rooms.table.title')}</h2>
          <p>{summary}</p>
        </div>
        <span className="rooms-table-card__updated">{t('rooms.table.updatedNow')}</span>
      </header>
      <Table columns={columns} rows={rooms} emptyMessage={t('rooms.table.empty')} className="rooms-table" />
      <footer className="rooms-table-card__footer">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageLabel={pageLabel}
          previousLabel={t('pagination.previous')}
          nextLabel={t('pagination.next')}
          navigationLabel={t('pagination.label')}
        />
      </footer>
    </Card>
  );
}
