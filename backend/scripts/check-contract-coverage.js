#!/usr/bin/env node
// Feature M14: Contract Coverage Verification Script
// Verifies that all 54 Manager API Contract routes exist in manager-api.yaml and Express router stack

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const yaml = require('js-yaml');

// The 54 Contract routes specified in Manager API Contract v1.2 and guide (M2 to M12)
const CONTRACT_ROUTES = [
  // M2 (2)
  'GET /password-reset-requests',
  'PATCH /password-reset-requests/{id}/decision',
  // M3 (5)
  'GET /notifications',
  'PATCH /notifications/{id}/read',
  'POST /notifications/read-all',
  'GET /notifications/preferences',
  'PATCH /notifications/preferences',
  // M4 (7)
  'GET /staff',
  'POST /staff',
  'GET /staff/{id}',
  'PATCH /staff/{id}',
  'DELETE /staff/{id}',
  'POST /staff/{id}/reactivate',
  'POST /staff/{id}/reset-password',
  // M5 (8)
  'GET /room-types',
  'POST /room-types',
  'PATCH /room-types/{id}',
  'GET /rooms',
  'PATCH /rooms/{id}',
  'GET /rooms/{id}/activities',
  'GET /housekeeping-tasks',
  'PATCH /housekeeping-tasks/{id}/assign',
  // M6 (7)
  'GET /shifts/overview',
  'GET /shifts',
  'GET /shifts/roster',
  'POST /shifts',
  'PATCH /shifts/{id}',
  'DELETE /shifts/{id}',
  'POST /shifts/{id}/force-close',
  // M7 (3)
  'GET /leave-requests',
  'GET /leave-requests/{id}',
  'PATCH /leave-requests/{id}/decision',
  // M8 (3)
  'GET /approvals',
  'GET /approvals/{id}',
  'PATCH /approvals/{id}/decision',
  // M9 (5 + 1 pdf)
  'GET /shift-reports',
  'GET /shift-reports/{id}',
  'PATCH /shift-reports/{id}/review',
  'GET /shift-reports/{id}/activities',
  'GET /shift-reports/{id}/handover',
  'GET /shift-reports/{id}/pdf',
  // M10 (4 + 1 payments)
  'GET /daily-closings',
  'GET /daily-closings/current',
  'POST /daily-closings/open',
  'POST /daily-closings/close',
  'GET /payments',
  // M11 (4)
  'GET /dashboard/overview',
  'GET /dashboard/revenue',
  'GET /dashboard/issues',
  'GET /activities',
  // M12 (5)
  'GET /hotel-settings',
  'PATCH /hotel-settings',
  'GET /shift-settings',
  'PATCH /shift-settings',
  'GET /search',
];

function loadYamlRoutes() {
  const yamlPath = path.resolve(__dirname, '../openapi/manager-api.yaml');
  const spec = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
  const routes = new Set();

  for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of Object.keys(pathItem)) {
      if (['get', 'post', 'patch', 'delete', 'put'].includes(method.toLowerCase())) {
        routes.add(`${method.toUpperCase()} ${routePath}`);
      }
    }
  }
  return routes;
}

function loadExpressRoutes() {
  const subrouters = [
    ['/password-reset-requests', '../src/modules/manager/passwords/password.routes'],
    ['/notifications', '../src/modules/manager/notifications/notifications.routes'],
    ['/staff', '../src/modules/manager/staff/staff.routes'],
    ['/shifts', '../src/modules/manager/shifts/shifts.routes'],
    ['/rooms', '../src/modules/manager/rooms/rooms.routes'],
    ['/room-types', '../src/modules/manager/roomTypes/roomTypes.routes'],
    ['/housekeeping-tasks', '../src/modules/manager/housekeeping/housekeeping.routes'],
    ['/dashboard', '../src/modules/manager/dashboard/dashboard.routes'],
    ['/activities', '../src/modules/manager/activities/activities.routes'],
    ['/leave-requests', '../src/modules/manager/leaves/leave.routes'],
    ['/approvals', '../src/modules/manager/approvals/approvals.routes'],
    ['/shift-reports', '../src/modules/manager/shiftReports/shiftReports.routes'],
    ['/daily-closings', '../src/modules/manager/finance/dailyClosings.routes'],
    ['/payments', '../src/modules/manager/finance/payments.routes'],
    ['/hotel-settings', '../src/modules/manager/settings/hotelSettings.routes'],
    ['/shift-settings', '../src/modules/manager/settings/shiftSettings.routes'],
    ['/search', '../src/modules/manager/search/search.routes'],
  ];

  const routes = new Set();
  for (const [prefix, modRelPath] of subrouters) {
    const r = require(path.resolve(__dirname, modRelPath));
    for (const layer of r.stack) {
      if (layer.route) {
        // Normalize Express :param into OpenAPI {param} (or {id})
        const subPath = layer.route.path === '/' ? '' : layer.route.path;
        const normalized = (prefix + subPath).replace(/:[a-zA-Z0-9_]+/g, '{id}');
        for (const method of Object.keys(layer.route.methods)) {
          routes.add(`${method.toUpperCase()} ${normalized}`);
        }
      }
    }
  }
  return routes;
}

function main() {
  console.log('=== Manager API Contract Coverage Verification ===');

  const yamlRoutes = loadYamlRoutes();
  const expressRoutes = loadExpressRoutes();

  let hasError = false;

  console.log(`Checking ${CONTRACT_ROUTES.length} Contract routes...`);

  const missingFromYaml = [];
  const missingFromExpress = [];

  for (const route of CONTRACT_ROUTES) {
    if (!yamlRoutes.has(route)) {
      missingFromYaml.push(route);
      hasError = true;
    }
    if (!expressRoutes.has(route)) {
      missingFromExpress.push(route);
      hasError = true;
    }
  }

  if (missingFromYaml.length > 0) {
    console.error('\n[FAIL] Missing from manager-api.yaml:');
    missingFromYaml.forEach((r) => console.error(`  - ${r}`));
  }

  if (missingFromExpress.length > 0) {
    console.error('\n[FAIL] Missing from Express router stack:');
    missingFromExpress.forEach((r) => console.error(`  - ${r}`));
  }

  if (hasError) {
    console.error('\n❌ Contract coverage verification failed.');
    process.exit(1);
  }

  console.log(`\n✓ All ${CONTRACT_ROUTES.length} Contract routes verified in both manager-api.yaml and Express!`);
  console.log(`  - Total operations in manager-api.yaml: ${yamlRoutes.size}`);
  console.log(`  - Total operations in Express router stack: ${expressRoutes.size}`);
  console.log('✓ 100% Contract coverage verified successfully.');
}

if (require.main === module) {
  main();
}

module.exports = {
  CONTRACT_ROUTES,
  loadYamlRoutes,
  loadExpressRoutes,
  main,
};

