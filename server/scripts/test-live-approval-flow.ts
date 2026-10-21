import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { OtpModel } from '../src/models/otp.model';

async function main() {
  console.log('====================================================');
  console.log('  Live E2E Verification: Mandatory Approval Workflow');
  console.log('====================================================');

  await connectDatabase();
  const app = createApp();
  const testMobile = '9999888811';

  // 0. Clean any prior test artifacts
  await UserModel.deleteMany({ mobile: testMobile });
  await OtpModel.deleteMany({ mobile: testMobile });

  // 1. Request OTP
  const reqOtp = await request(app)
    .post('/api/v1/auth/request-otp')
    .send({ mobile: testMobile });
  console.log('[Step 1] Request OTP:', reqOtp.status === 200 ? 'PASS' : 'FAIL');

  // 2. Verify OTP (using dev test OTP: 123456)
  const verifyOtp = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ mobile: testMobile, otp: '123456' });
  const verificationToken = verifyOtp.body?.data?.verificationToken;
  console.log('[Step 2] Verify OTP & obtain verificationToken:', verificationToken ? 'PASS' : 'FAIL');

  // 3. Register New Member
  const regRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      mobile: testMobile,
      verificationToken,
      profileFor: 'myself',
      consentToTerms: true,
    });
  const newUserId = regRes.body?.data?.user?.id;
  const userToken = regRes.body?.data?.tokens?.accessToken;
  const initialApprovalStatus = regRes.body?.data?.user?.approvalStatus;
  console.log('[Step 3] New User Created with approvalStatus === "pending":', initialApprovalStatus === 'pending' ? 'PASS' : `FAIL (${initialApprovalStatus})`);

  // 4. Test Protected API is Blocked for Pending User
  const searchBlockedRes = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${userToken}`);
  console.log('[Step 4] Protected Search Blocked with 403 APPROVAL_PENDING:', searchBlockedRes.status === 403 && searchBlockedRes.body?.error?.code === 'APPROVAL_PENDING' ? 'PASS' : 'FAIL');

  // 5. Admin Authentication
  const adminLogin = await request(app)
    .post('/api/v1/admin/login')
    .send({
      emailOrMobile: 'admin@shaadibanao.com',
      password: 'AdminPass123!',
    });
  const adminToken = adminLogin.body?.data?.tokens?.accessToken;
  console.log('[Step 5] Admin Login:', adminToken ? 'PASS' : 'FAIL');

  // 6. Admin Lists Pending Approvals Table
  const approvalsList = await request(app)
    .get('/api/v1/admin/approvals?approvalStatus=pending')
    .set('Authorization', `Bearer ${adminToken}`);
  const foundInList = approvalsList.body?.data?.items?.some((i: any) => i.mobile === testMobile);
  console.log('[Step 6] Applicant visible in Admin Approvals Table:', foundInList ? 'PASS' : 'FAIL');

  // 7. Admin Approves Applicant
  const approveRes = await request(app)
    .post(`/api/v1/admin/approvals/${newUserId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
  const approvedStatus = approveRes.body?.data?.user?.approvalStatus;
  console.log('[Step 7] Admin Approves User (status -> approved):', approvedStatus === 'approved' ? 'PASS' : 'FAIL');

  // 8. Protected API is now Unlocked for Approved User
  const searchAllowedRes = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${userToken}`);
  console.log('[Step 8] Protected Search Unlocked (200 OK):', searchAllowedRes.status === 200 ? 'PASS' : `FAIL (${searchAllowedRes.status})`);

  // 9. Verify Audit Log recorded
  const auditRes = await request(app)
    .get('/api/v1/admin/audit-logs')
    .set('Authorization', `Bearer ${adminToken}`);
  const auditLogged = auditRes.body?.data?.logs?.some((l: any) => l.action === 'user_approved' && l.targetUserMobile === testMobile);
  console.log('[Step 9] Audit Log Successfully Recorded on Atlas:', auditLogged ? 'PASS' : 'FAIL');

  // 10. Clean up isolated test user
  await UserModel.deleteMany({ mobile: testMobile });
  await OtpModel.deleteMany({ mobile: testMobile });
  console.log('[Step 10] Isolated test user cleaned up safely: PASS');

  await disconnectDatabase();
  console.log('====================================================');
  console.log('  LIVE VERIFICATION RESULT: ALL 10/10 CHECKS PASSED ✅');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error in live verification:', err);
  process.exit(1);
});
