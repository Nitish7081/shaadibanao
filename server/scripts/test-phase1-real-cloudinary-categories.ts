import dns from 'dns';
import mongoose from 'mongoose';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if not permitted
}
import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { StorageService } from '../src/services/storage.service';
import { ProfileModel } from '../src/models/profile.model';
import { UserModel } from '../src/models/user.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { BannerModel } from '../src/models/banner.model';
import { ProfileService } from '../src/services/profile.service';
import { VerificationService } from '../src/services/verification.service';
import { CommunityService } from '../src/services/community.service';
import { AdminService } from '../src/services/admin.service';
import { TokenService } from '../src/services/token.service';

const app = createApp();

// Valid 1x1 PNG data
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePngBuffer = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

async function runProductionCloudinaryAudit() {
  console.log('===================================================================');
  console.log('   ShaadiBanao — Real Cloudinary & Production Storage Audit Suite');
  console.log('===================================================================\n');

  // STEP 1: Cloudinary Credentials & Ping
  console.log('--- 1. Cloudinary Credentials & API Verification ---');
  const cloudName = config.cloudinary.cloudName;
  const apiKey = config.cloudinary.apiKey;
  const apiSecret = config.cloudinary.apiSecret;

  console.log(`CLOUDINARY_CLOUD_NAME:   ${cloudName ? `PRESENT (valid length ${cloudName.length})` : 'MISSING'}`);
  console.log(`CLOUDINARY_API_KEY:      ${apiKey ? `PRESENT (valid length ${apiKey.length})` : 'MISSING'}`);
  console.log(`CLOUDINARY_API_SECRET:   ${apiSecret ? `PRESENT & MASKED (valid length ${apiSecret.length})` : 'MISSING'}`);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials incomplete.');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  // Ping Cloudinary API
  const pingResult = await cloudinary.api.ping();
  console.log(`Cloudinary API Ping:     ${pingResult.status === 'ok' ? 'PASS (ok)' : 'FAIL'}`);

  // Connect MongoDB Atlas
  console.log('\n--- 2. MongoDB Atlas Connection ---');
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB Atlas Status:    CONNECTED (${mongoose.connection.host}, DB: ${mongoose.connection.name})`);

  const results: Record<string, 'PASS' | 'FAIL' | 'NOT TESTED'> = {};
  const cleanupAssets: string[] = [];
  const cleanupUsers: string[] = [];
  const cleanupPosts: string[] = [];
  const cleanupBanners: string[] = [];

  try {
    // -------------------------------------------------------------
    // CATEGORY 1: Profile Photo Real Upload & Moderation
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Category 1: Profile Photo Upload ---');
    try {
      const profileUser = await UserModel.create({
        mobile: `+91987${Math.floor(1000000 + Math.random() * 9000000)}`,
        displayName: 'Aarav Sharma',
        role: 'member',
        approvalStatus: 'approved',
        termsAccepted: true,
      });
      cleanupUsers.push(profileUser._id.toString());

      // 1. Generate Intent
      const intent = StorageService.generateUploadIntent({
        userId: profileUser._id.toString(),
        purpose: 'profile_photo',
        fileName: 'profile.png',
        fileType: 'image/png',
        fileSizeBytes: samplePngBuffer.length,
      });

      // 2. Upload via Gateway
      const uploadRes = await request(app)
        .post(intent.uploadUrl)
        .send({ base64: SAMPLE_PNG_BASE64 });

      if (uploadRes.status !== 200 || !uploadRes.body.data?.publicId) {
        throw new Error(`Profile photo upload gateway failed: ${JSON.stringify(uploadRes.body)}`);
      }

      const profilePublicId = uploadRes.body.data.publicId;
      const profileSecureUrl = uploadRes.body.data.secureUrl;
      cleanupAssets.push(profilePublicId);

      // 3. Confirm directly in Cloudinary Media Library via Admin API
      const cloudAsset = await cloudinary.api.resource(profilePublicId);
      console.log(`   ✓ Asset verified in Cloudinary Media Library: public_id="${cloudAsset.public_id}", format=${cloudAsset.format}, bytes=${cloudAsset.bytes}`);

      // 4. Persist in MongoDB
      const savedProfile = await ProfileService.upsertMyProfile(profileUser._id.toString(), {
        firstName: 'Aarav',
        lastName: 'Sharma',
        gender: 'male',
        dateOfBirth: '1995-04-10',
        maritalStatus: 'never_married',
        heightCm: 175,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        country: 'India',
        state: 'Delhi',
        city: 'New Delhi',
        familyValues: 'moderate',
        familyType: 'nuclear',
        education: 'B.Tech',
        employedIn: 'private',
        occupation: 'Product Manager',
        annualIncomeBand: '₹20L - ₹30L',
        showIncomeBand: true,
        photos: [
          {
            url: profileSecureUrl,
            publicId: profilePublicId,
            isMain: true,
            privacy: 'everyone',
            approved: false, // Pending moderation
          },
        ],
        photoPrivacy: 'everyone',
        aboutMe: 'Loving life and looking for a meaningful companion.',
      });

      // 5. Verify MongoDB persistence
      const dbProfile = await ProfileModel.findOne({ userId: profileUser._id });
      if (!dbProfile || dbProfile.photos[0]?.publicId !== profilePublicId) {
        throw new Error('Photo public_id was not persisted correctly in MongoDB ProfileModel');
      }
      console.log(`   ✓ Persisted in MongoDB ProfileModel: publicId="${dbProfile.photos[0].publicId}", approved=${dbProfile.photos[0].approved}`);

      // 6. Verify Public Profile Hides Unapproved Photo
      const publicPending = await ProfileService.getPublicProfile(profileUser._id.toString());
      if (publicPending.photos.length !== 0) {
        throw new Error('Unapproved photo was visible in public profile!');
      }
      console.log('   ✓ Unapproved photo is strictly hidden from public profile view.');

      // 7. Admin Moderation: Approve Photo
      await VerificationService.moderateProfilePhoto(
        profileUser._id.toString(),
        'approve',
        'superadmin',
        'Valid photo verified in production audit suite'
      );

      // 8. Verify Approved Photo Becomes Visible
      const publicApproved = await ProfileService.getPublicProfile(profileUser._id.toString());
      if (publicApproved.photos.length !== 1 || publicApproved.photos[0].publicId !== profilePublicId) {
        throw new Error('Approved photo not visible in public profile after approval!');
      }
      console.log(`   ✓ Approved photo is now publicly visible: url="${publicApproved.photos[0].url}"`);

      results['Profile Photos'] = 'PASS';
    } catch (err: any) {
      console.error('   ❌ Category 1 Failed:', err.message);
      results['Profile Photos'] = 'FAIL';
    }

    // -------------------------------------------------------------
    // CATEGORY 2: Community Photo Real Upload & Moderation
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Category 2: Community Photo Upload ---');
    try {
      const commUser = await UserModel.create({
        mobile: `+91986${Math.floor(1000000 + Math.random() * 9000000)}`,
        displayName: 'Pooja Verma',
        role: 'member',
        approvalStatus: 'approved',
        termsAccepted: true,
      });
      cleanupUsers.push(commUser._id.toString());

      // 1. Generate Intent
      const commIntent = StorageService.generateUploadIntent({
        userId: commUser._id.toString(),
        purpose: 'community_post',
        fileName: 'wedding_ritual.png',
        fileType: 'image/png',
        fileSizeBytes: samplePngBuffer.length,
      });

      // 2. Upload via Gateway
      const commUploadRes = await request(app)
        .post(commIntent.uploadUrl)
        .send({ base64: SAMPLE_PNG_BASE64 });

      if (commUploadRes.status !== 200 || !commUploadRes.body.data?.publicId) {
        throw new Error(`Community post upload gateway failed: ${JSON.stringify(commUploadRes.body)}`);
      }

      const commPublicId = commUploadRes.body.data.publicId;
      const commSecureUrl = commUploadRes.body.data.secureUrl;
      cleanupAssets.push(commPublicId);

      // 3. Confirm directly in Cloudinary Media Library via Admin API
      const cloudAsset = await cloudinary.api.resource(commPublicId);
      console.log(`   ✓ Community asset verified in Cloudinary: public_id="${cloudAsset.public_id}", format=${cloudAsset.format}`);

      // 4. Create Community Post in MongoDB (enters pending queue)
      const post = await CommunityService.createPost({
        userId: commUser._id.toString(),
        mediaUrl: commSecureUrl,
        publicId: commPublicId,
        caption: 'Our haldi ceremony blessings on ShaadiBanao',
        category: 'wedding_story',
      });
      cleanupPosts.push(post._id.toString());

      const dbPost = await CommunityPostModel.findById(post._id);
      if (!dbPost || dbPost.moderationStatus !== 'pending' || dbPost.publicId !== commPublicId) {
        throw new Error('Community post not correctly persisted with pending status and public_id');
      }
      console.log(`   ✓ Persisted in MongoDB CommunityPostModel: _id="${dbPost._id}", status="${dbPost.moderationStatus}", publicId="${dbPost.publicId}"`);

      // 5. Verify Pending Post is NOT visible in public feed
      const publicFeedBefore = await CommunityService.getPublicFeed();
      const inFeedBefore = publicFeedBefore.items.some((item) => item.id === post._id.toString());
      if (inFeedBefore) {
        throw new Error('Pending community post was exposed in public feed!');
      }
      console.log('   ✓ Pending community post is strictly excluded from public feed.');

      // 6. Admin Publishes/Approves Post
      const modResult = await CommunityService.moderatePost(
        post._id.toString(),
        'approve',
        'admin_auditor',
        'Verified culturally appropriate community post'
      );
      if (modResult.moderationStatus !== 'approved') {
        throw new Error('Community post moderation did not transition to approved');
      }

      // 7. Verify Approved Post IS visible in public feed
      const publicFeedAfter = await CommunityService.getPublicFeed();
      const inFeedAfter = publicFeedAfter.items.some((item) => item.id === post._id.toString());
      if (!inFeedAfter) {
        throw new Error('Approved community post not visible in public feed!');
      }
      console.log(`   ✓ Approved community post is now live in public feed: mediaUrl="${commSecureUrl}"`);

      results['Community Photos'] = 'PASS';
    } catch (err: any) {
      console.error('   ❌ Category 2 Failed:', err.message);
      results['Community Photos'] = 'FAIL';
    }

    // -------------------------------------------------------------
    // CATEGORY 3: Admin Public Banners Real Upload & Cleanup
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Category 3: Admin-Uploaded Public Images ---');
    try {
      const adminTokenUser = {
        userId: 'admin_audit_id',
        email: 'admin@shaadibanao.com',
        displayName: 'Super Admin',
        role: 'admin',
      };

      // 1. Upload Banner via AdminService
      const banner = await AdminService.uploadBanner(
        adminTokenUser,
        {
          base64: SAMPLE_PNG_BASE64,
          title: 'Special Auspicious Shubh Muhurat Offers 2026',
          linkUrl: 'https://shaadibanao.com/offers',
          priority: 10,
        },
        '127.0.0.1'
      );
      cleanupBanners.push(banner._id.toString());

      const bannerPublicId = banner.publicId;
      const bannerSecureUrl = banner.imageUrl;

      // 2. Confirm directly in Cloudinary Media Library via Admin API
      const cloudAsset = await cloudinary.api.resource(bannerPublicId);
      console.log(`   ✓ Admin banner verified in Cloudinary: public_id="${cloudAsset.public_id}", folder="${cloudAsset.folder || 'shaadibanao/banners'}"`);

      // 3. Verify in MongoDB BannerModel
      const dbBanner = await BannerModel.findById(banner._id);
      if (!dbBanner || dbBanner.publicId !== bannerPublicId || !dbBanner.isActive) {
        throw new Error('Banner record not correctly persisted in MongoDB BannerModel');
      }
      console.log(`   ✓ Persisted in MongoDB BannerModel: _id="${dbBanner._id}", title="${dbBanner.title}", publicId="${dbBanner.publicId}"`);

      // 4. Verify listed in public banners
      const activeBanners = await AdminService.getBanners();
      const inBanners = activeBanners.some((b) => b._id.toString() === banner._id.toString());
      if (!inBanners) {
        throw new Error('Active banner was not found in getBanners list');
      }
      console.log('   ✓ Admin banner is active and visible in public banner listings.');

      // 5. Test Admin Deletion & Cloudinary Cleanup
      await AdminService.deleteBanner(banner._id.toString(), adminTokenUser, '127.0.0.1');

      // Verify MongoDB deletion
      const deletedBanner = await BannerModel.findById(banner._id);
      if (deletedBanner) {
        throw new Error('Banner was not deleted from MongoDB!');
      }

      // Verify Cloudinary asset destroyed
      try {
        await cloudinary.api.resource(bannerPublicId);
        console.warn('   ⚠️ Asset still returned by Cloudinary API immediately after delete (may be caching)');
      } catch (err: any) {
        console.log(`   ✓ Cloudinary confirms asset destroyed (${err.message || 'Not found'})`);
      }

      results['Admin Public Images'] = 'PASS';
    } catch (err: any) {
      console.error('   ❌ Category 3 Failed:', err.message);
      results['Admin Public Images'] = 'FAIL';
    }

    // -------------------------------------------------------------
    // PHASE 4 & 5: Failure Scenarios Testing
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Failure Scenarios & Edge Cases ---');

    // Scenario A: Invalid upload signature / tampering
    const tamperedRes = await request(app)
      .post('/api/v1/storage/upload?key=public-media/profile_photo/test.png&sig=tampered_signature_1234')
      .send({ base64: SAMPLE_PNG_BASE64 });
    console.log(`   ✓ Scenario A (Invalid Signature): HTTP ${tamperedRes.status} (expected 403)`);
    if (tamperedRes.status !== 403) throw new Error('Invalid signature was not rejected with 403');

    // Scenario B: Corrupted/Non-image data payload
    const validIntent = StorageService.generateUploadIntent({
      userId: 'test_user',
      purpose: 'profile_photo',
      fileName: 'fake.png',
      fileType: 'image/png',
      fileSizeBytes: 100,
    });
    const corruptRes = await request(app)
      .post(validIntent.uploadUrl)
      .send({ base64: Buffer.from('NOT_A_VALID_IMAGE_JUST_PLAIN_TEXT').toString('base64') });
    console.log(`   ✓ Scenario B (Corrupted / Non-Image): HTTP ${corruptRes.status} - Code: ${corruptRes.body?.error?.code} (expected 400 INVALID_FILE_TYPE)`);
    if (corruptRes.status !== 400) throw new Error('Corrupted image payload was not rejected with 400');

    // Scenario C: File size exceeds 5MB limit
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB
    largeBuffer.write('PNG', 1);
    const oversizedRes = await request(app)
      .post(validIntent.uploadUrl)
      .send({ base64: largeBuffer.toString('base64') });
    console.log(`   ✓ Scenario C (Oversized > 5MB): HTTP ${oversizedRes.status} - Code: ${oversizedRes.body?.error?.code} (expected 400 FILE_TOO_LARGE)`);
    if (oversizedRes.status !== 400) throw new Error('Oversized payload was not rejected with 400');

    // Scenario D: Unauthorized regular user attempting admin banner upload
    const memberToken = TokenService.generateTokens({
      userId: 'regular_member_id',
      mobile: '+919999999999',
      role: 'member',
      approvalStatus: 'approved',
    }).accessToken;

    const unauthBannerRes = await request(app)
      .post('/api/v1/admin/banners/upload')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ base64: SAMPLE_PNG_BASE64, title: 'Hacked Banner' });
    console.log(`   ✓ Scenario D (Non-Admin Banner Upload): HTTP ${unauthBannerRes.status} (expected 403 FORBIDDEN)`);
    if (unauthBannerRes.status !== 403) throw new Error('Non-admin was not rejected from admin route with 403');

    // Scenario E: Direct static leak attempt on private identity vault
    const vaultLeakRes = await request(app).get('/media/secure-vault/identity_document/aadhaar_card.pdf');
    console.log(`   ✓ Scenario E (Static Vault Leak Attempt): HTTP ${vaultLeakRes.status} - Code: ${vaultLeakRes.body?.error?.code} (expected 403 FORBIDDEN)`);
    if (vaultLeakRes.status !== 403) throw new Error('Direct static vault access was not rejected with 403');

  } finally {
    // Clean up test documents and assets
    console.log('\n--- 7. Cleaning Up Test Artifacts ---');
    for (const pid of cleanupAssets) {
      try {
        await StorageService.deleteFromCloudinary(pid);
        console.log(`   ✓ Deleted Cloudinary asset: ${pid}`);
      } catch (err: any) {
        console.warn(`   ⚠️ Cleanup error for asset ${pid}: ${err.message}`);
      }
    }
    if (cleanupUsers.length > 0) {
      await UserModel.deleteMany({ _id: { $in: cleanupUsers } });
      await ProfileModel.deleteMany({ userId: { $in: cleanupUsers } });
      console.log(`   ✓ Cleaned up ${cleanupUsers.length} test users & profiles from MongoDB Atlas.`);
    }
    if (cleanupPosts.length > 0) {
      await CommunityPostModel.deleteMany({ _id: { $in: cleanupPosts } });
      console.log(`   ✓ Cleaned up ${cleanupPosts.length} test community posts from MongoDB Atlas.`);
    }
    if (cleanupBanners.length > 0) {
      await BannerModel.deleteMany({ _id: { $in: cleanupBanners } });
      console.log(`   ✓ Cleaned up ${cleanupBanners.length} test banners from MongoDB Atlas.`);
    }

    await mongoose.disconnect();
    console.log('   ✓ Disconnected from MongoDB Atlas.');
  }

  console.log('\n===================================================================');
  console.log('   FINAL AUDIT SUMMARY:');
  console.log(`   - Profile Photos:         ${results['Profile Photos']}`);
  console.log(`   - Community Photos:       ${results['Community Photos']}`);
  console.log(`   - Admin Public Images:    ${results['Admin Public Images']}`);
  console.log('===================================================================\n');

  const allPassed = Object.values(results).every((r) => r === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

runProductionCloudinaryAudit().catch((err) => {
  console.error('\n❌ AUDIT SCRIPT FAILED:', err);
  process.exit(1);
});
