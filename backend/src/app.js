const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const path = require('path');
const mongoose = require('mongoose');
const OpenApiValidator = require('express-openapi-validator');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { generalRateLimiter } = require('./middleware/rateLimit');
const { E } = require('./utils/errors');

const app = express();
app.set('trust proxy', 1);
app.set('query parser', 'simple');
app.disable('x-powered-by');

app.use(
  helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  cors({
    origin: env.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    exposedHeaders: ['Idempotent-Replayed', 'Retry-After'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(
  pinoHttp({
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    level: env.nodeEnv === 'test' ? 'silent' : 'info',
  })
);

const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');

app.get('/health', (req, res) => res.json({ ok: true }));

const apiSpecPath = path.resolve(__dirname, '../openapi/staff-management-api.yaml');

if (env.nodeEnv !== 'production') {
  const swaggerDocument = yaml.load(fs.readFileSync(apiSpecPath, 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.use(
  OpenApiValidator.middleware({
    apiSpec: apiSpecPath,
    validateRequests: { removeAdditional: 'all' },
    validateResponses: env.nodeEnv !== 'production',
    validateSecurity: false,
    ignorePaths: /^\/(health|docs|api\/v1\/test-)/,
  })
);

// General rate limiter on all API endpoints
app.use('/api/v1', generalRateLimiter);

// Module routes
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/shifts', require('./modules/shifts/shift.routes'));

app.use('/api/v1/rooms', require('./modules/rooms/room.routes'));
app.use('/api/v1/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/guests', require('./modules/guests/guest.routes'));
app.use('/api/v1/reservations', require('./modules/reservations/reservation.routes'));
app.use('/api/v1/payments', require('./modules/payments/payment.routes'));
app.use('/api/v1/cleaning-tasks', require('./modules/cleaning/cleaning.routes'));
app.use('/api/v1/maintenance-issues', require('./modules/maintenance/maintenance.routes'));
if (env.nodeEnv === 'test') {
  app.post(
    '/api/v1/test-shift-write',
    require('./middleware/auth').authenticate,
    require('./middleware/requireRole').requireRole('receptionist'),
    require('./middleware/requireShift'),
    (req, res) => res.json({ ok: true, shift_id: String(req.shift._id) })
  );
}

app.use((req, res, next) => {
  next(E.notFound('Not found'));
});

app.use(errorHandler);

module.exports = app;
