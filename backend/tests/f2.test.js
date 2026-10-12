const request = require('supertest');
const argon2 = require('argon2');
const app = require('../src/app');
const { Staff, Session, AuditLog } = require('../src/db/models');

describe('Feature 2: Authentication & Session Management', () => {
  let receptionist;
  let manager;
  const password = 'CorrectPassword123!';

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await AuditLog.collection.deleteMany({});

    const passwordHash = await argon2.hash(password);

    receptionist = await Staff.create({
      username: 'ahmed_rec',
      name: 'Ahmed',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    manager = await Staff.create({
      username: 'sami_manager',
      name: 'Sami',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'manager',
      active: true,
    });
  });

  test('successful login returns 200, JWT access token, and sets httpOnly refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'ahmed_rec',
        password: password,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body.expires_in).toBe(900);
    expect(res.body.staff.staff_id).toBe(String(receptionist._id));
    expect(res.body.staff.name).toBe('Ahmed');
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body.staff).not.toHaveProperty('password_hash');

    // Cookie verification
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Strict');
  });

  test('non-existent user and wrong password return identical 401 and error message', async () => {
    const resWrongUser = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'non_existent_user',
        password: 'AnyPassword123',
      });

    const resWrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'ahmed_rec',
        password: 'WrongPassword123',
      });

    expect(resWrongUser.status).toBe(401);
    expect(resWrongPass.status).toBe(401);
    expect(resWrongUser.body).toEqual(resWrongPass.body);
    expect(resWrongUser.body.error.code).toBe('UNAUTHORIZED');
  });

  test('5 consecutive failed attempts trigger account lockout (429 with Retry-After)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'ahmed_rec',
          password: 'WrongPassword!',
        });
      if (i < 4) {
        expect(res.status).toBe(401);
      } else {
        // 5th failed attempt triggers lockout
        expect(res.status).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
      }
    }

    // 6th attempt even with correct password returns 429
    const resBlocked = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'ahmed_rec',
        password: password,
      });
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error.code).toBe('TOO_MANY_REQUESTS');

    // Fast-forward past lockout window
    await Staff.updateOne(
      { _id: receptionist._id },
      { locked_until: new Date(Date.now() - 1000) }
    );

    // Now login with correct password succeeds and clears lockout
    const resSuccess = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'ahmed_rec',
        password: password,
      });
    expect(resSuccess.status).toBe(200);

    const updated = await Staff.findById(receptionist._id);
    expect(updated.failed_attempts).toBe(0);
    expect(updated.lock_level).toBe(0);
  });

  test('logging in from a second device revokes the first device session', async () => {
    // Device 1 login
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    expect(login1.status).toBe(200);
    const token1 = login1.body.access_token;

    // Verify token1 works
    const me1 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(me1.status).toBe(200);

    // Device 2 login
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    expect(login2.status).toBe(200);

    // Device 1 session was revoked: token1 now returns 401
    const me1After = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(me1After.status).toBe(401);
  });

  test('refresh token rotation issues new access and refresh tokens', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers['set-cookie'][0];

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('access_token');
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  test('using an already rotated refresh token triggers reuse detection and revokes the session', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    const oldCookie = loginRes.headers['set-cookie'][0];

    // First refresh: consumes old token and issues new token
    const refresh1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie);
    expect(refresh1.status).toBe(200);
    const newCookie = refresh1.headers['set-cookie'][0];

    // Attacker tries to use the old consumed refresh token
    const reuseAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie);
    expect(reuseAttempt.status).toBe(401);

    // The whole session is now revoked: even the new cookie will fail
    const revokedAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookie);
    expect(revokedAttempt.status).toBe(401);

    // Verify audit log captured REFRESH_REUSE
    const reuseLog = await AuditLog.findOne({ action: 'REFRESH_REUSE' });
    expect(reuseLog).not.toBeNull();
  });

  test('refresh endpoint rejects forbidden Origin header', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    const cookie = loginRes.headers['set-cookie'][0];

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'http://malicious-website.com');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('POST /auth/logout revokes session and clears cookie', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    const token = loginRes.body.access_token;
    const cookie = loginRes.headers['set-cookie'][0];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(204);

    // Subsequent call to /auth/me returns 401
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);
  });

  test('logging in with manager account returns 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'sami_manager',
        password,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('GET /auth/me returns authenticated receptionist profile and shift null', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ahmed_rec', password });
    const token = loginRes.body.access_token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.staff.name).toBe('Ahmed');
    expect(meRes.body.staff.default_shift_type).toBe('morning');
    expect(meRes.body.shift).toBeNull();
    expect(meRes.body.read_only).toBe(false);
  });
});