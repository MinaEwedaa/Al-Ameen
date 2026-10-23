import { useState, useEffect } from 'react';
import {
  BedDouble,
  DoorClosed,
  Crown,
  LayoutGrid,
  FileText,
  Download,
} from 'lucide-react';
import { PageHero } from '../../../components/common/PageHero';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { useToast } from '../../../components/ui/ToastContext';
import { FloorTabs, FloorCard, RoomReviewDrawer } from '../components';
import { useManagerRooms } from '../hooks/useManagerRooms';
import { useManagerRoomsStats } from '../hooks/useManagerRoomsStats';
import { useManagerRoom } from '../hooks/useManagerRoom';
import { getRooms } from '../services/manager-rooms.api';
import { mapRoomDtoToManagerRoom } from '../services/manager-rooms.mappers';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { formatNumber } from '../../../utils/format';
import { exportAllRoomsCsv, exportFloorRoomsCsv } from '../utils/roomsExport';
import type { ManagerRoom } from '../types/manager-rooms.types';
import './ManagerRoomsPage.css';

export function ManagerRoomsPage() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [selectedFloor, setSelectedFloor] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const floorParam = params.get('floor');
    const floorNum = floorParam ? parseInt(floorParam, 10) : 1;
    return [1, 2, 3].includes(floorNum) ? floorNum : 1;
  });

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('roomId') || null;
  });

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const floorParam = params.get('floor');
      const floorNum = floorParam ? parseInt(floorParam, 10) : 1;
      if ([1, 2, 3].includes(floorNum)) {
        setSelectedFloor(floorNum);
      }
      const idParam = params.get('id') || params.get('roomId') || null;
      setActiveRoomId(idParam);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSelectFloor = (floor: number) => {
    setSelectedFloor(floor);
    const url = new URL(window.location.href);
    url.searchParams.set('floor', String(floor));
    window.history.pushState({}, '', url.toString());
  };

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useManagerRoomsStats();

  const {
    data: rooms,
    allRooms,
    isLoading: isRoomsLoading,
    isError: isRoomsError,
    error: roomsError,
    refetch: refetchRooms,
  } = useManagerRooms(selectedFloor);

  const { data: drawerRoomData } = useManagerRoom(activeRoomId ?? undefined);

  const selectedRoom =
    drawerRoomData ||
    (rooms?.find((r) => r.id === activeRoomId || r.number === activeRoomId) ?? null);

  const handleExportAllRooms = async () => {
    try {
      let roomsToExport = allRooms;
      if (!roomsToExport || roomsToExport.length === 0) {
        const res = await getRooms(1, 100);
        roomsToExport = res.data.map((dto) => mapRoomDtoToManagerRoom(dto));
      }
      const success = exportAllRoomsCsv(roomsToExport, language);
      if (success) {
        showToast(t('manager.rooms.allRoomsExported'), 'success');
      } else {
        showToast(t('manager.rooms.exportError'), 'error');
      }
    } catch {
      showToast(t('manager.rooms.exportError'), 'error');
    }
  };

  const handleExportFloorRooms = () => {
    if (!rooms || rooms.length === 0) return;
    const success = exportFloorRoomsCsv(rooms, language, selectedFloor);
    if (success) {
      const msg = t('manager.rooms.floorRoomsExported').replace(
        '{floor}',
        formatNumber(selectedFloor, language)
      );
      showToast(msg, 'success');
    } else {
      showToast(t('manager.rooms.exportError'), 'error');
    }
  };

  const handleSelectRoom = (room: ManagerRoom) => {
    setActiveRoomId(room.id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', room.id);
    url.searchParams.delete('roomId');
    window.history.pushState({}, '', url.toString());
  };

  const handleCloseDrawer = () => {
    setActiveRoomId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    url.searchParams.delete('roomId');
    window.history.pushState({}, '', url.toString());
  };

  const isLoading = isStatsLoading || isRoomsLoading;
  const isError = isStatsError || isRoomsError;

  const heroActions = (
    <>
      <Button
        variant="gold"
        className="manager-rooms-page__hero-btn"
        type="button"
        onClick={handleExportAllRooms}
      >
        <FileText size={18} aria-hidden="true" />
        <span>{t('manager.rooms.hero.roomsReport')}</span>
      </Button>
      <Button
        variant="glass"
        className="manager-rooms-page__hero-btn"
        type="button"
        onClick={handleExportFloorRooms}
      >
        <Download size={18} aria-hidden="true" />
        <span>{t('manager.rooms.hero.export')}</span>
      </Button>
    </>
  );

  return (
    <div className="manager-rooms-page">
      <PageHero
        eyebrow={t('manager.rooms.hero.eyebrow')}
        title={t('manager.rooms.hero.title')}
        description={t('manager.rooms.hero.description')}
      >
        {heroActions}
      </PageHero>

      {isError ? (
        <div className="manager-rooms-page__state-container">
          <ErrorState
            title={t('manager.rooms.errorTitle')}
            message={roomsError ? getErrorMessage(roomsError, language) : ''}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  refetchStats();
                  refetchRooms();
                }}
              >
                {t('manager.rooms.retry')}
              </Button>
            }
          />
        </div>
      ) : isLoading ? (
        <div className="manager-rooms-page__state-container">
          <LoadingState label={t('manager.rooms.loading')} />
        </div>
      ) : (
        <>
          <section className="manager-rooms-page__stats-grid" aria-label="إحصائيات الغرف">
            <StatCard
              label={t('manager.rooms.stats.totalRooms')}
              value={stats?.totalRooms ?? 36}
              hint={t('manager.rooms.stats.floorsSubtitle')}
              icon={<BedDouble size={22} />}
              tone="green"
            />
            <StatCard
              label={t('manager.rooms.stats.standardRooms')}
              value={stats?.standardRooms ?? 21}
              hint={t('manager.rooms.stats.expandableSubtitle')}
              icon={<DoorClosed size={22} />}
              tone="green"
            />
            <StatCard
              label={t('manager.rooms.stats.vipRooms')}
              value={stats?.vipRooms ?? 15}
              hint={t('manager.rooms.stats.expandableSubtitle')}
              icon={<Crown size={22} />}
              tone="gold"
            />
            <StatCard
              label={t('manager.rooms.stats.floors')}
              value={stats?.totalFloors ?? 3}
              hint={t('manager.rooms.stats.approxPerFloorSubtitle')}
              icon={<LayoutGrid size={22} />}
              tone="gold"
            />
          </section>

          <div className="manager-rooms-page__tabs-bar">
            <FloorTabs
              selectedFloor={selectedFloor}
              onSelectFloor={handleSelectFloor}
              floors={[1, 2, 3]}
            />
          </div>

          <FloorCard
            floor={selectedFloor}
            rooms={rooms ?? []}
            occupancyPercent={stats?.floorOccupancy?.[selectedFloor]}
            onSelectRoom={handleSelectRoom}
          />
        </>
      )}

      {/* Room Review Drawer */}
      <RoomReviewDrawer
        room={selectedRoom}
        open={Boolean(activeRoomId && selectedRoom)}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
