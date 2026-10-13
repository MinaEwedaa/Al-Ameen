const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const path = require('path');
const OpenApiValidator = require('express-openapi-validator');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.allowedOrigins,
  credentials: true,
  exposedHeaders: ['Idempotent-Replayed', 'Retry-After'],
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(
  pinoHttp({
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    level: env.nodeEnv === 'test' ? 'silent' : 'info',
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

const apiSpecPath = path.resolve(__dirname, '../openapi/staff-management-api.yaml');

app.use(
  OpenApiValidator.middleware({
    apiSpec: apiSpecPath,
    validateRequests: { removeAdditional: 'all' },
    validateResponses: env.nodeEnv !== 'production',
    validateSecurity: false,
    ignorePaths: /^\/(health|api\/v1\/test-)/,
  })
);

// Module routes
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/shifts', require('./modules/shifts/shift.routes'));

app.use('/api/v1/rooms', require('./modules/rooms/room.routes'));
app.use('/api/v1/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/guests', require('./modules/guests/guest.routes'));
app.use('/api/v1/reservations', require('./modules/reservations/reservation.routes'));
if (env.nodeEnv === 'test') {
  app.post(
    '/api/v1/test-shift-write',
    require('./middleware/auth').authenticate,
    require('./middleware/requireRole').requireRole('receptionist'),
    require('./middleware/requireShift'),
    (req, res) => res.json({ ok: true, shift_id: String(req.shift._id) })
  );
}

app.use(errorHandler);

module.exports = app;
