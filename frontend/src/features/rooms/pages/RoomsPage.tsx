import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { useDebounce } from '../../../hooks/useDebounce';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { getTranslation, type Language } from '../../../core/i18n';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { useToast } from '../../../components/ui/ToastContext';
import { exportCsv } from '../../../utils/exportCsv';
import { formatDate } from '../../../utils/date';
import { formatNumber } from '../../../utils/format';
import { useAddRoomActivity, useAllRooms, useRoom, useRooms, useRoomStats, useUpdateRoom } from '../services/useRooms';
import { ROOM_PAGE_SIZE } from '../constants/roomOptions';
import type { AddRoomActivityInput, Room, RoomAvailability, RoomFilters, RoomFloor, RoomStatus, RoomType } from '../types/room.types';
import { getRoomGuestName, getRoomNotes } from '../utils/roomDisplay';
import { AddRoomActivityDrawer } from '../components/AddRoomActivityDrawer';
import { RoomDetailsDrawer } from '../components/RoomDetailsDrawer';
import { RoomsFilters } from '../components/RoomsFilters';
import { RoomsStatsRow } from '../components/RoomsStatsRow';
import { RoomsTable } from '../components/RoomsTable';
import './RoomsPage.css';

const filterKeys = ['q', 'type', 'status', 'floor', 'availability', 'page'] as const;

function parseFilters(params: URLSearchParams): RoomFilters {
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const floor = params.get('floor') ?? '';
  const availability = params.get('availability') ?? 'all';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    type: type === 'standard' || type === 'vip' ? type as RoomType : '',
    status: ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'].includes(status) ? status as RoomStatus : '',
    floor: ['1', '2', '3'].includes(floor) ? Number(floor) as RoomFloor : '',
    availability: availability === 'available' || availability === 'unavailable' ? availability as RoomAvailability : 'all',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function createDefaultParams(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of filterKeys) {
    if (next.has(key)) continue;
    next.set(key, key === 'availability' ? 'all' : key === 'page' ? '1' : '');
  }
  return next;
}

export function RoomsPage() {
  const { language } = useOutletContext<{ language: Language }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const tableRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchDraft, 300);
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const roomsQuery = useRooms(filters, language);
  const allRoomsQuery = useAllRooms();
  const statsQuery = useRoomStats();
  const selectedRoomId = searchParams.get('id') ?? undefined;
  const selectedRoomQuery = useRoom(selectedRoomId);
  const updateRoom = useUpdateRoom();
  const addRoomActivity = useAddRoomActivity();
  const allRooms = useMemo(() => allRoomsQuery.data ?? [], [allRoomsQuery.data]);
  const stats = statsQuery.data;
  const filteredRooms = roomsQuery.data?.matchingRooms ?? [];
  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / ROOM_PAGE_SIZE));
  const effectivePage = Math.min(filters.page, totalPages);
  const pageRooms = roomsQuery.data?.rows ?? [];
  const isActivityOpen = searchParams.get('activity') === 'new';

  const setParam = useCallback((name: string, value: string, replace = false) => {
    setSearchParams((current) => {
      const next = createDefaultParams(current);
      next.set(name, value);
      return next;
    }, { replace });
  }, [setSearchParams]);

  useEffect(() => {
    if (filterKeys.every((key) => searchParams.has(key))) return;
    setSearchParams(createDefaultParams(searchParams), { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (debouncedSearch === filters.q || searchDraft !== debouncedSearch) return;
    setSearchParams((current) => {
      const next = createDefaultParams(current);
      next.set('q', debouncedSearch);
      next.set('page', '1');
      return next;
    }, { replace: true });
  }, [debouncedSearch, filters.q, searchDraft, setSearchParams]);

  useEffect(() => {
    if (roomsQuery.isSuccess && filters.page !== effectivePage) setParam('page', String(effectivePage), true);
  }, [effectivePage, filters.page, roomsQuery.isSuccess, setParam]);

  function changeFilter(name: 'type' | 'status' | 'floor' | 'availability', value: string) {
    setSearchParams((current) => {
      const next = createDefaultParams(current);
      next.set(name, value);
      next.set('page', '1');
      return next;
    });
  }

  function resetFilters() {
    const next = new URLSearchParams();
    next.set('q', '');
    next.set('type', '');
    next.set('status', '');
    next.set('floor', '');
    next.set('availability', 'all');
    next.set('page', '1');
    const roomId = searchParams.get('id');
    const activity = searchParams.get('activity');
    if (roomId) next.set('id', roomId);
    if (activity) next.set('activity', activity);
    setSearchDraft('');
    setSearchParams(next);
  }

  function closeDrawers() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('id');
      next.delete('activity');
      return next;
    });
  }

  function openRoom(roomId: string) {
    setSearchParams((current) => {
      const next = createDefaultParams(current);
      next.delete('activity');
      next.set('id', roomId);
      return next;
    });
  }

  function openActivity() {
    setSearchParams((current) => {
      const next = createDefaultParams(current);
      next.delete('id');
      next.set('activity', 'new');
      return next;
    });
  }

  function changePage(page: number) {
    setParam('page', String(page));
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function saveDetails(status: RoomStatus, notes: string) {
    if (!selectedRoomId) return;
    try {
      await updateRoom.mutateAsync({ id: selectedRoomId, status, notes });
      closeDrawers();
      toast.notify(t('rooms.toast.roomSaved'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  async function saveActivity(input: AddRoomActivityInput) {
    try {
      await addRoomActivity.mutateAsync(input);
      closeDrawers();
      toast.notify(t('rooms.toast.activitySaved'), 'success');
    } catch (error) {
      toast.notify(getErrorMessage(error, language), 'error');
    }
  }

  function downloadCsv() {
    if (filteredRooms.length === 0) {
      toast.notify(t('rooms.toast.noExportRows'), 'warning');
      return;
    }
    const headers = ['roomNumber', 'type', 'status', 'guest', 'floor', 'view', 'arrival', 'notes', 'updatedAt'];
    const exported = exportCsv(filteredRooms, headers.map((key) => ({
      header: t(`rooms.csv.${key}`),
      value: (room: Room) => {
        if (key === 'roomNumber') return formatNumber(Number(room.number), language);
        if (key === 'type') return t(`rooms.type.${room.type}`);
        if (key === 'status') return t(`rooms.status.${room.status}`);
        if (key === 'guest') return getRoomGuestName(room, language);
        if (key === 'floor') return t(`rooms.floor.${room.floor}`);
        if (key === 'view') return t(`rooms.views.${room.view}`);
        if (key === 'arrival') return room.arrivalDate ? formatDate(room.arrivalDate, language) : '';
        if (key === 'notes') return getRoomNotes(room, language);
        return formatDate(room.updatedAt, language);
      },
    })), `rooms-${new Date().toISOString().slice(0, 10)}.csv`);
    if (exported) toast.notify(t('rooms.toast.exported').replace('{count}', formatNumber(filteredRooms.length, language)), 'success');
  }

  if (roomsQuery.isPending || allRoomsQuery.isPending || statsQuery.isPending) {
    return <div className="feature-page rooms-page"><PageHero eyebrow={t('rooms.eyebrow')} title={t('rooms.title')} description={t('rooms.description')} /><LoadingState label={t('rooms.table.loading')} /></div>;
  }

  if (roomsQuery.isError || allRoomsQuery.isError || statsQuery.isError || !stats) {
    const queryError = roomsQuery.error ?? allRoomsQuery.error ?? statsQuery.error;
    return (
      <div className="feature-page rooms-page">
        <PageHero eyebrow={t('rooms.eyebrow')} title={t('rooms.title')} description={t('rooms.description')} />
        <ErrorState
          title={t('rooms.table.error')}
          message={queryError ? getErrorMessage(queryError, language) : t('rooms.table.error')}
          action={
            <Button
              type="button"
              onClick={() => {
                void roomsQuery.refetch();
                void allRoomsQuery.refetch();
                void statsQuery.refetch();
              }}
            >
              {t('rooms.table.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="feature-page rooms-page">
      <PageHero eyebrow={t('rooms.eyebrow')} title={t('rooms.title')} description={t('rooms.description')}>
        <Button variant="glass" type="button" className="rooms-page__hero-export" onClick={downloadCsv}><FileText aria-hidden="true" />{t('rooms.export')}</Button>
        <Button variant="gold" type="button" className="rooms-page__hero-add" onClick={openActivity}><Plus aria-hidden="true" />{t('rooms.addActivity')}</Button>
      </PageHero>

      <RoomsStatsRow stats={stats} language={language} />

      <Card className="filters-card">
        <RoomsFilters language={language} value={searchDraft} onSearchChange={setSearchDraft} filters={filters} onFilterChange={changeFilter} onReset={resetFilters} />
      </Card>

      {filteredRooms.length === 0 ? (
        <EmptyState title={t('rooms.table.empty')} description={t('rooms.table.emptyDescription')} action={<Button variant="secondary" type="button" onClick={resetFilters}>{t('rooms.table.resetFilters')}</Button>} />
      ) : (
        <div ref={tableRef}>
          <RoomsTable rooms={pageRooms} totalRooms={filteredRooms.length} language={language} page={effectivePage} totalPages={totalPages} onPageChange={changePage} onOpenRoom={openRoom} />
        </div>
      )}

      <RoomDetailsDrawer room={selectedRoomQuery.data} language={language} onClose={closeDrawers} onSave={(status, notes) => { void saveDetails(status, notes); }} isSaving={updateRoom.isPending} />
      <AddRoomActivityDrawer open={isActivityOpen} rooms={allRooms} language={language} onClose={closeDrawers} onSave={(input) => { void saveActivity(input); }} isSaving={addRoomActivity.isPending} />
    </div>
  );
}
