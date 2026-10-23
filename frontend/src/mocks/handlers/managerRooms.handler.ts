import { http, HttpResponse, delay } from 'msw';
import { getAuthSession } from '../../core/auth/authManager';
import { ROLES } from '../../core/constants/roles';
import type {
  RoomDto,
  RoomActivityDto,
  RoomListResponseDto,
} from '../../features/manager-rooms/types/manager-rooms.dto';

const API = '/api/v1';

function shouldMockError(requestUrl: string): boolean {
  try {
    const reqUrl = new URL(requestUrl);
    if (reqUrl.searchParams.get('mockError') === '1') {
      return true;
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.location) {
    try {
      const pageUrl = new URL(window.location.href);
      if (pageUrl.searchParams.get('mockError') === '1') {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function mockErrorResponse() {
  return HttpResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'محاكاة خطأ اختباري (mockError=1)',
        details: { field: 'mockError', issue: 'forced_test_error' },
      },
    },
    { status: 400 }
  );
}

// 24-character hex ID helper matching MongoDB ObjectId convention:
function makeHexRoomId(roomNumber: string): string {
  return `6acdc9c681d42a01709fc${roomNumber}`;
}

// Seed 36 rooms (3 floors x 12 rooms) matching Manager API Contract v1.2:
// 21 Standard (rack_rate 300.00), 15 VIP (rack_rate 850.00)
// Counts across hotel: Occupied 23 (21 occupied + 2 reserved), Available 7, Cleaning 3, Maintenance 3
export const mockRoomDtos: RoomDto[] = [
  // ===================== FLOOR 1 (Rooms 101 - 112) =====================
  {
    id: makeHexRoomId('101'),
    room_number: '101',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('102'),
    room_number: '102',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 102',
  },
  {
    id: makeHexRoomId('103'),
    room_number: '103',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 103',
  },
  {
    id: makeHexRoomId('104'),
    room_number: '104',
    floor: 1,
    room_type: 'standard',
    physical_status: 'DIRTY',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('105'),
    room_number: '105',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'RESERVED',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('106'),
    room_number: '106',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 106',
  },
  {
    id: makeHexRoomId('107'),
    room_number: '107',
    floor: 1,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 107',
  },
  {
    id: makeHexRoomId('108'),
    room_number: '108',
    floor: 1,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 108',
  },
  {
    id: makeHexRoomId('109'),
    room_number: '109',
    floor: 1,
    room_type: 'vip',
    physical_status: 'MAINTENANCE',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('110'),
    room_number: '110',
    floor: 1,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('111'),
    room_number: '111',
    floor: 1,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 111',
  },
  {
    id: makeHexRoomId('112'),
    room_number: '112',
    floor: 1,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'RESERVED',
    rack_rate: 850.00,
    current_guest: null,
  },

  // ===================== FLOOR 2 (Rooms 201 - 212) =====================
  {
    id: makeHexRoomId('201'),
    room_number: '201',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 201',
  },
  {
    id: makeHexRoomId('202'),
    room_number: '202',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 202',
  },
  {
    id: makeHexRoomId('203'),
    room_number: '203',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 203',
  },
  {
    id: makeHexRoomId('204'),
    room_number: '204',
    floor: 2,
    room_type: 'standard',
    physical_status: 'DIRTY',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('205'),
    room_number: '205',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 205',
  },
  {
    id: makeHexRoomId('206'),
    room_number: '206',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('207'),
    room_number: '207',
    floor: 2,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 207',
  },
  {
    id: makeHexRoomId('208'),
    room_number: '208',
    floor: 2,
    room_type: 'vip',
    physical_status: 'MAINTENANCE',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('209'),
    room_number: '209',
    floor: 2,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('210'),
    room_number: '210',
    floor: 2,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 210',
  },
  {
    id: makeHexRoomId('211'),
    room_number: '211',
    floor: 2,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 211',
  },
  {
    id: makeHexRoomId('212'),
    room_number: '212',
    floor: 2,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 212',
  },

  // ===================== FLOOR 3 (Rooms 301 - 312) =====================
  {
    id: makeHexRoomId('301'),
    room_number: '301',
    floor: 3,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 301',
  },
  {
    id: makeHexRoomId('302'),
    room_number: '302',
    floor: 3,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 302',
  },
  {
    id: makeHexRoomId('303'),
    room_number: '303',
    floor: 3,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('304'),
    room_number: '304',
    floor: 3,
    room_type: 'standard',
    physical_status: 'MAINTENANCE',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('305'),
    room_number: '305',
    floor: 3,
    room_type: 'standard',
    physical_status: 'DIRTY',
    occupancy_status: 'AVAILABLE',
    rack_rate: 300.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('306'),
    room_number: '306',
    floor: 3,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 306',
  },
  {
    id: makeHexRoomId('307'),
    room_number: '307',
    floor: 3,
    room_type: 'standard',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 300.00,
    current_guest: 'ضيف الغرفة 307',
  },
  {
    id: makeHexRoomId('308'),
    room_number: '308',
    floor: 3,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 308',
  },
  {
    id: makeHexRoomId('309'),
    room_number: '309',
    floor: 3,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
  {
    id: makeHexRoomId('310'),
    room_number: '310',
    floor: 3,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 310',
  },
  {
    id: makeHexRoomId('311'),
    room_number: '311',
    floor: 3,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'OCCUPIED',
    rack_rate: 850.00,
    current_guest: 'ضيف الغرفة 311',
  },
  {
    id: makeHexRoomId('312'),
    room_number: '312',
    floor: 3,
    room_type: 'vip',
    physical_status: 'CLEAN',
    occupancy_status: 'AVAILABLE',
    rack_rate: 850.00,
    current_guest: null,
  },
];

// Room activities database keyed by room ID / room number:
export const mockRoomActivitiesStore: Record<string, RoomActivityDto[]> = {
  [makeHexRoomId('202')]: [
    {
      id: 'act-202-1',
      action: 'تحديث حالة الغرفة',
      time: '2026-10-23T11:42:00+03:00',
      details: 'تم تأكيد حالة الغرفة',
      performed_by: 'أحمد محمود',
    },
    {
      id: 'act-202-2',
      action: 'بدأ التنظيف',
      time: '2026-10-23T09:15:00+03:00',
      details: 'أُسندت المهمة إلى سارة',
      performed_by: 'سارة إبراهيم',
    },
    {
      id: 'act-202-3',
      action: 'تسجيل المغادرة',
      time: '2026-10-22T14:30:00+03:00',
      details: 'تم إغلاق حساب الضيف',
      performed_by: 'فاطمة علي',
    },
  ],
  '202': [
    {
      id: 'act-202-1',
      action: 'تحديث حالة الغرفة',
      time: '2026-10-23T11:42:00+03:00',
      details: 'تم تأكيد حالة الغرفة',
      performed_by: 'أحمد محمود',
    },
    {
      id: 'act-202-2',
      action: 'بدأ التنظيف',
      time: '2026-10-23T09:15:00+03:00',
      details: 'أُسندت المهمة إلى سارة',
      performed_by: 'سارة إبراهيم',
    },
    {
      id: 'act-202-3',
      action: 'تسجيل المغادرة',
      time: '2026-10-22T14:30:00+03:00',
      details: 'تم إغلاق حساب الضيف',
      performed_by: 'فاطمة علي',
    },
  ],
  [makeHexRoomId('101')]: [
    {
      id: 'act-101-1',
      action: 'تأكيد الجاهزية',
      time: '2026-10-23T09:00:00+03:00',
      details: 'الغرفة نظيفة ومتاحة للحجز',
      performed_by: 'محمود حسن',
    },
  ],
  '101': [
    {
      id: 'act-101-1',
      action: 'تأكيد الجاهزية',
      time: '2026-10-23T09:00:00+03:00',
      details: 'الغرفة نظيفة ومتاحة للحجز',
      performed_by: 'محمود حسن',
    },
  ],
};

function getRoomActivitiesList(id: string): RoomActivityDto[] {
  if (mockRoomActivitiesStore[id]) {
    return mockRoomActivitiesStore[id];
  }
  // Try matching by the last 3 characters (room number):
  const roomNum = id.length >= 3 ? id.slice(-3) : id;
  if (mockRoomActivitiesStore[roomNum]) {
    return mockRoomActivitiesStore[roomNum];
  }
  return [
    {
      id: `act-${id}-default-1`,
      action: 'تأكيد حالة الغرفة',
      time: '2026-10-23T10:00:00+03:00',
      details: 'فحص دوري من قبل إدارة الفندق',
      performed_by: 'إدارة الفندق',
    },
    {
      id: `act-${id}-default-2`,
      action: 'فحص التجهيزات',
      time: '2026-10-23T08:30:00+03:00',
      details: 'اكتمال فحص التكييف والمرافق',
      performed_by: 'قسم الصيانة',
    },
  ];
}

export const managerRoomsHandlers = [
  // 1. GET /api/v1/rooms?page=1&limit=20
  http.get(`${API}/rooms`, async ({ request }) => {
    // The receptionist Rooms page (Sprint 1) calls the same endpoint and its status updates only know
    // the Sprint 1 rooms, so only the manager session gets this data; everyone else falls through.
    if (getAuthSession()?.role !== ROLES.manager) return undefined;

    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }

    await delay(350);

    const url = new URL(request.url);
    // If staff filter parameters (status or room_type) are present, let MSW fall through to the staff filter handler
    if (url.searchParams.has('status') || url.searchParams.has('room_type')) {
      return;
    }

    const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

    // Contract requirement: default limit is 20, maximum limit is 100
    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
    let limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : rawLimit;
    if (limit > 100) {
      limit = 100;
    }

    const total = mockRoomDtos.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageData = mockRoomDtos.slice(startIndex, endIndex).map((dto) => ({
      ...dto,
      room_id: Number(dto.room_number) || dto.id,
      status:
        dto.physical_status === 'MAINTENANCE' || dto.physical_status === 'OUT_OF_SERVICE'
          ? 'maintenance'
          : dto.occupancy_status === 'OCCUPIED'
            ? 'occupied'
            : dto.occupancy_status === 'RESERVED'
              ? 'reserved'
              : dto.physical_status === 'DIRTY'
                ? 'cleaning'
                : 'available',
      price_per_night: dto.rack_rate ?? 300,
      current_guest_name: dto.current_guest,
      description: dto.room_type === 'vip' ? 'VIP Room' : 'Standard Room',
      view: 'city',
      updated_at: '2026-10-23T08:00:00+03:00',
    })) as RoomDto[];

    const responseEnvelope: RoomListResponseDto = {
      data: pageData,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };

    return HttpResponse.json(responseEnvelope);
  }),

  // 2. GET /api/v1/rooms/:id/activities
  http.get(`${API}/rooms/:id/activities`, async ({ request, params }) => {
    if (shouldMockError(request.url)) {
      await delay(350);
      return mockErrorResponse();
    }

    await delay(350);

    const id = String(params.id);
    const activities = getRoomActivitiesList(id);

    return HttpResponse.json({
      data: activities,
      meta: {
        page: 1,
        limit: activities.length,
        total: activities.length,
        total_pages: 1,
      },
    });
  }),
];
