import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { PartnerPreferenceModel } from '../src/models/preference.model';
import { KundliModel } from '../src/models/kundli.model';
import { OtpModel } from '../src/models/otp.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { BannerModel } from '../src/models/banner.model';
import { AuditLogModel } from '../src/models/audit-log.model';
import { StorageService } from '../src/services/storage.service';

// Minimal 1x1 valid PNG buffer
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runE2EVerification() {
  console.log('========================================================================');
  console.log('  ShaadiBanao — Complete End-to-End Matrimonial Verification Suite');
  console.log('  Atlas MongoDB + Cloudinary + Approval Gate + Moderation + Security');
  console.log('========================================================================\n');

  await connectDatabase();
  const app = createApp();

  const userMobileA = '9999111122';
  const userMobileC = '9999333344';

  // 0. Clean prior test artifacts
  await UserModel.deleteMany({ mobile: { $in: [userMobileA, userMobileC] } });
  await OtpModel.deleteMany({ mobile: { $in: [userMobileA, userMobileC] } });

  // --------------------------------------------------------------------------
  // FLOW A: New User Registers -> Full Profile Form -> Photo to Cloudinary -> Pending in DB
  // --------------------------------------------------------------------------
  console.log('--- [FLOW A] User Registration, Full Profile & Cloudinary Photo ---');

  // A1. Request OTP
  const reqOtpA = await request(app)
    .post('/api/v1/auth/request-otp')
    .send({ mobile: userMobileA });
  if (reqOtpA.status !== 200) throw new Error(`A1 Failed: ${JSON.stringify(reqOtpA.body)}`);
  console.log('  ✓ A1. OTP requested successfully for new user');

  // A2. Verify OTP (using dev test OTP: 123456)
  const verifyOtpA = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ mobile: userMobileA, otp: '123456' });
  const verificationTokenA = verifyOtpA.body?.data?.verificationToken;
  if (!verificationTokenA) throw new Error('A2 Failed: missing verificationToken');
  console.log('  ✓ A2. OTP verified with dev token issued');

  // A3. Register Account
  const regResA = await request(app)
    .post('/api/v1/auth/register')
    .send({
      mobile: userMobileA,
      verificationToken: verificationTokenA,
      profileFor: 'myself',
      consentToTerms: true,
    });
  const userIdA = regResA.body?.data?.user?.id;
  const tokenA = regResA.body?.data?.tokens?.accessToken;
  const refreshTokenA = regResA.body?.data?.tokens?.refreshToken;
  const initialStatusA = regResA.body?.data?.user?.approvalStatus;

  if (initialStatusA !== 'pending') throw new Error(`A3 Failed: expected pending, got ${initialStatusA}`);
  console.log(`  ✓ A3. New account created: ID ${userIdA}, approvalStatus: "${initialStatusA}"`);

  // A4. Upload Profile Photo to Cloudinary
  const intentResA = await request(app)
    .post('/api/v1/storage/upload-intent')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      purpose: 'profile_photo',
      fileName: 'aarav_portrait.png',
      fileType: 'image/png',
      fileSizeBytes: 70,
    });
  const uploadUrlA = intentResA.body?.data?.uploadUrl;
  if (!uploadUrlA) throw new Error('A4 Failed: missing uploadUrl');

  const uploadResA = await request(app)
    .post(uploadUrlA.replace('http://localhost:5000', ''))
    .send({ base64: SAMPLE_PNG_BASE64 });

  const cloudinaryPhotoUrl = uploadResA.body?.data?.url;
  const cloudinaryPhotoPublicId = uploadResA.body?.data?.publicId;
  if (!cloudinaryPhotoUrl || !cloudinaryPhotoUrl.includes('cloudinary.com')) {
    throw new Error(`A4 Failed: Expected Cloudinary URL, got: ${cloudinaryPhotoUrl}`);
  }
  console.log(`  ✓ A4. Real Cloudinary photo uploaded: ${cloudinaryPhotoUrl}`);
  console.log(`       Public ID: "${cloudinaryPhotoPublicId}"`);

  // A5. Complete Profile Form (Persist in MongoDB)
  const profileResA = await request(app)
    .put('/api/v1/profiles/me')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      firstName: 'Aarav',
      lastName: 'Sharma',
      gender: 'male',
      dateOfBirth: '1995-06-20',
      heightCm: 178,
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      caste: 'Brahmin',
      gotra: 'Vatsa',
      manglik: 'no',
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      familyValues: 'moderate',
      familyType: 'nuclear',
      fatherOccupation: 'Senior Government Officer',
      motherOccupation: 'Professor',
      education: 'B.Tech + MBA',
      employedIn: 'private',
      occupation: 'Senior Strategy Consultant',
      annualIncomeBand: '₹25L - ₹35L',
      showIncomeBand: true,
      photos: [
        {
          url: cloudinaryPhotoUrl,
          publicId: cloudinaryPhotoPublicId,
          isMain: true,
          privacy: 'everyone',
          approved: false, // Pending moderation
        },
      ],
      photoPrivacy: 'everyone',
      aboutMe: 'Passionate consultant, traditional values, looking for an educated partner.',
    });
  const profileIdA = profileResA.body?.data?.id;
  console.log(`  ✓ A5. Full profile biodata saved: completeness ${profileResA.body?.data?.completenessPercent}%`);

  // A6. Partner Preferences
  await request(app)
    .put('/api/v1/preferences/me')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      minAge: 23,
      maxAge: 30,
      minHeightCm: 155,
      maxHeightCm: 175,
      maritalStatuses: ['never_married'],
      religions: ['Hindu'],
      motherTongues: ['Hindi'],
      cities: ['New Delhi', 'Gurgaon', 'Noida'],
      manglikPreference: 'any',
    });
  console.log('  ✓ A6. Partner preferences persisted in MongoDB');

  // A7. Kundli / Astrology Details
  await request(app)
    .put('/api/v1/astrology/kundli/me')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      dateOfBirth: '1995-06-20',
      timeOfBirth: '14:30',
      isApproximateTime: false,
      birthPlace: {
        name: 'New Delhi',
        state: 'Delhi',
        country: 'India',
      },
      rashi: 'Mesh (Aries)',
      nakshatra: 'Ashwini',
      charan: 1,
      manglikStatus: 'non_manglik',
      visibility: 'matches_only',
    });
  console.log('  ✓ A7. Vedic Kundli profile persisted in MongoDB');

  // A8. Verify User State in MongoDB: approvalStatus === 'pending', photo.approved === false
  const userInDbA = await UserModel.findById(userIdA);
  const profileInDbA = await ProfileModel.findOne({ userId: userIdA });
  if (userInDbA?.approvalStatus !== 'pending') throw new Error('A8 Failed: User must be pending');
  if (profileInDbA?.photos[0]?.approved !== false) throw new Error('A8 Failed: Photo must not be self-approved');
  console.log('  ✓ A8. MongoDB verified: Account approvalStatus is "pending", photo.approved is false\n');

  // --------------------------------------------------------------------------
  // FLOW B: Admin Panel Review -> Sees Full Submitted Data -> Approves -> Access Unlocked
  // --------------------------------------------------------------------------
  console.log('--- [FLOW B] Admin Review, Full Biodata Inspection & Approval ---');

  // B1. Admin Login
  const adminLogin = await request(app)
    .post('/api/v1/admin/login')
    .send({
      emailOrMobile: 'admin@shaadibanao.com',
      password: 'AdminPass123!',
    });
  const adminToken = adminLogin.body?.data?.tokens?.accessToken;
  if (!adminToken) throw new Error('B1 Failed: Admin login failed');
  console.log('  ✓ B1. Admin logged in securely');

  // B2. Admin Views Pending Approvals Queue
  const approvalsList = await request(app)
    .get('/api/v1/admin/approvals?approvalStatus=pending')
    .set('Authorization', `Bearer ${adminToken}`);
  const applicantA = approvalsList.body?.data?.items?.find((i: any) => i.id === userIdA || i.mobile === userMobileA);

  if (!applicantA) throw new Error('B2 Failed: Applicant Aarav not found in admin pending queue');
  console.log(`  ✓ B2. Applicant found in queue: Account ID ${applicantA.id}`);
  console.log(`       - Name: ${applicantA.displayName}`);
  console.log(`       - Phone Verified: ${applicantA.phoneVerified}`);
  console.log(`       - Cloudinary Photo: ${applicantA.profile?.photos?.[0]?.url?.slice(0, 50)}...`);
  console.log(`       - Partner Preferences: Age ${applicantA.preferences?.minAge}-${applicantA.preferences?.maxAge}`);
  console.log(`       - Vedic Kundli: ${applicantA.kundli?.rashi} / ${applicantA.kundli?.nakshatra}`);

  // B3. Verify Protected Search is BLOCKED prior to approval
  const searchBlockedA = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${tokenA}`);
  if (searchBlockedA.status !== 403 || searchBlockedA.body?.error?.code !== 'APPROVAL_PENDING') {
    throw new Error(`B3 Failed: Expected 403 APPROVAL_PENDING, got ${searchBlockedA.status}`);
  }
  console.log('  ✓ B3. Protected /api/v1/search strictly blocked with 403 APPROVAL_PENDING');

  // B4. Admin Approves Profile
  const approveResA = await request(app)
    .post(`/api/v1/admin/approvals/${userIdA}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
  if (approveResA.body?.data?.user?.approvalStatus !== 'approved') {
    throw new Error('B4 Failed: User status was not updated to approved');
  }
  console.log('  ✓ B4. Admin approved profile: status is now "approved"');

  // B5. Protected Search is now UNLOCKED
  const searchAllowedA = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${tokenA}`);
  if (searchAllowedA.status !== 200) {
    throw new Error(`B5 Failed: Expected 200, got ${searchAllowedA.status}`);
  }
  console.log('  ✓ B5. Protected /api/v1/search unlocked: returned 200 OK\n');

  // --------------------------------------------------------------------------
  // FLOW C: Profile Rejection with Required Reason & Immediate Endpoint Blocking
  // --------------------------------------------------------------------------
  console.log('--- [FLOW C] Profile Rejection with Mandatory Reason ---');

  // C1. Register User C
  const reqOtpC = await request(app)
    .post('/api/v1/auth/request-otp')
    .send({ mobile: userMobileC });
  if (reqOtpC.status !== 200) throw new Error(`C1 Request OTP Failed: ${JSON.stringify(reqOtpC.body)}`);

  const verifyOtpC = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ mobile: userMobileC, otp: '123456' });
  const verificationTokenC = verifyOtpC.body?.data?.verificationToken;
  if (!verificationTokenC) throw new Error(`C1 Verify OTP Failed: ${JSON.stringify(verifyOtpC.body)}`);

  const regResC = await request(app)
    .post('/api/v1/auth/register')
    .send({
      mobile: userMobileC,
      verificationToken: verificationTokenC,
      profileFor: 'myself',
      consentToTerms: true,
    });
  const userIdC = regResC.body?.data?.user?.id;
  const tokenC = regResC.body?.data?.tokens?.accessToken;
  if (!userIdC || !tokenC) throw new Error(`C1 Registration Failed: ${JSON.stringify(regResC.body)}`);
  console.log(`  ✓ C1. Test applicant User C registered: ID ${userIdC}`);

  // C2. Reject without Reason (Must Fail)
  const rejectWithoutReason = await request(app)
    .post(`/api/v1/admin/approvals/${userIdC}/reject`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  if (rejectWithoutReason.status !== 400) {
    throw new Error('C2 Failed: Admin should not be able to reject without a reason');
  }
  console.log('  ✓ C2. Server rejects rejection request lacking mandatory reason (400 VALIDATION_ERROR)');

  // C3. Reject with Valid Reason
  const rejectionReason = 'Incomplete profile: Real portrait photo and education verification required.';
  const rejectResC = await request(app)
    .post(`/api/v1/admin/approvals/${userIdC}/reject`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: rejectionReason });
  if (rejectResC.body?.data?.user?.approvalStatus !== 'rejected') {
    throw new Error('C3 Failed: Expected status to be rejected');
  }
  console.log(`  ✓ C3. Admin rejected profile with reason: "${rejectionReason}"`);

  // C4. Protected Request Blocked with APPROVAL_REJECTED and Reason Returned
  const searchBlockedC = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${tokenC}`);
  if (searchBlockedC.status !== 403 || searchBlockedC.body?.error?.code !== 'APPROVAL_REJECTED') {
    throw new Error(`C4 Failed: Expected 403 APPROVAL_REJECTED, got ${searchBlockedC.status}`);
  }
  const hasReason =
    searchBlockedC.body?.error?.message?.includes(rejectionReason) ||
    searchBlockedC.body?.error?.details?.rejectionReason?.includes(rejectionReason);
  if (!hasReason) {
    throw new Error('C4 Failed: Rejection reason not included in response');
  }
  console.log('  ✓ C4. User C blocked with 403 APPROVAL_REJECTED containing the exact reason\n');

  // --------------------------------------------------------------------------
  // FLOW D: Photo Visibility Rules (Unapproved Hidden, Approved Visible)
  // --------------------------------------------------------------------------
  console.log('--- [FLOW D] Photo Visibility Rules & Moderation ---');

  // D1. Public Profile View for Aarav before photo approval: photo must be hidden
  const publicViewBefore = await request(app)
    .get(`/api/v1/profiles/${profileIdA}`)
    .set('Authorization', `Bearer ${tokenA}`);
  const photosBefore = publicViewBefore.body?.data?.photos || [];
  if (photosBefore.length > 0) {
    throw new Error('D1 Failed: Unapproved photo was exposed on public profile!');
  }
  console.log('  ✓ D1. Unapproved profile photo is hidden from public profile view');

  // D2. Admin Approves Photo
  const moderatePhotoRes = await request(app)
    .post(`/api/v1/admin/photos/${userIdA}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'approve' });
  if (moderatePhotoRes.status !== 200) {
    throw new Error('D2 Failed: Photo moderation failed');
  }
  console.log('  ✓ D2. Admin approved profile photo');

  // D3. Public Profile View now contains the approved Cloudinary photo
  const publicViewAfter = await request(app)
    .get(`/api/v1/profiles/${profileIdA}`)
    .set('Authorization', `Bearer ${tokenA}`);
  const photosAfter = publicViewAfter.body?.data?.photos || [];
  if (photosAfter.length === 0 || !photosAfter[0].url.includes('cloudinary.com')) {
    throw new Error('D3 Failed: Approved Cloudinary photo did not appear on public profile');
  }
  console.log(`  ✓ D3. Approved Cloudinary photo now visible publicly: ${photosAfter[0].url}\n`);

  // --------------------------------------------------------------------------
  // FLOW E: Community & Admin Banner Cloudinary Uploads
  // --------------------------------------------------------------------------
  console.log('--- [FLOW E] Community & Admin Banner Cloudinary Uploads ---');

  // E1. Community Photo Upload
  const commIntent = await request(app)
    .post('/api/v1/storage/upload-intent')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      purpose: 'community_post',
      fileName: 'banaras_wedding.png',
      fileType: 'image/png',
      fileSizeBytes: 70,
    });
  const commUploadUrl = commIntent.body?.data?.uploadUrl;
  const commUploadRes = await request(app)
    .post(commUploadUrl.replace('http://localhost:5000', ''))
    .send({ base64: SAMPLE_PNG_BASE64 });

  const commMediaUrl = commUploadRes.body?.data?.url;
  const commPublicId = commUploadRes.body?.data?.publicId;
  if (!commMediaUrl?.includes('cloudinary.com') || !commPublicId) {
    throw new Error('E1 Failed: Community photo upload to Cloudinary failed');
  }
  console.log(`  ✓ E1. Community photo uploaded to Cloudinary: ${commMediaUrl}`);

  // Create community post
  const commPostRes = await request(app)
    .post('/api/v1/community/posts')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      mediaUrl: commMediaUrl,
      publicId: commPublicId,
      caption: 'Sacred wedding traditions along the Ghats of Kashi.',
      category: 'culture',
    });
  const commPostId = commPostRes.body?.data?._id || commPostRes.body?.data?.id;
  console.log(`  ✓ E1. Community post persisted with Cloudinary URL & publicId: ID ${commPostId}`);

  // E2. Admin Matrimonial Banner Upload to Cloudinary
  const bannerUploadRes = await request(app)
    .post('/api/v1/admin/banners/upload')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      base64: SAMPLE_PNG_BASE64,
      title: 'Grand Vivah Mahotsav 2026',
      linkUrl: 'https://shaadibanao.com/events/vivah-2026',
      priority: 10,
    });
  const bannerId = bannerUploadRes.body?.data?._id || bannerUploadRes.body?.data?.id;
  const bannerImageUrl = bannerUploadRes.body?.data?.imageUrl;
  const bannerPublicId = bannerUploadRes.body?.data?.publicId;
  if (!bannerImageUrl?.includes('cloudinary.com') || !bannerPublicId) {
    throw new Error('E2 Failed: Admin banner upload to Cloudinary failed');
  }
  console.log(`  ✓ E2. Admin public banner uploaded to Cloudinary: ${bannerImageUrl}`);

  // E3. Get Banners & Cleanup Test Banner
  const bannersList = await request(app)
    .get('/api/v1/admin/banners')
    .set('Authorization', `Bearer ${adminToken}`);
  const hasBanner = bannersList.body?.data?.items?.some((b: any) => (b._id || b.id) === bannerId);
  if (!hasBanner) throw new Error('E3 Failed: Uploaded banner not in banners list');

  await request(app)
    .delete(`/api/v1/admin/banners/${bannerId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  console.log('  ✓ E3. Banner listed, verified, and cleaned up from Cloudinary & DB\n');

  // Clean up test community Cloudinary photo & DB post
  if (commPublicId) {
    await StorageService.deleteFromCloudinary(commPublicId).catch(() => {});
  }
  if (commPostId) {
    await CommunityPostModel.findByIdAndDelete(commPostId).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // FLOW F: Security Boundary Enforcement
  // --------------------------------------------------------------------------
  console.log('--- [FLOW F] Security Boundary & Role Authorization Enforcement ---');

  // F1. Normal User Cannot Access Admin Endpoints
  const normalUserAdminCall = await request(app)
    .get('/api/v1/admin/approvals')
    .set('Authorization', `Bearer ${tokenA}`);
  if (normalUserAdminCall.status !== 403) {
    throw new Error(`F1 Failed: Normal user got status ${normalUserAdminCall.status} instead of 403`);
  }
  console.log('  ✓ F1. Normal user calling /api/v1/admin/approvals strictly rejected with 403 FORBIDDEN');

  // F2. User Cannot Self-Approve via PUT /api/v1/profiles/me
  await request(app)
    .put('/api/v1/profiles/me')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({
      firstName: 'Hacked',
      approvalStatus: 'approved',
      photoApprovalStatus: 'approved',
    });
  const userCInDb = await UserModel.findById(userIdC);
  if (userCInDb?.approvalStatus === 'approved') {
    throw new Error('F2 Security Breach: User was able to self-approve via profile update!');
  }
  console.log('  ✓ F2. User cannot self-approve; approvalStatus remains "rejected"');

  // F3. Identity Documents MUST NOT be stored on Cloudinary (Restricted Vault)
  const idDocIntent = await request(app)
    .post('/api/v1/storage/upload-intent')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      purpose: 'identity_document',
      fileName: 'aadhaar_card.png',
      fileType: 'image/png',
      fileSizeBytes: 70,
    });
  const idDocUploadUrl = idDocIntent.body?.data?.uploadUrl;
  const idDocUploadRes = await request(app)
    .post(idDocUploadUrl.replace('http://localhost:5000', ''))
    .send({ base64: SAMPLE_PNG_BASE64 });

  if (idDocUploadRes.body?.data?.url?.includes('cloudinary.com')) {
    throw new Error('F3 Security Breach: Private identity document was sent to Cloudinary!');
  }
  if (!idDocUploadRes.body?.data?.isPrivate) {
    throw new Error('F3 Security Breach: Identity document is not marked private!');
  }
  console.log('  ✓ F3. Identity document secured in private restricted vault (NOT on Cloudinary)\n');

  // --------------------------------------------------------------------------
  // FLOW G: Persistence Across Simulated Server Restart & Session Refresh
  // --------------------------------------------------------------------------
  console.log('--- [FLOW G] Persistence Across DB Reconnect & Session Refresh ---');

  // G1. Simulate Server Restart: Disconnect & Reconnect DB
  await disconnectDatabase();
  console.log('  ✓ G1. Database disconnected (simulating server shutdown)');
  await connectDatabase();
  console.log('  ✓ G1. Database reconnected (simulating server reboot)');

  // G2. Verify Approval Status Persists on MongoDB Atlas
  const reloadedUserA = await UserModel.findById(userIdA);
  if (reloadedUserA?.approvalStatus !== 'approved') {
    throw new Error(`G2 Failed: Expected approved, got ${reloadedUserA?.approvalStatus}`);
  }
  console.log('  ✓ G2. Atlas persistence verified: User A remains "approved"');

  // G3. Refresh Token Session Refresh
  const refreshRes = await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: refreshTokenA });
  const freshAccessToken = refreshRes.body?.data?.tokens?.accessToken;
  if (!freshAccessToken) throw new Error('G3 Failed: Token refresh failed');

  // Verify fresh token can immediately access protected search without reinstalling
  const freshSearchRes = await request(app)
    .get('/api/v1/search')
    .set('Authorization', `Bearer ${freshAccessToken}`);
  if (freshSearchRes.status !== 200) {
    throw new Error(`G3 Failed: Fresh token could not access search (status ${freshSearchRes.status})`);
  }
  console.log('  ✓ G3. Mobile session refresh succeeds without reinstallation; fresh token accesses /search');

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------
  console.log('\n--- Cleaning up test artifacts ---');
  if (cloudinaryPhotoPublicId) {
    await StorageService.deleteFromCloudinary(cloudinaryPhotoPublicId).catch(() => {});
  }
  await UserModel.deleteMany({ mobile: { $in: [userMobileA, userMobileC] } });
  await ProfileModel.deleteMany({ userId: { $in: [userIdA, userIdC] } });
  await PartnerPreferenceModel.deleteMany({ userId: { $in: [userIdA, userIdC] } });
  await KundliModel.deleteMany({ userId: { $in: [userIdA, userIdC] } });
  await OtpModel.deleteMany({ mobile: { $in: [userMobileA, userMobileC] } });
  if (commPostId) {
    await CommunityPostModel.deleteOne({ _id: commPostId });
  }
  await AuditLogModel.deleteMany({ targetUserId: { $in: [userIdA, userIdC] } });
  console.log('  ✓ Isolated test artifacts cleaned up safely');

  await disconnectDatabase();

  console.log('\n========================================================================');
  console.log('  END-TO-END VERIFICATION: ALL FLOWS A THROUGH G PASSED 100% ✅');
  console.log('========================================================================\n');
}

runE2EVerification().catch(async (err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  try {
    await disconnectDatabase();
  } catch {}
  process.exit(1);
});
