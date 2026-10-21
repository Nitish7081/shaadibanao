import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { AdminService } from '../src/services/admin.service';

const app = createApp();

describe('Admin Web Portal & Security Suite (/api/v1/admin)', () => {
  const adminPassword = 'AdminSecretPassword123!';
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);

  const mockAdminUser = {
    id: '670000000000000000000001',
    _id: '670000000000000000000001',
    email: 'admin@shaadibanao.com',
    mobile: '9999999999',
    role: 'admin',
    status: 'active',
    displayName: 'Chief Administrator',
    passwordHash: hashedPassword,
    createdAt: new Date(),
  };

  const mockMemberUser = {
    id: '670000000000000000000002',
    _id: '670000000000000000000002',
    email: 'member@shaadibanao.com',
    mobile: '9876543210',
    role: 'member',
    status: 'active',
    displayName: 'Regular Member',
    passwordHash: hashedPassword,
    createdAt: new Date(),
  };

  let adminAccessToken: string;
  let memberAccessToken: string;

  beforeAll(() => {
    AdminService.registerInMemoryAdminForTesting(mockAdminUser);
    AdminService.registerInMemoryAdminForTesting(mockMemberUser);

    adminAccessToken = TokenService.generateTokens({
      userId: mockAdminUser.id,
      email: mockAdminUser.email,
      role: 'admin',
    }).accessToken;

    memberAccessToken = TokenService.generateTokens({
      userId: mockMemberUser.id,
      email: mockMemberUser.email,
      role: 'member',
    }).accessToken;
  });

  afterAll(() => {
    AdminService.clearInMemoryAdminForTesting();
  });

  describe('Admin Authentication (/api/v1/admin/login)', () => {
    it('should reject login request with incorrect password (401)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/login')
        .send({
          emailOrMobile: 'admin@shaadibanao.com',
          password: 'WrongPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login attempt if user does not have admin role (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/login')
        .send({
          emailOrMobile: 'member@shaadibanao.com',
          password: adminPassword,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should successfully authenticate admin and return JWT tokens with role admin (200)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/login')
        .send({
          emailOrMobile: 'admin@shaadibanao.com',
          password: adminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe('admin');
    });
  });

  describe('Role-Based Authorization & Access Control', () => {
    it('should reject unauthenticated request to /api/v1/admin/dashboard with 401', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject standard member from accessing /api/v1/admin/dashboard with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${memberAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow verified administrator to retrieve dashboard statistics (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.membershipPlans).toBeDefined();
    });
  });

  describe('Admin Operations Endpoints', () => {
    it('should retrieve list of users via GET /api/v1/admin/users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });

    it('should update user status via PATCH /api/v1/admin/users/:id/status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${mockMemberUser.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.status).toBe('suspended');
    });

    it('should update user role via PATCH /api/v1/admin/users/:id/role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${mockMemberUser.id}/role`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ role: 'moderator' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('moderator');
    });

    it('should serve the admin web UI static HTML at /admin', async () => {
      const res = await request(app).get('/admin');

      expect(res.status).toBe(200);
      expect(res.text).toContain('ShaadiBanao Admin Portal');
    });

    it('should list pending photos via GET /api/v1/admin/photos/pending', async () => {
      const res = await request(app)
        .get('/api/v1/admin/photos/pending')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should reject non-admin from listing pending photos (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/photos/pending')
        .set('Authorization', `Bearer ${memberAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should moderate user photo via POST /api/v1/admin/photos/:userId/moderate', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/photos/${mockMemberUser.id}/moderate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
    });
  });
});
