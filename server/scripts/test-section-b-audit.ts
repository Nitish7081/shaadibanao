import dns from 'dns';
import https from 'https';
import mongoose from 'mongoose';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Continue if DNS override is not permitted
}

import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { OtpModel } from '../src/models/otp.model';
import { StorageService } from '../src/services/storage.service';

const app = createApp();

// Valid 1x1 PNG data
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePngBuffer = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

function fetchUrlStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        resolve(res.statusCode || 0);
      })
      .on('error', (err) => reject(err));
  });
}

async function runSectionBAudit() {
  console.log('===================================================================');
  console.log('   Section B Verification: Admin & User Approval Workflow Suite');
  console.log('===================================================================\n');

  await connectDatabase();

  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });

  const testMobileA = '9888000001';
  const testMobileB = '9888000002';
  const cleanupCloudinaryPublicIds: string[] = [];

  try {
    // 0. Clean any existing test data
    await UserModel.deleteMany({ mobile: { $in: [testMobileA, testMobileB] } });
    await OtpModel.deleteMany({ mobile: { $in: [testMobileA, testMobileB] } });

    // -------------------------------------------------------------
    // Step 1: Submit Profile & Upload Photo for Test Account 1
    // -------------------------------------------------------------
    console.log('--- Step 1: Register User A, Submit Profile & Upload Photo ---');
    // Request OTP
    const reqOtpA = await request(app).post('/api/v1/auth/request-otp').send({ mobile: testMobileA });
    if (reqOtpA.status !== 200) throw new Error('User A request OTP failed');

    // Verify OTP
    const verOtpA = await request(app).post('/api/v1/auth/verify-otp').send({ mobile: testMobileA, otp: '123456' });
    const tokenA = verOtpA.body?.data?.verificationToken;
    if (!tokenA) throw new Error('User A verify OTP failed');

    // Register User A
    const regA = await request(app).post('/api/v1/auth/register').send({
      mobile: testMobileA,
      verificationToken: tokenA,
      profileFor: 'myself',
      consentToTerms: true,
    });
    const userAId = regA.body?.data?.user?.id;
    const userAToken = regA.body?.data?.tokens?.accessToken;
    console.log(`   ✓ User A registered: id=${userAId}, approvalStatus=${regA.body?.data?.user?.approvalStatus}`);

    // Request Signed Upload Intent for Profile Photo
    const intentRes = await request(app)
      .post('/api/v1/storage/upload-intent')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        purpose: 'profile_photo',
        fileName: 'portrait.png',
        fileType: 'image/png',
        fileSizeBytes: samplePngBuffer.length,
      });

    if (intentRes.status !== 200 || !intentRes.body?.data?.uploadUrl) {
      throw new Error(`Upload intent generation failed: ${JSON.stringify(intentRes.body)}`);
    }

    const intent = intentRes.body.data;
    console.log(`   ✓ Upload intent generated: key=${intent.fileKey}`);

    // Upload via Gateway into Cloudinary
    const uploadRes = await request(app)
      .post(intent.uploadUrl)
      .set('X-Upload-Signature', intent.headers['X-Upload-Signature'])
      .send({ base64: SAMPLE_PNG_BASE64 });

    if (uploadRes.status !== 200 || !uploadRes.body?.data?.publicId) {
      throw new Error(`Photo upload failed: ${JSON.stringify(uploadRes.body)}`);
    }

    const photoPublicId = uploadRes.body.data.publicId;
    const photoSecureUrl = uploadRes.body.data.secureUrl;
    cleanupCloudinaryPublicIds.push(photoPublicId);

    console.log(`   ✓ Photo uploaded to Cloudinary: publicId=${photoPublicId}`);
    console.log(`     secureUrl=${photoSecureUrl}`);

    // Submit Profile
    const profileRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        firstName: 'Ananya',
        lastName: 'Iyer',
        gender: 'female',
        dateOfBirth: '1996-08-20',
        maritalStatus: 'never_married',
        heightCm: 165,
        motherTongue: 'Tamil',
        religion: 'Hindu',
        country: 'India',
        state: 'Karnataka',
        city: 'Bengaluru',
        familyValues: 'traditional',
        familyType: 'nuclear',
        education: 'M.Tech Data Science',
        employedIn: 'private',
        occupation: 'Data Scientist',
        annualIncomeBand: '₹20L - ₹30L',
        showIncomeBand: true,
        photos: [
          {
            url: photoSecureUrl,
            publicId: photoPublicId,
            isMain: true,
            privacy: 'everyone',
            approved: false,
          },
        ],
        photoPrivacy: 'everyone',
        aboutMe: 'Analytical thinker with a love for classical Carnatic music and travel.',
      });

    if (profileRes.status !== 200) {
      throw new Error(`Profile creation failed: ${JSON.stringify(profileRes.body)}`);
    }
    console.log(`   ✓ Profile submitted with photos count: ${profileRes.body.data?.photos?.length}`);

    // -------------------------------------------------------------
    // Step 2 & 3: Confirm Profile & Image appear in Admin Panel & Image loads
    // -------------------------------------------------------------
    console.log('\n--- Step 2 & 3: Admin Panel Visibility & Cloudinary Image Verification ---');
    // Admin login
    const adminLogin = await request(app).post('/api/v1/admin/login').send({
      emailOrMobile: 'admin@shaadibanao.com',
      password: 'AdminPass123!',
    });

    if (adminLogin.status !== 200 || !adminLogin.body?.data?.tokens?.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    const adminToken = adminLogin.body.data.tokens.accessToken;
    console.log('   ✓ Admin authenticated successfully.');

    // Fetch pending approvals
    const approvalsRes = await request(app)
      .get('/api/v1/admin/approvals?approvalStatus=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    const userInApprovals = approvalsRes.body?.data?.items?.find((i: any) => i.id === userAId || i.mobile === testMobileA);
    if (!userInApprovals) {
      throw new Error(`User A not found in Admin Approvals list: ${JSON.stringify(approvalsRes.body)}`);
    }
    console.log(`   ✓ Profile found in admin approvals table: mobile=${userInApprovals.mobile}, status=${userInApprovals.approvalStatus}`);

    // Fetch pending photos
    const pendingPhotosRes = await request(app)
      .get('/api/v1/admin/photos/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    const pendingItems = pendingPhotosRes.body?.data?.items || [];
    const userItem = pendingItems.find((i: any) => i.userId === userAId || i.mobile === testMobileA);
    const foundPhoto = userItem?.photos?.[0];
    if (!foundPhoto) {
      throw new Error(`User A photo not found in pending photos queue: ${JSON.stringify(pendingPhotosRes.body)}`);
    }
    console.log(`   ✓ Image appears in admin pending photos queue: url=${foundPhoto.url}`);

    // Confirm image URL points to Cloudinary
    if (!foundPhoto.url.includes('res.cloudinary.com')) {
      throw new Error(`Photo URL does not point to Cloudinary: ${foundPhoto.url}`);
    }
    console.log('   ✓ Confirmed: URL points to Cloudinary domain (res.cloudinary.com).');

    // Confirm image loads correctly via HTTP GET
    const imageHttpCode = await fetchUrlStatus(foundPhoto.url);
    console.log(`   ✓ Image HTTP GET status check: ${imageHttpCode} (expected 200 OK)`);
    if (imageHttpCode !== 200) {
      throw new Error(`Image failed to load from Cloudinary CDN: HTTP ${imageHttpCode}`);
    }

    // -------------------------------------------------------------
    // Step 4: Approve Profile & Verify MongoDB Persistence
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Approve Profile and Verify MongoDB Persistence ---');
    const approveRes = await request(app)
      .post(`/api/v1/admin/approvals/${userAId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (approveRes.status !== 200 || approveRes.body?.data?.user?.approvalStatus !== 'approved') {
      throw new Error(`Admin approve user failed: ${JSON.stringify(approveRes.body)}`);
    }

    // Moderate / approve the photo as well
    const approvePhotoRes = await request(app)
      .post(`/api/v1/admin/photos/${userAId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve', reason: 'Verified profile photo in audit' });

    if (approvePhotoRes.status !== 200) {
      throw new Error(`Admin approve photo failed: ${JSON.stringify(approvePhotoRes.body)}`);
    }

    // Verify directly in MongoDB UserModel & ProfileModel
    const dbUserA = await UserModel.findById(userAId);
    const dbProfileA = await ProfileModel.findOne({ userId: userAId });

    if (!dbUserA || dbUserA.approvalStatus !== 'approved') {
      throw new Error(`User A status did not persist as approved in MongoDB: ${dbUserA?.approvalStatus}`);
    }
    if (!dbProfileA || dbProfileA.photos[0]?.approved !== true) {
      throw new Error(`User A photo approval did not persist in MongoDB ProfileModel: ${dbProfileA?.photos[0]?.approved}`);
    }
    console.log(`   ✓ Verified in MongoDB: UserModel.approvalStatus="${dbUserA.approvalStatus}", photo[0].approved=${dbProfileA.photos[0].approved}`);

    // Verify protected features are now unlocked for User A
    const searchResA = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${userAToken}`);
    console.log(`   ✓ User A protected search status: ${searchResA.status} (expected 200 OK)`);
    if (searchResA.status !== 200) {
      throw new Error(`Approved user was still blocked with status ${searchResA.status}`);
    }

    // -------------------------------------------------------------
    // Step 5: Reject a separate test profile and verify it remains blocked
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Reject Test Account B & Verify Blocked from Protected Features ---');
    // Register User B
    const reqOtpB = await request(app).post('/api/v1/auth/request-otp').send({ mobile: testMobileB });
    const verOtpB = await request(app).post('/api/v1/auth/verify-otp').send({ mobile: testMobileB, otp: '123456' });
    const tokenB = verOtpB.body?.data?.verificationToken;
    const regB = await request(app).post('/api/v1/auth/register').send({
      mobile: testMobileB,
      verificationToken: tokenB,
      profileFor: 'myself',
      consentToTerms: true,
    });
    const userBId = regB.body?.data?.user?.id;
    const userBToken = regB.body?.data?.tokens?.accessToken;
    console.log(`   ✓ User B registered: id=${userBId}, initial status=${regB.body?.data?.user?.approvalStatus}`);

    // Admin Rejects User B
    const rejectRes = await request(app)
      .post(`/api/v1/admin/approvals/${userBId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Incomplete or unverified identity credentials' });

    if (rejectRes.status !== 200 || rejectRes.body?.data?.user?.approvalStatus !== 'rejected') {
      throw new Error(`Admin reject failed: ${JSON.stringify(rejectRes.body)}`);
    }

    // Verify MongoDB status
    const dbUserB = await UserModel.findById(userBId);
    if (!dbUserB || dbUserB.approvalStatus !== 'rejected') {
      throw new Error(`User B status in MongoDB is not rejected: ${dbUserB?.approvalStatus}`);
    }
    console.log(`   ✓ Verified in MongoDB: UserModel.approvalStatus="${dbUserB.approvalStatus}"`);

    // Verify Rejected User B is BLOCKED from Search
    const searchResB = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${userBToken}`);
    console.log(`   ✓ User B search attempt: HTTP ${searchResB.status} (expected 403)`);
    if (searchResB.status !== 403) {
      throw new Error(`Rejected user was not blocked with 403: got ${searchResB.status}`);
    }

    // Verify Rejected User B is BLOCKED from Chat Conversations
    const convResB = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userBToken}`);
    console.log(`   ✓ User B conversations attempt: HTTP ${convResB.status} (expected 403)`);
    if (convResB.status !== 403) {
      throw new Error(`Rejected user was not blocked from conversations: got ${convResB.status}`);
    }

    // -------------------------------------------------------------
    // Step 6: Confirm pending/rejected photos are not publicly exposed
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Privacy Guard for Pending / Rejected Photos ---');
    // User A has an approved photo
    const publicProfileA = await request(app)
      .get(`/api/v1/profiles/${userAId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    console.log(`   ✓ Approved User A public profile photos count: ${publicProfileA.body?.data?.photos?.length} (expected 1)`);
    if (publicProfileA.body?.data?.photos?.length !== 1) {
      throw new Error(`Approved photo not present in public profile of User A: ${JSON.stringify(publicProfileA.body)}`);
    }

    // Create unapproved / rejected photo for User B
    await ProfileModel.create({
      userId: userBId,
      firstName: 'Rohit',
      lastName: 'Kumar',
      gender: 'male',
      dateOfBirth: new Date('1993-01-01'),
      maritalStatus: 'never_married',
      heightCm: 172,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      country: 'India',
      state: 'Delhi',
      city: 'Delhi',
      familyValues: 'moderate',
      familyType: 'nuclear',
      education: 'B.Com',
      employedIn: 'business',
      occupation: 'Retail Business',
      annualIncomeBand: '₹10L - ₹15L',
      photos: [
        {
          url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          publicId: 'sample_pending_b',
          isMain: true,
          privacy: 'everyone',
          approved: false, // Pending / Not approved
        },
      ],
      photoPrivacy: 'everyone',
    });

    const publicProfileB = await request(app)
      .get(`/api/v1/profiles/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`); // Requested by eligible user A
    console.log(`   ✓ Unapproved photo in User B public profile count: ${publicProfileB.body?.data?.photos?.length || 0} (expected 0)`);
    if ((publicProfileB.body?.data?.photos?.length || 0) !== 0) {
      throw new Error('Unapproved photo was leaked in public profile endpoint!');
    }

    // -------------------------------------------------------------
    // Step 7: Verify Admin actions are authorized on backend
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Backend Authorization Guards on Admin Endpoints ---');
    // Attempt approve with no token -> 401
    const noTokenRes = await request(app)
      .post(`/api/v1/admin/approvals/${userAId}/approve`);
    console.log(`   ✓ Unauthenticated admin call: HTTP ${noTokenRes.status} (expected 401)`);
    if (noTokenRes.status !== 401) {
      throw new Error(`Expected 401, got ${noTokenRes.status}`);
    }

    // Attempt approve with member token -> 403
    const memberTokenRes = await request(app)
      .post(`/api/v1/admin/approvals/${userAId}/approve`)
      .set('Authorization', `Bearer ${userAToken}`);
    console.log(`   ✓ Standard member admin call: HTTP ${memberTokenRes.status} (expected 403)`);
    if (memberTokenRes.status !== 403) {
      throw new Error(`Expected 403, got ${memberTokenRes.status}`);
    }

    // Attempt photo moderate with member token -> 403
    const memberModRes = await request(app)
      .post(`/api/v1/admin/photos/${userAId}/moderate`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ action: 'approve' });
    console.log(`   ✓ Standard member photo moderate: HTTP ${memberModRes.status} (expected 403)`);
    if (memberModRes.status !== 403) {
      throw new Error(`Expected 403, got ${memberModRes.status}`);
    }

    console.log('   ✓ Admin actions strictly enforced on backend with role-based checks.');

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Cleanup Test Assets ---');
    for (const pid of cleanupCloudinaryPublicIds) {
      await StorageService.deleteFromCloudinary(pid);
      console.log(`   ✓ Cloudinary test asset cleaned up: ${pid}`);
    }
    await UserModel.deleteMany({ mobile: { $in: [testMobileA, testMobileB] } });
    await ProfileModel.deleteMany({ userId: { $in: [userAId, userBId] } });
    await OtpModel.deleteMany({ mobile: { $in: [testMobileA, testMobileB] } });
    console.log('   ✓ Test database documents cleaned up.');

    console.log('\n===================================================================');
    console.log('   🎉 SECTION B: ALL ADMIN & APPROVAL WORKFLOW CHECKS PASSED!');
    console.log('===================================================================\n');
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

runSectionBAudit().catch((err) => {
  console.error('\n❌ SECTION B VERIFICATION FAILED:', err);
  process.exit(1);
});
