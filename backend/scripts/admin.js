#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Load environment: prioritize .env.admin if present, fallback to .env
const adminEnvPath = path.resolve(__dirname, '../.env.admin');
const defaultEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(adminEnvPath)) {
  dotenv.config({ path: adminEnvPath });
} else {
  dotenv.config({ path: defaultEnvPath });
}

const { connectDB } = require('../src/db/connect');
const staffCmds = require('./admin/staff');
const roomCmds = require('./admin/rooms');
const shiftCmds = require('./admin/shifts');
const paymentCmds = require('./admin/payments');
const { guard } = require('./admin/guard');

async function main() {
  const cli = yargs(hideBin(process.argv))
    .scriptName('admin')
    .usage('$0 <command> [options]')
    .demandCommand(1, 'Please specify a command to execute.')
    .strict()
    .help();

  // 1. create-staff
  cli.command(
    'create-staff',
    'Create a new staff member account and generate initial password',
    (y) =>
      y
        .option('username', { type: 'string', demandOption: true, describe: 'Staff username' })
        .option('name', { type: 'string', demandOption: true, describe: 'Full staff name' })
        .option('shift-type', {
          type: 'string',
          demandOption: true,
          choices: ['morning', 'evening', 'night'],
          describe: 'Default shift type',
        })
        .option('role', { type: 'string', default: 'receptionist', describe: 'Staff role' })
        .option('password', { type: 'string', describe: 'Explicit password (random if omitted)' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await staffCmds.createStaff({
        username: argv.username,
        name: argv.name,
        shiftType: argv['shift-type'],
        role: argv.role,
        password: argv.password,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log('✓ Staff created successfully:');
      console.log(`  Staff ID: ${res.staff_id}`);
      console.log(`  Username: ${res.username}`);
      console.log(`  Password: ${res.password} (Printed once - store securely!)`);
    }
  );

  // 2. disable-staff
  cli.command(
    'disable-staff',
    'Deactivate staff account and immediately revoke all active sessions',
    (y) =>
      y
        .option('username', { type: 'string', demandOption: true, describe: 'Staff username' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await staffCmds.disableStaff({
        username: argv.username,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Staff account '${res.username}' disabled and sessions revoked.`);
    }
  );

  // 3. reset-password
  cli.command(
    'reset-password',
    'Reset password for staff member, revoke old sessions, and clear lockouts',
    (y) =>
      y
        .option('username', { type: 'string', demandOption: true, describe: 'Staff username' })
        .option('password', { type: 'string', describe: 'New password (random if omitted)' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await staffCmds.resetPassword({
        username: argv.username,
        password: argv.password,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Password reset for '${res.username}':`);
      console.log(`  New Password: ${res.password} (Sessions revoked, lockout cleared)`);
    }
  );

  // 4. unlock-account
  cli.command(
    'unlock-account',
    'Clear lockout status and reset failed login attempts counter',
    (y) =>
      y
        .option('username', { type: 'string', demandOption: true, describe: 'Staff username' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await staffCmds.unlockAccount({
        username: argv.username,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Account '${res.username}' unlocked.`);
    }
  );

  // 5. create-room
  cli.command(
    'create-room',
    'Add a new room to inventory',
    (y) =>
      y
        .option('room-number', { type: 'string', demandOption: true, describe: 'Room number (e.g. 101)' })
        .option('room-type', {
          type: 'string',
          demandOption: true,
          choices: ['single', 'double', 'deluxe', 'suite'],
          describe: 'Room type',
        })
        .option('floor', { type: 'number', demandOption: true, describe: 'Floor number' })
        .option('price', { type: 'number', demandOption: true, describe: 'Price per night in EGP' })
        .option('half-day-price', { type: 'number', describe: 'Half day price in EGP' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await roomCmds.createRoom({
        roomNumber: argv['room-number'],
        roomType: argv['room-type'],
        floor: argv.floor,
        price: argv.price,
        halfDayPrice: argv['half-day-price'],
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Room ${res.room_number} created with price ${res.price_per_night} EGP.`);
    }
  );

  // 6. set-room
  cli.command(
    'set-room',
    'Update room price, half-day price, or status',
    (y) =>
      y
        .option('room-number', { type: 'string', demandOption: true, describe: 'Room number' })
        .option('price', { type: 'number', describe: 'Updated price per night in EGP' })
        .option('half-day-price', { type: 'number', describe: 'Updated half day price in EGP' })
        .option('status', {
          type: 'string',
          choices: ['available', 'occupied', 'cleaning', 'maintenance'],
          describe: 'Room status',
        })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await roomCmds.setRoom({
        roomNumber: argv['room-number'],
        price: argv.price,
        halfDayPrice: argv['half-day-price'],
        status: argv.status,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Room ${res.room_number} updated: price=${res.price_per_night} EGP, status=${res.status}.`);
    }
  );

  // 7. add-exception
  cli.command(
    'add-exception',
    'Add a shift schedule exception (cancel, swap, extra)',
    (y) =>
      y
        .option('username', { type: 'string', demandOption: true, describe: 'Staff username' })
        .option('date', { type: 'string', demandOption: true, describe: 'Shift date (YYYY-MM-DD)' })
        .option('shift-type', {
          type: 'string',
          demandOption: true,
          choices: ['morning', 'evening', 'night'],
          describe: 'Shift type',
        })
        .option('kind', {
          type: 'string',
          demandOption: true,
          choices: ['cancel', 'swap', 'extra'],
          describe: 'Exception kind',
        })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await shiftCmds.addException({
        username: argv.username,
        date: argv.date,
        shiftType: argv['shift-type'],
        kind: argv.kind,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Shift exception '${res.kind}' recorded for ${res.username} on ${res.shift_date}.`);
    }
  );

  // 8. reopen-shift
  cli.command(
    'reopen-shift',
    'Reopen an accidentally closed/handed-over shift and delete old report',
    (y) =>
      y
        .option('shift-id', { type: 'string', demandOption: true, describe: 'Shift ID to reopen' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await shiftCmds.reopenShift({
        shiftId: argv['shift-id'],
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Shift ${res.shift_id} reopened to '${res.status}'. Previous report cleared.`);
    }
  );

  // 9. reverse-payment
  cli.command(
    'reverse-payment',
    'Reverse a payment with negative entry and paid_cache correction',
    (y) =>
      y
        .option('payment-id', { type: 'string', demandOption: true, describe: 'Payment ID to reverse' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await paymentCmds.reversePayment({
        paymentId: argv['payment-id'],
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Payment ${res.original_payment_id} reversed:`);
      console.log(`  Reversal Payment ID: ${res.reversal_payment_id}`);
      console.log(`  Reversed Amount: ${res.reversed_amount} EGP`);
    }
  );

  // 10. add-payment
  cli.command(
    'add-payment',
    'Add an administrative corrective payment linked to reservation and shift',
    (y) =>
      y
        .option('reservation-id', { type: 'string', demandOption: true, describe: 'Reservation ID' })
        .option('amount', { type: 'number', demandOption: true, describe: 'Payment amount in EGP' })
        .option('method', {
          type: 'string',
          demandOption: true,
          choices: ['cash', 'instapay', 'vodafone_cash'],
          describe: 'Payment method',
        })
        .option('shift-id', { type: 'string', demandOption: true, describe: 'Shift ID' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await paymentCmds.addPayment({
        reservationId: argv['reservation-id'],
        amount: argv.amount,
        method: argv.method,
        shiftId: argv['shift-id'],
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Corrective payment added: ${res.amount} EGP via ${res.payment_method}. Remaining balance: ${res.remaining_balance} EGP.`);
    }
  );

  // 11. regenerate-report
  cli.command(
    'regenerate-report',
    'Regenerate shift PDF report for a completed shift',
    (y) =>
      y
        .option('shift-id', { type: 'string', demandOption: true, describe: 'Shift ID' })
        .option('by', { type: 'string', demandOption: true, describe: 'Admin operator name' })
        .option('reason', { type: 'string', demandOption: true, describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await shiftCmds.regenerateReport({
        shiftId: argv['shift-id'],
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`✓ Shift report regenerated for shift ${res.shift_id} (${res.pdf_bytes} bytes).`);
    }
  );

  // 12. check-paid-cache
  cli.command(
    'check-paid-cache',
    'Audit consistency between paid_cache on reservations and sum of payments',
    (y) =>
      y
        .option('fix', { type: 'boolean', default: false, describe: 'Automatically fix discrepancies' })
        .option('by', { type: 'string', default: 'System', describe: 'Admin operator name' })
        .option('reason', { type: 'string', default: 'Paid cache consistency check', describe: 'Operational reason' })
        .option('yes', { type: 'boolean', default: false, alias: 'y', describe: 'Skip confirmation' }),
    async (argv) => {
      await connectDB();
      const res = await paymentCmds.checkPaidCache({
        fix: argv.fix,
        by: argv.by,
        reason: argv.reason,
        yes: argv.yes,
      });
      console.log(`Checked ${res.total_reservations_checked} reservations. Discrepancies found: ${res.discrepancies_count}.`);
      if (res.discrepancies_count > 0) {
        console.table(res.discrepancies);
      }
    }
  );

  try {
    await cli.parseAsync();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  guard,
  ...staffCmds,
  ...roomCmds,
  ...shiftCmds,
  ...paymentCmds,
};
