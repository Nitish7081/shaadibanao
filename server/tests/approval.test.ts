import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { AdminService } from '../src/services/admin.service';
import { AuthService } from '../src/services/auth.service';
import {
  registerMockUserApprovalForTesting,
  clearMockUserApprovalForTesting,
} from '../src/middleware/approval.middleware';

const app = createApp();

describe('Mandatory Admin Registration Approval Workflow Suite', () => {
  const adminId = '680000000000000000000001';
  const pendingUserId = '680000000000000000000002';
  const approvedUserId = '680000000000000000000003';
  const suspendedUserId = '680000000000000000000004';
  const rejectedUserId = '680000000000000000000005';

  let adminToken: string;
  let pendingUserToken: string;
  let approvedUserToken: string;
  let suspendedUserToken: string;
  let rejectedUserToken: string;

  beforeAll(() => {
    // Register test users in in-memory test stores
    const mockAdmin = {
      id: adminId,
      _id: adminId,
      email: 'admin@shaadibanao.com',
      mobile: '9999999999',
      role: 'admin',
      status: 'active',
      approvalStatus: 'approved',
      displayName: 'System Admin',
    };

    const mockPendingUser = {
      id: pendingUserId,
      _id: pendingUserId,
      email: 'pending@shaadibanao.com',
      mobile: '9888888888',
      role: 'member',
      status: 'active',
      approvalStatus: 'pending',
      displayName: 'New Applicant',
      createdAt: new Date(),
    };

    const mockApprovedUser = {
      id: approvedUserId,
      _id: approvedUserId,
      email: 'approved@shaadibanao.com',
      mobile: '9777777777',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
      displayName: 'Approved Member',
      createdAt: new Date(),
    };

    const mockSuspendedUser = {
      id: suspendedUserId,
      _id: suspendedUserId,
      email: 'suspended@shaadibanao.com',
      mobile: '9666666666',
      role: 'member',
      status: 'suspended',
      approvalStatus: 'approved',
      displayName: 'Suspended Member',
      createdAt: new Date(),
    };

    const mockRejectedUser = {
      id: rejectedUserId,
      _id: rejectedUserId,
      email: 'rejected@shaadibanao.com',
      mobile: '9555555555',
      role: 'member',
      status: 'active',
      approvalStatus: 'rejected',
      rejectionReason: 'Incomplete biodata and invalid photo',
      displayName: 'Rejected Applicant',
      createdAt: new Date(),
    };

    AdminService.registerInMemoryAdminForTesting(mockAdmin);
    AdminService.registerInMemoryAdminForTesting(mockPendingUser);
    AdminService.registerInMemoryAdminForTesting(mockApprovedUser);
    AdminService.registerInMemoryAdminForTesting(mockSuspendedUser);
    AdminService.registerInMemoryAdminForTesting(mockRejectedUser);

    AuthService.registerInMemoryUserForTesting(mockAdmin);
    AuthService.registerInMemoryUserForTesting(mockPendingUser);
    AuthService.registerInMemoryUserForTesting(mockApprovedUser);
    AuthService.registerInMemoryUserForTesting(mockSuspendedUser);
    AuthService.registerInMemoryUserForTesting(mockRejectedUser);

    registerMockUserApprovalForTesting(adminId, mockAdmin);
    registerMockUserApprovalForTesting(pendingUserId, mockPendingUser);
    registerMockUserApprovalForTesting(approvedUserId, mockApprovedUser);
    registerMockUserApprovalForTesting(suspendedUserId, mockSuspendedUser);
    registerMockUserApprovalForTesting(rejectedUserId, mockRejectedUser);

    adminToken = TokenService.generateTokens({
      userId: adminId,
      email: 'admin@shaadibanao.com',
      role: 'admin',
    }).accessToken;

    pendingUserToken = TokenService.generateTokens({
      userId: pendingUserId,
      email: 'pending@shaadibanao.com',
      role: 'member',
    }).accessToken;

    approvedUserToken = TokenService.generateTokens({
      userId: approvedUserId,
      email: 'approved@shaadibanao.com',
      role: 'member',
    }).accessToken;

    suspendedUserToken = TokenService.generateTokens({
      userId: suspendedUserId,
      email: 'suspended@shaadibanao.com',
      role: 'member',
    }).accessToken;

    rejectedUserToken = TokenService.generateTokens({
      userId: rejectedUserId,
      email: 'rejected@shaadibanao.com',
      role: 'member',
    }).accessToken;
  });

  afterAll(() => {
    AdminService.clearInMemoryAdminForTesting();
    AuthService.clearInMemoryUserForTesting();
    clearMockUserApprovalForTesting();
  });

  describe('Server-Side Protected APIs Block Unapproved Users', () => {
    it('should reject pending user from /api/v1/search with 403 APPROVAL_PENDING', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${pendingUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('APPROVAL_PENDING');
      expect(res.body.message).toContain('under review');
    });

    it('should reject pending user from /api/v1/interests/sent with 403 APPROVAL_PENDING', async () => {
      const res = await request(app)
        .get('/api/v1/interests/sent')
        .set('Authorization', `Bearer ${pendingUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPROVAL_PENDING');
    });

    it('should reject pending user from /api/v1/conversations with 403 APPROVAL_PENDING', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${pendingUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPROVAL_PENDING');
    });

    it('should reject pending user from viewing another user profile with 403 APPROVAL_PENDING', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${approvedUserId}`)
        .set('Authorization', `Bearer ${pendingUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPROVAL_PENDING');
    });

    it('should allow pending user to access their own authentication profile via /api/v1/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${pendingUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.approvalStatus).toBe('pending');
    });
  });

  describe('Suspended and Rejected User Restrictions', () => {
    it('should reject suspended user from protected APIs with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${suspendedUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('should reject rejected user with 403 APPROVAL_REJECTED and return rejection details', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${rejectedUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPROVAL_REJECTED');
      expect(res.body.error.details.rejectionReason).toBeDefined();
    });
  });

  describe('Admin Pending Approvals Operations (/api/v1/admin/approvals)', () => {
    it('should reject unauthenticated caller from /api/v1/admin/approvals with 401', async () => {
      const res = await request(app).get('/api/v1/admin/approvals');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin member from /api/v1/admin/approvals with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/approvals')
        .set('Authorization', `Bearer ${approvedUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow administrator to list pending approvals', async () => {
      const res = await request(app)
        .get('/api/v1/admin/approvals?approvalStatus=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should reject rejection attempt without mandatory reason (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/approvals/${pendingUserId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REASON_REQUIRED');
    });

    it('should allow administrator to approve a user account', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/approvals/${pendingUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.approvalStatus).toBe('approved');
    });

    it('should allow administrator to retrieve audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
    });
  });

  describe('Task 2 — Comprehensive Approval & Mobile Sync Integration Verification', () => {
    const lifecycleUserId = '680000000000000000000088';
    let lifecycleUserToken: string;

    beforeEach(() => {
      const mockUser = {
        id: lifecycleUserId,
        _id: lifecycleUserId,
        email: 'lifecycle@shaadibanao.com',
        mobile: '9444444444',
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        phoneVerified: true,
        identityVerificationStatus: 'none',
        photoApprovalStatus: 'none',
        displayName: 'Lifecycle Test User',
        createdAt: new Date(),
      };
      AdminService.registerInMemoryAdminForTesting(mockUser);
      AuthService.registerInMemoryUserForTesting(mockUser);
      registerMockUserApprovalForTesting(lifecycleUserId, mockUser);

      lifecycleUserToken = TokenService.generateTokens({
        userId: lifecycleUserId,
        email: 'lifecycle@shaadibanao.com',
        role: 'member',
      }).accessToken;
    });

    it('1 & 2: should approve pending user and persist approvalStatus: approved in record', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.approvalStatus).toBe('approved');
      expect(res.body.data.user.status).toBe('active');
    });

    it('3: admin queue no longer shows the approved record as pending', async () => {
      await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const queueRes = await request(app)
        .get('/api/v1/admin/approvals?approvalStatus=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(queueRes.status).toBe(200);
      const pendingItems = queueRes.body.data.items || [];
      const foundInPending = pendingItems.some((item: any) => item.id === lifecycleUserId);
      expect(foundInPending).toBe(false);
    });

    it('4: mobile /auth/me returns the new status immediately', async () => {
      const preRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);
      expect(preRes.status).toBe(200);
      expect(preRes.body.data.user.approvalStatus).toBe('pending');

      await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const postRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);
      expect(postRes.status).toBe(200);
      expect(postRes.body.data.user.approvalStatus).toBe('approved');
    });

    it('5: a logged-in user can refresh session and access protected endpoints without re-registering', async () => {
      const blockedRes = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);
      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('APPROVAL_PENDING');

      await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const userRecord = await AuthService.findUserById(lifecycleUserId);
      registerMockUserApprovalForTesting(lifecycleUserId, userRecord);

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);
      expect(meRes.body.data.user.approvalStatus).toBe('approved');

      const searchRes = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);
      expect(searchRes.status).toBe(200);
    });

    it('6: unauthorized or regular members cannot approve records (403/401)', async () => {
      const noAuthRes = await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`);
      expect(noAuthRes.status).toBe(401);

      const memberRes = await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${approvedUserToken}`);
      expect(memberRes.status).toBe(403);
      expect(memberRes.body.error.code).toBe('FORBIDDEN');
    });

    it('7: pending user cannot bypass restrictions by calling protected APIs directly', async () => {
      const endpoints = [
        '/api/v1/search',
        '/api/v1/conversations',
        '/api/v1/interests/sent',
        '/api/v1/shortlists',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${lifecycleUserToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('APPROVAL_PENDING');
      }
    });

    it('8: photo, identity, account and Pandit approvals remain strictly independent', async () => {
      await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const userRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${lifecycleUserToken}`);

      expect(userRes.body.data.user.approvalStatus).toBe('approved');
      expect(userRes.body.data.user.identityVerificationStatus).toBe('none');
      expect(userRes.body.data.user.photoApprovalStatus).toBe('none');
    });

    it('9: rejected records display correct status and mandatory reason error handling works', async () => {
      const failRes = await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' });
      expect(failRes.status).toBe(400);
      expect(failRes.body.error.code).toBe('REASON_REQUIRED');

      const rejectRes = await request(app)
        .post(`/api/v1/admin/approvals/${lifecycleUserId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid identity details', remarks: 'Please upload clear photos' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.user.approvalStatus).toBe('rejected');
      expect(rejectRes.body.data.user.rejectionReason).toBe('Invalid identity details');
    });
  });
});
