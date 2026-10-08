require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Staff = require('../models/Staff');
const Shift = require('../models/Shift');
const CleaningTask = require('../models/CleaningTask');
const MaintenanceIssue = require('../models/MaintenanceIssue');

const seedData = async () => {
  // Safety check: refuse to run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Safety check failed: Seeding is strictly forbidden in production!');
    process.exit(1);
  }

  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<username>')) {
    console.error('Error: Please provide a valid MONGO_URI in .env before running the seed script.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB for database seeding...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB successfully.');

    // Clear existing collections to ensure idempotency
    console.log('Clearing existing collections...');
    await Room.deleteMany({});
    await Staff.deleteMany({});
    await Shift.deleteMany({});
    await CleaningTask.deleteMany({});
    await MaintenanceIssue.deleteMany({});
    console.log('Cleared Room, Staff, Shift, CleaningTask, and MaintenanceIssue collections.');

    // 1. Insert 6 Rooms (mix of VIP and Normal with various statuses)
    const rooms = await Room.insertMany([
      {
        room_number: '101',
        room_type: 'VIP',
        status: 'Available',
        description: 'Presidential suite with panoramic city view and king-size bed.',
      },
      {
        room_number: '102',
        room_type: 'Normal',
        status: 'Occupied',
        description: 'Deluxe double room with garden view.',
      },
      {
        room_number: '103',
        room_type: 'Normal',
        status: 'Reserved',
        description: 'Standard single room on the quiet floor.',
      },
      {
        room_number: '201',
        room_type: 'VIP',
        status: 'Cleaning',
        description: 'Executive suite with private balcony and jacuzzi.',
      },
      {
        room_number: '202',
        room_type: 'VIP',
        status: 'Under Maintenance',
        description: 'Penthouse master suite with skyline terrace.',
      },
      {
        room_number: '203',
        room_type: 'Normal',
        status: 'Available',
        description: 'Standard twin room near the elevator.',
      },
    ]);
    console.log(`Seeded ${rooms.length} rooms.`);

    // 2. Insert 3 Staff members with bcrypt-hashed passwords
    const defaultPassword = 'Password123';
    const passwordHash = await Staff.hashPassword(defaultPassword);

    const staffMembers = await Staff.insertMany([
      {
        username: 'john_manager',
        name: 'John Miller',
        password_hash: passwordHash,
      },
      {
        username: 'sarah_cleaner',
        name: 'Sarah Connor',
        password_hash: passwordHash,
      },
      {
        username: 'alex_tech',
        name: 'Alex Murphy',
        password_hash: passwordHash,
      },
    ]);

    console.log(`Seeded ${staffMembers.length} staff members (default password: "${defaultPassword}"):`);
    staffMembers.forEach((member) => {
      console.log(` - Username: ${member.username} | Name: ${member.name}`);
    });

    // 3. Insert 2 Shifts
    const today = new Date();
    const morningStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0);
    const morningEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0);
    const eveningStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0);
    const eveningEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0, 0);

    const shifts = await Shift.insertMany([
      {
        staff: staffMembers[0]._id, // John Miller
        shift_notes: 'Morning shift overseeing front desk operations and VIP check-ins.',
        start_time: morningStart,
        end_time: morningEnd,
      },
      {
        staff: staffMembers[1]._id, // Sarah Connor
        shift_notes: 'Housekeeping floor 2 turnover and evening refresh.',
        start_time: eveningStart,
        end_time: eveningEnd,
      },
    ]);
    console.log(`Seeded ${shifts.length} shifts.`);

    // 4. Insert 3 Cleaning Tasks linked to real room and staff IDs
    const cleaningTasks = await CleaningTask.insertMany([
      {
        room: rooms[3]._id, // Room 201 (VIP, Cleaning)
        assigned_to: staffMembers[1]._id, // Sarah Connor
        priority: 'High',
        status: 'Assigned',
        notes: 'VIP checkout cleaning. Restock premium amenities and change bath linens.',
        assigned_date: new Date(),
      },
      {
        room: rooms[1]._id, // Room 102 (Occupied)
        assigned_to: staffMembers[1]._id, // Sarah Connor
        priority: 'Medium',
        status: 'Pending',
        notes: 'Daily stay-over tidy service requested by guest.',
        assigned_date: new Date(),
      },
      {
        room: rooms[0]._id, // Room 101 (Available)
        assigned_to: staffMembers[1]._id,
        priority: 'Low',
        status: 'Completed',
        notes: 'Routine pre-arrival dusting and inspection verified.',
        assigned_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        finished_date: new Date(),
      },
    ]);
    console.log(`Seeded ${cleaningTasks.length} cleaning tasks.`);

    // 5. Insert 2 Maintenance Issues linked to real room IDs
    const maintenanceIssues = await MaintenanceIssue.insertMany([
      {
        room: rooms[4]._id, // Room 202 (Under Maintenance)
        problem: 'Air conditioning unit leaking water onto carpet and emitting noise',
        priority: 'Critical',
        status: 'In Progress',
        notes: 'Compressor pipe gasket inspected. Replacement part arriving this afternoon.',
        created_date: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        room: rooms[2]._id, // Room 103 (Reserved)
        problem: 'Bathroom sink faucet handle loose and dripping',
        priority: 'Medium',
        status: 'Open',
        notes: 'Reported during pre-check inspection; scheduled for repair before guest arrival.',
        created_date: new Date(),
      },
    ]);
    console.log(`Seeded ${maintenanceIssues.length} maintenance issues.`);

    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Seeding process failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(process.exitCode || 0);
  }
};

seedData();
