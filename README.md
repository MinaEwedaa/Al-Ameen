# Hotel Management & Intelligent Operations System

Welcome to the backend foundation for the **Hotel Management & Intelligent Operations System**. This initial release provides the core infrastructure, database architecture, and data models focusing on the **Staff Management** module, room statuses, housekeeping workflows, and maintenance operations.

---

## Tech Stack

- **Runtime & Framework:** Node.js (LTS) with Express
- **Database & ODM:** MongoDB Atlas accessed via Mongoose
- **Security & Utilities:** `bcrypt` (password hashing), `dotenv` (environment configuration), `cors` (Cross-Origin Resource Sharing)
- **Developer Tools:** `nodemon` (live reload during development)
- **Module System:** CommonJS (`require` / `module.exports`)

---

## Project Structure

This project is set up as a monorepo containing backend services and prepared for frontend integration:

```text
hotel-management/
├── .gitignore
├── README.md
├── api/
│   └── staff-management-api.yaml # OpenAPI 3.0.3 specification for Receptionist API
├── backend/
│   ├── .env                    # Real environment variables (NEVER committed)
│   ├── .env.example            # Placeholder environment template (committed)
│   ├── package.json            # Backend scripts and dependencies
│   ├── package-lock.json
│   ├── server.js               # Express application entry point
│   ├── config/
│   │   └── db.js               # MongoDB connection handler
│   ├── models/
│   │   ├── Room.js             # Room entity with status index
│   │   ├── Staff.js            # Staff accounts with bcrypt helpers
│   │   ├── Shift.js            # Staff shift scheduling with time validation
│   │   ├── CleaningTask.js     # Housekeeping tasks linked to Staff & Room
│   │   └── MaintenanceIssue.js # Room issues with priority/status tracking
│   ├── routes/                 # Express route handlers (.gitkeep, empty for now)
│   ├── controllers/            # Controller logic (.gitkeep, empty for now)
│   └── scripts/
│       └── seed.js             # Idempotent development database seeder
└── frontend/                   # Frontend workspace (.gitkeep, reserved for future sprints)
```

---

## Setup Instructions

Follow these steps to set up the development environment locally:

### 1. Clone the repository
```bash
git clone <repository-url>
cd hotel-management
```

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Configure environment variables
Copy the template `.env.example` to create your local `.env`:
```bash
# On Windows (cmd/PowerShell):
copy .env.example .env

# On macOS/Linux:
cp .env.example .env
```

Open `backend/.env` and configure:
```env
PORT=5000
MONGO_URI=<ask-project-owner-for-the-real-connection-string>
```

> ⚠️ **Important:** Never hardcode credentials in any code file. Ask the project owner for the valid MongoDB Atlas connection string. Never share or commit `.env`.

### 4. Run the development server
```bash
npm run dev
```
The server will connect to MongoDB Atlas and listen at `http://localhost:5000`. You should see:
```text
MongoDB connected: <cluster-host>
Server running on port 5000
```

### 5. Seed initial data (optional)
To populate your MongoDB database with sample rooms, staff, shifts, cleaning tasks, and maintenance issues:
```bash
npm run seed
```
> *Note:* The seed script is idempotent and protected—it will refuse to run if `NODE_ENV === 'production'`.

---

## Conventions & Team Guidelines

All contributors must adhere to the following standards to ensure consistency and maintainability across the codebase:

### Architectural & Naming Conventions
- **One model per file:** Every Mongoose model resides in its own dedicated file under `backend/models/`.
- **PascalCase model names:** File names and model registrations must use PascalCase (e.g., `Room.js`, `Staff.js`, `CleaningTask.js`).
- **snake_case schema fields:** All document attributes use snake_case (e.g., `room_number`, `shift_notes`, `start_time`, `password_hash`).
- **No manual ID fields:** Do not create manual `room_id`, `staff_id`, etc. MongoDB's native `_id` acts as the unique identifier.
- **ObjectId references:** Always use Mongoose `ObjectId` references (`ref: '<Model>'`) rather than storing names or foreign identifiers as raw strings.
- **Automatic timestamps:** All schemas include `{ timestamps: true }` for automated `createdAt` and `updatedAt` tracking.

### Git & Security Workflow
- **Branching strategy:** Create one feature branch per task using the pattern `feature/<name>` (e.g., `feature/staff-auth`, `feature/booking-model`).
- **Zero credential leaks:** Never commit `.env` files. The `.gitignore` file is strictly configured to ignore `.env`, `node_modules/`, and logs.
- **Never log sensitive data:** Never print `MONGO_URI`, passwords, or password hashes to terminal logs or error reports.

### How to Add a New Model
When creating additional entities (e.g., Bookings, Guests, Invoices):
1. Create a new file under `backend/models/<ModelName>.js`.
2. Follow the existing model structure:
   ```javascript
   const mongoose = require('mongoose');

   const exampleSchema = new mongoose.Schema(
     {
       name: {
         type: String,
         required: [true, 'Name is required'],
         trim: true,
       },
       related_entity: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Staff',
         required: true,
       },
     },
     {
       timestamps: true,
     }
   );

   // Add necessary indexes
   exampleSchema.index({ name: 1 });

   module.exports = mongoose.model('Example', exampleSchema);
   ```
3. Test your model queries and indexes locally before submitting a Pull Request.
