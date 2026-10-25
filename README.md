# Al-Amin Hotel Management & Intelligent Operations System
> **Sprint 2 Backend Release: Manager Module (Features M0 to M7)**

An enterprise-grade, full-stack Hotel Management & Intelligent Operations System designed specifically for Egyptian hotel operations with native bilingual Arabic (RTL) & English support, shift-based access controls, comprehensive front desk operations, and an advanced Manager Module with administrative oversight, workforce scheduling, room lifecycle tracking, and financial compliance.

---

## 🌟 Executive Summary: Sprint 2 Deliverables (M0 to M7)

This branch (`sprint_2_backend`) delivers the complete implementation and end-to-end integration of **Features M0 through M7** of the Manager Module, built against **Manager API Contract v1.2** and strict zero-regression constraints for existing receptionist operations (F0 to F14):

1. **M0: Foundation & Environment Setup**: Dual OpenAPI specifications, custom pagination (`paginateM`), error handling hierarchy, and role-based rate limiting.
2. **M1: Data Models & Schema Evolution**: 9 new Mongoose collections, backward-compatible model extensions, and database migration tooling.
3. **M2: Manager Authentication & Password Lifecycle**: 24/7 manager session access, self-service password changes, public password reset requests, and manager review queues.
4. **M3: Manager Notifications & Preferences**: Granular notification categories, read/unread states, bulk read operations, and automated event dispatching.
5. **M4: Staff Management (Employees Module)**: Comprehensive staff CRUD, Egyptian National ID encryption (`AES-256-GCM`) & HMAC indexing, role management hierarchy (`canManage`), soft deactivation, and session revocation.
6. **M5: Rooms, Room Types & Housekeeping**: Dynamic room type pricing aggregations, dual physical/occupancy room status mapping, multi-source room activity drawer, housekeeping task assignment, and critical maintenance triggers.
7. **M6: Shift Schedule & Baseline Materialization**: Dynamic shift scheduling, on-demand automated baseline materialization up to 62 days, Egyptian work week roster matrix (Saturday start), and abandoned shift force-closure.
8. **M7: Leave Requests & Segregation of Duties**: Receptionist leave submissions, manager decision workflow, database-level segregation of duties (`CANNOT_APPROVE_OWN_REQUEST`), and automated shift cancellation.
9. **Full Automated Test Coverage**: **82 dedicated manager test cases (100% passing)** alongside legacy receptionist regression suites.

---

## 🏗️ Architecture & Component Overview

```text
hotel-management/
├── backend/                              # Express 5 REST API
│   ├── openapi/                          # Dual OpenAPI 3.0.3 specifications
│   │   ├── staff-management-api.yaml     # Receptionist & Staff Operations API
│   │   └── manager-api.yaml              # Manager Module API Contract v1.2
│   ├── scripts/
│   │   └── manager-migrate.js            # Safe idempotent database migration script
│   ├── src/
│   │   ├── config/                       # Environment, encryption, and DB setup
│   │   ├── db/models/                    # Mongoose models with validation hooks
│   │   │   ├── ApprovalRequest.js        # M1: Approvals & Refund Requests
│   │   │   ├── CancellationSettlement.js # M1: Append-only cancellation settlements
│   │   │   ├── DailyClosing.js           # M1: Financial day closings
│   │   │   ├── LeaveRequest.js           # M1 & M7: Employee leave requests
│   │   │   ├── Notification.js           # M1 & M3: In-app manager notifications
│   │   │   ├── PasswordResetRequest.js   # M1 & M2: Password reset request queue
│   │   │   ├── RoomType.js               # M1 & M5: Room types & base rates
│   │   │   ├── Setting.js                # M1 & M12: Hotel & shift settings
│   │   │   ├── ShiftSchedule.js          # M1 & M6: Scheduled shifts & baseline
│   │   │   └── ...                       # Staff, Room, Reservation, Payment, etc.
│   │   ├── middleware/                   # Auth, role check, idempotency, noStore, rateLimit
│   │   ├── modules/
│   │   │   ├── auth/                     # Authentication & sessions
│   │   │   ├── manager/                  # Manager Module Core
│   │   │   │   ├── activities/           # Hotel-wide activity feed
│   │   │   │   ├── common/               # Mappers (room, shift, names, schedule)
│   │   │   │   ├── dashboard/            # KPI aggregations & statistics
│   │   │   │   ├── housekeeping/         # Cleaner assignments & task priority
│   │   │   │   ├── leaves/               # Manager leave decisions & receptionist route
│   │   │   │   ├── notifications/        # Preferences & notification inbox
│   │   │   │   ├── passwords/            # Password reset queue & decisions
│   │   │   │   ├── roomTypes/            # Room type configurations & aggregations
│   │   │   │   ├── rooms/                # Room list, updates & multi-source activity drawer
│   │   │   │   ├── shifts/               # Shifts overview, roster & force-close
│   │   │   │   └── staff/                # Staff CRUD, encryption, deactivation
│   │   │   └── notifications/notify.js   # Centralized notification dispatchers
│   │   └── utils/                        # Cairo time, money, paginateM, crypto
│   └── tests/
│       ├── manager/                      # Dedicated manager test suites (82 tests)
│       └── ...                           # Receptionist regression suites (F0 to F14)
│
└── frontend/                             # React 18 + Vite + TypeScript SPA
    └── src/
        ├── app/router/                   # ProtectedRoute & RoleRoute guards
        └── features/
            ├── auth/                     # Manager 24/7 login support
            ├── manager-dashboard/        # Connected to real backend dashboard data
            ├── manager-employees/        # Connected to /api/v1/manager/staff
            └── manager-rooms/            # Connected to /api/v1/manager/rooms
```

---

## 🔍 Detailed Breakdown of Implemented Features

### Feature M0: Foundation & Environment Setup
- **Multi-Role Support**: Expanded role definitions to `receptionist`, `manager`, `admin`, `housekeeper`, and `technician`.
- **Environment Configuration**: Added support for `MANAGER_SESSION_HOURS` (default: 12 hours) and `SCHEDULE_SOURCE` (`schedule` vs `legacy` for zero-downtime rollback safety).
- **Rate Limiting Architecture**:
  - `20 req/min`: Authentication and public password-reset requests.
  - `5 req/min`: Password changes.
  - `10 req/min`: Admin/Manager staff password resets.
  - `300 req/min`: General manager operations.
- **Custom Pagination (`paginateM`)**: Standardized pagination returning `{ data, meta: { total, page, limit, total_pages, has_next, has_prev } }`.
- **Dual OpenAPI Validation**: Configured `express-openapi-validator` to validate receptionist endpoints via `staff-management-api.yaml` and manager endpoints via `manager-api.yaml`.

---

### Feature M1: Data Models & Schema Evolution
- **New Collections**:
  - `ApprovalRequest`: Tracking cancellation, refund, upgrade, discount, and price override requests.
  - `CancellationSettlement`: Immutable, append-only record of refunds and retained amounts.
  - `DailyClosing`: Business day financial summaries with unique open-day invariant.
  - `LeaveRequest`: Staff leave requests with status lifecycle (`PENDING`, `APPROVED`, `REJECTED`).
  - `Notification`: In-app staff notifications with type, title, message, and read tracking.
  - `PasswordResetRequest`: Public password reset requests with staff lookup and verification codes.
  - `RoomType`: Hotel room categories, capacity, base rates, and amenities.
  - `Setting`: Dynamic hotel configurations (name, location, floor count, shift hours).
  - `ShiftSchedule`: Planned staff shifts supporting automated materialization.
- **Model Enhancements**:
  - `Staff`: Added `id_number_enc` (AES-256-GCM), `id_number_hash` (HMAC-SHA256 blind index), `id_number_last4`, `default_shift_type`, `hire_date`, `deactivated_at`, and `notification_prefs`.
  - `CleaningTask`: Added optional `cleaner_name` and `assigned_to_staff_id`.
  - `ShiftReport`: Added financial breakdown fields, operational counters, and `review_status` (`PENDING_REVIEW`, `APPROVED`, `NEEDS_REVIEW`).
- **Migration Script**: `backend/scripts/manager-migrate.js` with `--dry-run` capability to safely backfill default settings and indices.

---

### Feature M2: Manager Authentication & Password Lifecycle
- **24/7 Manager Login**: Unlike receptionists who require an active shift window, managers and admins can authenticate at any time (`requireShift` bypass).
- **Identity & Session (`GET /auth/me`)**: Returns user profile, active shift state, and current month audit stats (`audits_total`, `approvals_decided`, `resets_decided`).
- **Self-Service Password Change (`POST /auth/change-password`)**: Validates current password, updates Argon2 hash, records `password_changed_at`, and revokes all other active sessions.
- **Forgotten Password Queue**:
  - Public `POST /auth/password-reset-requests`: Staff submits username/identifier and Egyptian phone number.
  - Manager `GET /manager/password-reset-requests`: List pending requests with optional `status` filter (`PENDING`, `APPROVED`, `REJECTED`, `ALL`).
  - Manager `PATCH /manager/password-reset-requests/:id/decision`: Approving generates a secure temporary password and revokes existing sessions; rejecting records the decision. Both decisions dispatch notifications.

---

### Feature M3: Manager Notifications & Preferences
- **Notification Inbox**:
  - `GET /manager/notifications`: Filterable by `is_read` and notification `type` (`APPROVAL_REQUEST`, `LEAVE_REQUEST`, `CRITICAL_MAINTENANCE`, `SHIFT_REPORT_SUBMITTED`, `SYSTEM`).
  - `PATCH /manager/notifications/:id/read`: Marks an individual notification as read.
  - `POST /manager/notifications/read-all`: Atomically marks all pending notifications as read.
- **Preferences Management**:
  - `GET /manager/notifications/preferences`: Retrieves current user's alert toggle settings.
  - `PATCH /manager/notifications/preferences`: Granularly updates notification delivery preferences.
- **Central Dispatchers**:
  - `notifyManagers(...)`: Broadcasts alerts to all active managers respecting individual preference toggles.
  - `notifyStaff(...)`: Sends direct transaction-safe notifications to targeted employees.

---

### Feature M4: Staff Management (Employees Module)
- **Zero Per-Row Queries**: All listing and detail endpoints use batch lookups for today's shifts and 7-day workload calculations.
- **Endpoints**:
  - `GET /manager/staff`: Query filters for `staff_type`, `department`, `is_active`, Arabic/Latin name search `q`, `on_shift` status, and `include=today_shift,workload`.
  - `POST /manager/staff`: Idempotent staff creation with temporary password generation, AES-256-GCM encryption for 14-digit Egyptian National ID, and duplicate prevention.
  - `GET /manager/staff/:id`: Returns full staff DTO with workload and shift context.
  - `PATCH /manager/staff/:id`: Updates profile, department, contact info (with Egyptian phone normalization), and default shift types.
  - `DELETE /manager/staff/:id` (Soft Deactivation): Enclosed in a MongoDB transaction:
    - Revokes all active user sessions.
    - Cancels future scheduled shifts with reason `STAFF_DEACTIVATED`.
    - Enforces safety rules: cannot deactivate oneself; cannot deactivate if an active shift is in progress; cannot deactivate the last active manager/admin.
  - `POST /manager/staff/:id/reactivate`: Restores staff member to active status.
  - `POST /manager/staff/:id/reset-password`: Generates fresh credentials and revokes sessions (returns `Cache-Control: no-store`).
- **Role Hierarchy (`canManage`)**: Admin can manage all roles; Manager can manage Receptionists, Housekeepers, and Technicians only.

---

### Feature M5: Rooms, Room Types & Housekeeping
- **Room Types Management**:
  - `GET /manager/room-types`: Merges room types with real-time room count and price range (`price_min`, `price_max`) via MongoDB aggregations.
  - `POST /manager/room-types` & `PATCH /manager/room-types/:id`: Validates base pricing, capacity, and amenities. Renaming a type automatically synchronizes all assigned rooms in the same transaction.
- **Dual Room Status Mapper (`common/room.mapper.js`)**:
  - Translates database representation (`available`, `occupied`, `cleaning`, `maintenance`, `out_of_service` + `inspected: Boolean`) to Contract format:
    - **Physical Status**: `CLEAN`, `DIRTY`, `INSPECTED`, `MAINTENANCE`, `OUT_OF_SERVICE`.
    - **Occupancy Status**: `VACANT`, `OCCUPIED`, `RESERVED`.
  - Batch `occupancyMap` resolution populating live guest names for checked-in rooms.
- **Room Management & Multi-Source Activity Drawer**:
  - `GET /manager/rooms`: Filter by floor, room type, physical status, occupancy status, or room number.
  - `PATCH /manager/rooms/:room_id`: Update rack rates, floor, room type, or physical status (guards against modifying physical status of occupied rooms with `409 CONFLICT`).
  - `GET /manager/rooms/:id/activities`: Chronological feed merging cleaning tasks, maintenance issues, and reservation stays for that room.
- **Housekeeping Queue & Task Assignment**:
  - `GET /manager/housekeeping-tasks`: List pending/completed cleaning tasks with priority mapping (`LOW`, `NORMAL`, `HIGH`, `RUSH`).
  - `PATCH /manager/housekeeping-tasks/:id/assign`: Assign cleaner and escalate priority (prevents lowering priority or reassigning completed tasks).
- **Receptionist Event Hooks**:
  - Receptionist room status updates automatically reset `inspected = false`.
  - Receptionist critical maintenance issues automatically dispatch `CRITICAL_MAINTENANCE` manager alerts.

---

### Feature M6: Shift Schedule & Baseline Materialization
- **Automated Baseline Materialization (`ensureBaseline`)**:
  - Eliminates manual scheduling overhead by automatically materializing `ShiftSchedule` records from each receptionist's `default_shift_type` on demand up to 62 days ahead.
  - Respects past dates (never alters historical records) and respects manager cancellations (cancelled dates remain cancelled).
- **Cairo Time Shift Windows (`utils/time.js`)**:
  - Accurate calculation of Morning (07:00–16:00), Evening (16:00–23:00), and Night (23:00–07:00 next day) shift bounds.
- **Egyptian Calendar Roster Matrix**:
  - Roster week starts on **Saturday** (`WEEK_START = 6`).
  - `GET /manager/shifts/roster`: Matrix view displaying staff members, scheduled shift cells, leave overlays, and department coverage metrics.
- **Shift Operations**:
  - `GET /manager/shifts/overview`: Real-time coverage cards with `COVERED` vs `UNCOVERED` warnings.
  - `POST /manager/shifts`: Conflict detection (`409 SHIFT_OVERLAP`), leave conflict detection, and reactivation of previously cancelled slots.
  - `PATCH /manager/shifts/:id` & `DELETE /manager/shifts/:id`: Modification allowed only before shift start (`409 SHIFT_ALREADY_STARTED` once started).
  - `POST /manager/shifts/:id/force-close`: Force-closes abandoned desk shifts, records justification, and revokes staff sessions.

---

### Feature M7: Leave Requests & Segregation of Duties
- **Receptionist Leave Request (`POST /api/v1/leave-requests`)**:
  - Request submission for `ANNUAL`, `SICK`, `UNPAID`, or `EMERGENCY` leave up to 60 days in advance.
  - Overlap validation against existing pending/approved leaves and rate limit of max 5 pending requests.
  - Automatically notifies managers upon submission.
- **Manager Leave Queue & Conflicts**:
  - `GET /manager/leave-requests`: Filterable by status (`PENDING`, `APPROVED`, `REJECTED`, `ALL`), employee, and date ranges.
  - `GET /manager/leave-requests/:id`: Shows requested dates, scheduled shift conflicts in the period, and department coverage hints.
- **Decision Engine (`PATCH /manager/leave-requests/:id/decision`)**:
  - **Database-Level Segregation of Duties**: Enforces `{ staff_id: { $ne: me } }` directly in the MongoDB atomic update filter, returning `403 CANNOT_APPROVE_OWN_REQUEST`.
  - Rejection requires a descriptive `manager_comment`.
  - Approval with `cancel_scheduled_shifts: true` automatically cancels future scheduled shifts with reason `LEAVE_APPROVED` while safely protecting active shifts.
  - Sends immediate `LEAVE_DECISION` notification to the requesting employee.

---

## 🧪 Automated Testing & Verification

The test suite validates every endpoint, role check, concurrency condition, and business rule:

```bash
# Run all manager test suites
npx jest tests/manager/

# Run individual feature suites
npx jest tests/manager/auth.test.js           # 20 passed (M0, M2, M3)
npx jest tests/manager/staff.test.js          # 20 passed (M4 Staff CRUD, encryption, deactivation)
npx jest tests/manager/rooms.test.js          # 14 passed (M5 Room types, rooms, housekeeping)
npx jest tests/manager/shifts.test.js         # 15 passed (M6 Scheduling, baseline, roster)
npx jest tests/manager/leave.test.js          # 13 passed (M7 Leave requests, segregation of duties)

# Run legacy receptionist regression suites
npx jest tests/f3.test.js                    # 13 passed (Receptionist shift & login)
npx jest tests/f5.test.js                    # 20 passed (Receptionist room statuses)
```

### Combined Test Results:
- **Manager Test Suites:** 5 passed, 5 total
- **Manager Tests:** **82 passed, 82 total (100% pass rate)**
- **Receptionist Regressions:** 0 regressions, all legacy tests green.

---

## 🚀 Running the Project Locally

### 1. Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend server runs on `http://127.0.0.1:5000`. Swagger API documentation is available at `http://127.0.0.1:5000/docs`.

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```
The frontend dev server runs on `http://localhost:5173`.

### 3. Manager Credentials for Testing
- **Manager Username:** `mina_mgr` (or seeded `manager`)
- **Password:** `Admin@123456`
- **Role:** `manager` / `admin` (Unrestricted 24/7 login access)

---

## 📄 License & Attribution
Developed for **Al-Amin Hotel Management System**. All rights reserved.
