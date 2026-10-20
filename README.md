# Al-Amin Hotel Management & Intelligent Operations System
> **Sprint 1 Production Release**

An enterprise-grade, full-stack Hotel Management & Staff Operations System designed specifically for Egyptian hotel operations with native bilingual Arabic (RTL) & English support, shift-based access controls, complete front desk lifecycle management, and strict financial compliance.

---

## 🌟 Executive Summary: Sprint 1 Deliverables

Sprint 1 delivers a complete, secure, and rigorously tested foundation spanning both modern web frontend and robust backend services:

1. **Shift-Enforced Receptionist Security & Authentication** — Role-based access with Cairo timezone shift windows (Morning, Evening, Night), early read-only window, and single-session enforcement.
2. **Interactive Front Desk Operations (Phases 1–4)**:
   - **Phase 1: Stay Folio & Reservation Lookup** — Real-time lookup by room number or booking ID, complete stay folios with nested guests, rooms, and multi-shift payment history.
   - **Phase 2: Check-In Flow** — Down-payment requirement (`PAYMENT_REQUIRED`), early arrival calculation before 12:00 noon, and room occupancy transitions.
   - **Phase 3: Extend Stay Flow** — Same-day conflict detection, half-day extension fee calculation, and automated stay adjustments.
   - **Phase 4: Check-Out Flow** — Remaining balance settlement lock (`BALANCE_DUE`), transition to cleaning, and auto-dispatch of housekeeping tasks.
3. **Payments, Receipts & Thermal Voucher Printing**:
   - Multi-method payment capture (Cash, InstaPay, Vodafone Cash) linked to active shifts.
   - Front desk room balance auto-check and room selector.
   - Beautiful, bilingual Printable Receipt Voucher with QR/barcode aesthetics and matching direct PDF export.
4. **Housekeeping & Maintenance**:
   - Cleaning task creation, priority assignment, and status updates.
   - Maintenance issue reporting with status resolution tracking.
5. **Egyptian Localization & Data Privacy**:
   - Masked Egyptian National IDs (`**********1234`) and E.164 phone normalization (`+20...`).
   - Egyptian hotel stay days (12:00 PM to 12:00 PM noon Cairo time).
6. **Append-Only Tamper-Evident Audit Logging**:
   - Immutable audit trail recording every check-in, extension, check-out, and financial action.
7. **Comprehensive Test Coverage**:
   - **19 test suites, 253 unit & integration tests passing (100% pass rate)**.

---

## 🏗️ System Architecture

```text
hotel-management/
├── backend/                              # Node.js + Express REST API
│   ├── openapi/                          # OpenAPI 3.0.3 specification
│   │   └── staff-management-api.yaml
│   ├── src/
│   │   ├── config/                       # Environment, encryption, and DB setup
│   │   ├── db/
│   │   │   ├── connect.js                # MongoDB connection handler
│   │   │   └── models/                   # Mongoose models with validation hooks
│   │   ├── middleware/                   # Auth, shift validation, idempotency, rate limiting
│   │   ├── modules/
│   │   │   ├── auth/                     # Authentication & session management
│   │   │   ├── shifts/                   # Shift windows, attendance, handover
│   │   │   ├── rooms/                    # Room inventory, statuses, history
│   │   │   ├── guests/                   # Egyptian ID encryption & phone normalization
│   │   │   ├── reservations/             # Folio, check-in, extend, check-out
│   │   │   ├── payments/                 # Shift collections, vouchers, balances
│   │   │   ├── cleaning/                 # Housekeeping tasks
│   │   │   ├── maintenance/              # Maintenance tickets
│   │   │   ├── reports/                  # Automated PDF & shift reports
│   │   │   └── audit/                    # Tamper-evident audit logging
│   │   └── utils/                        # Cairo time, money conversion, crypto
│   └── tests/                            # 19 Jest & Supertest suites (253 tests)
│
├── frontend/                             # React 18 + Vite + TypeScript SPA
│   ├── src/
│   │   ├── app/                          # Main router and layout
│   │   ├── core/
│   │   │   └── i18n/                     # Bilingual translations (ar.json / en.json)
│   │   ├── features/
│   │   │   ├── auth/                     # Login & shift handover screens
│   │   │   ├── dashboard/                # Receptionist operational dashboard
│   │   │   ├── rooms/                    # Interactive room status grid
│   │   │   ├── guests/                   # Guest directory & quick search
│   │   │   ├── reservations/             # Reservation management
│   │   │   ├── payments/                 # Payment drawer, Thermal Voucher, PDF export
│   │   │   ├── housekeeping/             # Room cleaning dispatch
│   │   │   └── maintenance/              # Maintenance issue tracker
│   │   └── mocks/                        # MSW (Mock Service Worker) for offline dev
│   └── public/                           # Static assets
└── README.md                             # Project documentation
```

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js 5
- **Database & ODM:** MongoDB Atlas via Mongoose 9
- **Security:**
  - Password Hashing: `Argon2id`
  - National ID Protection: `AES-256-GCM` authenticated encryption + HMAC blind indexing
  - Token Auth: `jsonwebtoken` (JWT) with HTTP-only cookies
  - Sanitization: Mongoose `sanitizeFilter` & Helmet security headers
- **Timezone Management:** `Luxon` locked to `Africa/Cairo`
- **Testing:** Jest & Supertest (253 tests across 19 suites)
- **API Specification:** OpenAPI 3.0.3 with `express-openapi-validator` & Swagger UI

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Vanilla CSS & Tailwind CSS with RTL/LTR responsive architecture
- **Internationalization:** `i18next` with complete Arabic (`ar`) and English (`en`) support
- **Icons & UI:** `lucide-react`
- **State & Networking:** Axios with custom idempotency headers & MSW handlers

---

## 📋 Front Desk Counter Operations Flow

```
[Guest Arrives at Counter]
         │
         ▼
[Phase 1: Folio Lookup] ──► Search by Room Number (e.g., "505") or Booking ID
         │                  Inspect total, paid deposit, remaining balance, guest details
         │
         ▼
[Payment Recording]     ──► Collect deposit via Cash / InstaPay / Vodafone Cash
         │                  Print thermal receipt voucher or download PDF
         │
         ▼
[Phase 2: Check-In]     ──► Verify ID & paid deposit (>= 1 payment required)
         │                  Early arrival calculation if arriving before 12:00 noon
         │                  Room transitions to 'occupied'
         │
         ▼
[Phase 3: Extend Stay]  ──► Optional: guest requests late checkout past 12:00
         │                  Verifies no incoming conflict on checkout day
         │                  Adds half-day fee to total & remaining amounts
         │
         ▼
[Phase 4: Check-Out]    ──► Verify balance is 0.00 EGP (blocked if balance remains)
                            Reservation marked 'checked_out'
                            Room transitions to 'cleaning'
                            Housekeeping task automatically generated
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- MongoDB instance (local or MongoDB Atlas)
- Git

### 1. Backend Setup

```bash
cd backend
npm install
```

Configure your environment variables in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/hotel_management
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
ID_ENC_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ID_HMAC_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

Start backend development server:
```bash
npm run dev
```
API runs on `http://localhost:5000`. Swagger documentation available at `http://localhost:5000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5174` (or `http://localhost:5173`).

---

## 🧪 Test Suite Verification

Run the comprehensive automated test suite in the backend:

```bash
cd backend
npm test
```

**Results:**
- **Test Suites:** 19 passed, 19 total
- **Tests:** 253 passed, 253 total
- **Snapshots:** 0 total
- **Execution:** 100% green without regressions

---

## 📄 License
Internal proprietary hotel management system developed for Al-Amin Hotel. All rights reserved.
