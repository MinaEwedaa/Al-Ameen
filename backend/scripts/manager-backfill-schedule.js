#!/usr/bin/env node
// Feature M13: Backfill Schedule CLI Script
// Populates baseline ShiftSchedule rows for active receptionists for the next N days

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const adminEnvPath = path.resolve(__dirname, '../.env.admin');
const defaultEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(adminEnvPath)) {
  dotenv.config({ path: adminEnvPath });
} else {
  dotenv.config({ path: defaultEnvPath });
}

const { connectDB } = require('../src/db/connect');
const { ensureBaseline } = require('../src/modules/manager/common/schedule.service');
const { todayCairo, eachDate, ZONE } = require('../src/utils/time');
const { DateTime } = require('luxon');
const { guard } = require('./admin/guard');
const { Staff, ShiftSchedule } = require('../src/db/models');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('$0 [options]')
    .option('days', {
      type: 'number',
      default: 30,
      describe: 'Number of future days to backfill (max 62)',
    })
    .option('by', {
      type: 'string',
      demandOption: true,
      describe: 'Operator name executing backfill',
    })
    .option('reason', {
      type: 'string',
      demandOption: true,
      describe: 'Operational reason for schedule backfill',
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Simulate without inserting or persisting changes',
    })
    .option('yes', {
      type: 'boolean',
      default: false,
      alias: 'y',
      describe: 'Skip interactive confirmation prompt',
    })
    .help()
    .argv;

  const days = Math.min(Math.max(1, argv.days), 62);
  const by = argv.by.trim();
  const reason = argv.reason.trim();
  const isDryRun = !!argv['dry-run'];

  await connectDB();

  try {
    const from = todayCairo();
    const to = DateTime.now().setZone(ZONE).plus({ days: days - 1 }).toISODate();

    console.log(`Schedule backfill: from ${from} to ${to} (${days} days) [dry-run: ${isDryRun}]`);

    if (isDryRun) {
      const activeStaff = await Staff.find({
        role: 'receptionist',
        active: true,
        default_shift_type: { $ne: null },
      }).select('_id username default_shift_type').lean();

      const existing = await ShiftSchedule.find({
        staff_id: { $in: activeStaff.map((s) => s._id) },
        shift_date: { $gte: from, $lte: to },
      }).select('staff_id shift_date').lean();

      const have = new Set(existing.map((r) => `${String(r.staff_id)}|${r.shift_date}`));
      let wouldInsert = 0;
      for (const d of eachDate(from, to)) {
        for (const s of activeStaff) {
          if (!have.has(`${String(s._id)}|${d}`)) {
            wouldInsert++;
          }
        }
      }

      console.log(`[DRY RUN] Active receptionists: ${activeStaff.length}`);
      console.log(`[DRY RUN] Existing shift schedule entries: ${existing.length}`);
      console.log(`[DRY RUN] Would create ${wouldInsert} baseline shift schedule rows.`);
      return;
    }

    await guard({
      by,
      reason,
      yes: argv.yes,
      action: 'BACKFILL_SCHEDULE',
      details: { days, from, to },
    });

    await ensureBaseline(from, to);

    const totalInWindow = await ShiftSchedule.countDocuments({
      shift_date: { $gte: from, $lte: to },
    });

    console.log(`✓ Baseline schedule successfully backfilled through ${to}.`);
    console.log(`  Total schedule entries in window: ${totalInWindow}`);
  } catch (err) {
    console.error('Error during schedule backfill:', err.message);
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

module.exports = { main };

