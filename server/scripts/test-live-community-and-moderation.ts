import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { TokenService } from '../src/services/token.service';
import { CommunityPostModel } from '../src/models/community-post.model';
import { StorageService } from '../src/services/storage.service';
import { UserModel } from '../src/models/user.model';
import { AuditLogModel } from '../src/models/audit-log.model';

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runLiveVerification() {
  console.log('\n============================================================');
  console.log('  Live E2E Verification: Cloudinary, Community & Moderation');
  console.log('============================================================\n');

  await connectDatabase();
  const app = createApp();

  const adminId = '6ad07b99854a8c805630fdde';
  const memberId = '6acb80586348594ba7c71948';

  const adminToken = TokenService.generateTokens({
    userId: adminId,
    email: 'admin@shaadibanao.com',
    role: 'admin',
  }).accessToken;

  const memberToken = TokenService.generateTokens({
    userId: memberId,
    mobile: '7081745224',
    role: 'member',
  }).accessToken;

  // 1. Non-admin security check
  console.log('1. Testing Security Boundary (Non-admin member cannot moderate)...');
  const forbiddenRes = await request(app)
    .post('/api/v1/admin/community/fake_id/moderate')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ action: 'approve' });

  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected 403 for member calling admin endpoint, got ${forbiddenRes.status}`);
  }
  console.log('   ✓ Non-admin access strictly rejected with 403 FORBIDDEN');

  // 2. Direct Cloudinary Upload via Gateway
  console.log('\n2. Testing Image Upload to Cloudinary through Gateway...');
  const intentRes = await request(app)
    .post('/api/v1/storage/upload-intent')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({
      purpose: 'community_post',
      fileName: 'wedding_ritual.png',
      fileType: 'image/png',
      fileSizeBytes: 70,
    });

  if (!intentRes.body?.success) {
    throw new Error(`Upload intent failed: ${intentRes.body?.error?.message}`);
  }

  const uploadUrl = intentRes.body.data.uploadUrl;
  const uploadRes = await request(app)
    .post(uploadUrl)
    .send({ base64: SAMPLE_PNG_BASE64 });

  if (!uploadRes.body?.success || !uploadRes.body?.data?.secureUrl?.startsWith('https://res.cloudinary.com')) {
    throw new Error('Upload to Cloudinary via gateway failed');
  }

  const cloudMediaUrl = uploadRes.body.data.secureUrl;
  const cloudPublicId = uploadRes.body.data.publicId;
  console.log(`   ✓ Image uploaded to Cloudinary: ${cloudMediaUrl}`);
  console.log(`   ✓ Cloudinary Public ID: ${cloudPublicId}`);

  // 3. Create Community Post (Pending state)
  console.log('\n3. Creating Community Post...');
  const createPostRes = await request(app)
    .post('/api/v1/community/posts')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({
      mediaUrl: cloudMediaUrl,
      publicId: cloudPublicId,
      caption: 'Testing sacred wedding rituals and Cloudinary live asset verification.',
      category: 'wedding_story',
    });

  if (createPostRes.status !== 201) {
    throw new Error(`Failed to create post: ${JSON.stringify(createPostRes.body)}`);
  }

  const testPostId = createPostRes.body.data._id || createPostRes.body.data.id;
  console.log(`   ✓ Post created with ID: ${testPostId} (Status: pending)`);

  // 4. Verify post does NOT appear in public feed yet
  console.log('\n4. Checking Public Feed (Pending post must NOT be visible)...');
  const feedBefore = await request(app).get('/api/v1/community/feed');
  const isFoundBefore = (feedBefore.body?.data?.items || []).some((item: any) => item.id === testPostId);
  if (isFoundBefore) {
    throw new Error('Security Violation: Pending community post was exposed in public feed!');
  }
  console.log('   ✓ Verified: Pending post is NOT visible in public feed.');

  // 5. Admin List Posts
  console.log('\n5. Admin Listing Community Posts...');
  const adminListRes = await request(app)
    .get('/api/v1/admin/community?status=pending')
    .set('Authorization', `Bearer ${adminToken}`);

  const postInAdmin = (adminListRes.body?.data?.items || []).find((item: any) => item.id === testPostId);
  if (!postInAdmin) {
    throw new Error('Admin did not find the pending post in moderation queue');
  }
  console.log(`   ✓ Post found in admin queue: "${postInAdmin.caption}"`);
  console.log(`   ✓ Media URL in admin queue: ${postInAdmin.mediaUrl}`);

  // 6. Admin Approve (Publish) Post
  console.log('\n6. Admin Approving (Publishing) Post...');
  const approveRes = await request(app)
    .post(`/api/v1/admin/community/${testPostId}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'approve' });

  if (approveRes.status !== 200 || !approveRes.body?.success) {
    throw new Error(`Failed to approve post: ${JSON.stringify(approveRes.body)}`);
  }
  console.log('   ✓ Admin Publish response: 200 OK');

  // Verify in MongoDB
  const postInDb = await CommunityPostModel.findById(testPostId);
  if (postInDb?.moderationStatus !== 'approved') {
    throw new Error(`MongoDB status not updated: ${postInDb?.moderationStatus}`);
  }
  console.log('   ✓ MongoDB record verified: moderationStatus === "approved"');

  // Verify now visible in public feed
  const feedAfter = await request(app).get('/api/v1/community/feed');
  const isFoundAfter = (feedAfter.body?.data?.items || []).some((item: any) => item.id === testPostId);
  if (!isFoundAfter) {
    throw new Error('Approved post is missing from public feed!');
  }
  console.log('   ✓ Approved post is now LIVE in public feed!');

  // 7. Admin Reject / Remove Post
  console.log('\n7. Admin Rejecting / Removing Post with reason...');
  const rejectRes = await request(app)
    .post(`/api/v1/admin/community/${testPostId}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'reject', reason: 'Test moderation rejection verification' });

  if (rejectRes.status !== 200) {
    throw new Error(`Failed to reject post: ${JSON.stringify(rejectRes.body)}`);
  }

  const postAfterReject = await CommunityPostModel.findById(testPostId);
  if (postAfterReject?.moderationStatus !== 'rejected' || postAfterReject?.moderationReason !== 'Test moderation rejection verification') {
    throw new Error('MongoDB rejection state or reason not persisted');
  }
  console.log('   ✓ MongoDB record verified: moderationStatus === "rejected", reason persisted');

  // Verify no longer in public feed
  const feedAfterReject = await request(app).get('/api/v1/community/feed');
  const isFoundAfterReject = (feedAfterReject.body?.data?.items || []).some((item: any) => item.id === testPostId);
  if (isFoundAfterReject) {
    throw new Error('Rejected post is still visible in public feed!');
  }
  console.log('   ✓ Rejected post successfully removed from public feed.');

  // 8. Audit Log Verification
  console.log('\n8. Checking Audit Trail...');
  const auditLogs = await AuditLogModel.find({ 'details.postId': testPostId });
  if (auditLogs.length < 2) {
    throw new Error(`Expected at least 2 audit entries, found ${auditLogs.length}`);
  }
  console.log(`   ✓ Found ${auditLogs.length} audit entries for this post (APPROVE & REJECT)`);

  // Clean up test post & Cloudinary asset
  await CommunityPostModel.findByIdAndDelete(testPostId);
  await StorageService.deleteFromCloudinary(cloudPublicId).catch(() => {});
  console.log('   ✓ Test post and Cloudinary asset cleaned up cleanly.\n');

  console.log('============================================================');
  console.log('  🎉 ALL LIVE COMMUNITY & MODERATION TESTS PASSED!');
  console.log('============================================================\n');

  await disconnectDatabase();
}

runLiveVerification().catch(async (err) => {
  console.error('\n❌ Live Verification Failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
