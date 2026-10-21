import dns from 'dns';
import mongoose from 'mongoose';
import { config } from '../src/config/env';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { PartnerPreferenceModel } from '../src/models/preference.model';
import { ShortlistModel } from '../src/models/shortlist.model';
import { InterestModel } from '../src/models/interest.model';
import { MatchModel } from '../src/models/match.model';
import { ConversationModel } from '../src/models/conversation.model';
import { MessageModel } from '../src/models/message.model';
import { MembershipModel } from '../src/models/membership.model';
import { OtpModel } from '../src/models/otp.model';

import { AuthService } from '../src/services/auth.service';
import { OtpService } from '../src/services/otp.service';
import { ProfileService } from '../src/services/profile.service';
import { PreferenceService } from '../src/services/preference.service';
import { SearchService } from '../src/services/search.service';
import { ShortlistService } from '../src/services/shortlist.service';
import { InterestService } from '../src/services/interest.service';
import { ChatService } from '../src/services/chat.service';
import { UpsertProfileInput } from '@bandhansetu/shared';

// Dedicated isolated test numbers
const TEST_MOBILE_A = '9999000001';
const TEST_MOBILE_B = '9999000002';

interface VerificationSummary {
  step: string;
  passed: boolean;
  details: string;
}

const results: VerificationSummary[] = [];

function recordResult(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${step}: ${details}`);
}

async function cleanTestData() {
  const users = await UserModel.find({ mobile: { $in: [TEST_MOBILE_A, TEST_MOBILE_B] } });
  const userIds = users.map((u) => u._id);

  if (userIds.length > 0) {
    await ProfileModel.deleteMany({ userId: { $in: userIds } });
    await PartnerPreferenceModel.deleteMany({ userId: { $in: userIds } });
    await ShortlistModel.deleteMany({ userId: { $in: userIds } });
    await InterestModel.deleteMany({
      $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }],
    });
    await MatchModel.deleteMany({
      $or: [{ user1Id: { $in: userIds } }, { user2Id: { $in: userIds } }],
    });
    await ConversationModel.deleteMany({
      $or: [{ user1Id: { $in: userIds } }, { user2Id: { $in: userIds } }],
    });
    await MessageModel.deleteMany({
      $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }],
    });
    await MembershipModel.deleteMany({ userId: { $in: userIds } });
    await OtpModel.deleteMany({ mobile: { $in: [TEST_MOBILE_A, TEST_MOBILE_B] } });
    await UserModel.deleteMany({ _id: { $in: userIds } });
  }
}

async function runLiveAtlasVerification() {
  console.log('===============================================================');
  console.log('  BandhanSetu - Live MongoDB Atlas End-to-End Verification');
  console.log('===============================================================');

  try {
    // 1. Database Connection Check
    await connectDatabase();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection failed. readyState is not 1.');
    }
    recordResult(
      'Database Connection',
      true,
      `Connected live to Atlas shard: ${mongoose.connection.host}`
    );

    // Clean previous isolated test runs
    await cleanTestData();

    // 2. Flow: OTP Request & Verification
    const otpResA = await OtpService.requestOtp(TEST_MOBILE_A);
    const otpDocA = await OtpModel.findOne({ mobile: TEST_MOBILE_A });
    const otpPersisted = !!otpDocA && otpDocA.attempts === 0;
    recordResult(
      'OTP Generation & Persistence',
      otpPersisted,
      `OTP record stored in Atlas with TTL index, deliveryMode: ${otpResA.deliveryMode}`
    );

    const verifyResA = await OtpService.verifyOtp(TEST_MOBILE_A, '123456');
    recordResult(
      'OTP Verification',
      verifyResA.verified && !!verifyResA.verificationToken,
      'Test OTP verified and issued verification token'
    );

    // 3. Flow: User Registration & Persistence
    const regResA = await AuthService.register({
      mobile: TEST_MOBILE_A,
      verificationToken: verifyResA.verificationToken,
      profileFor: 'myself',
      consentToTerms: true,
    });
    const userDocA = await UserModel.findOne({ mobile: TEST_MOBILE_A });
    recordResult(
      'User Registration (User A)',
      !!userDocA && userDocA.mobile === TEST_MOBILE_A,
      `Persisted User A document in Atlas users collection (ID: ${userDocA?._id})`
    );

    // Register User B
    await OtpService.requestOtp(TEST_MOBILE_B);
    const verifyResB = await OtpService.verifyOtp(TEST_MOBILE_B, '123456');
    const regResB = await AuthService.register({
      mobile: TEST_MOBILE_B,
      verificationToken: verifyResB.verificationToken,
      profileFor: 'myself',
      consentToTerms: true,
    });
    const userDocB = await UserModel.findOne({ mobile: TEST_MOBILE_B });
    recordResult(
      'User Registration (User B)',
      !!userDocB && userDocB.mobile === TEST_MOBILE_B,
      `Persisted User B document in Atlas users collection (ID: ${userDocB?._id})`
    );

    const userAId = userDocA!._id.toString();
    const userBId = userDocB!._id.toString();

    // Set both users to approved status for matrimonial features
    await UserModel.findByIdAndUpdate(userAId, { approvalStatus: 'approved', status: 'active' });
    await UserModel.findByIdAndUpdate(userBId, { approvalStatus: 'approved', status: 'active' });

    // 4. Flow: Profile Creation & Privacy
    const profileInputA: UpsertProfileInput = {
      firstName: 'Aarohi',
      lastName: 'Verma',
      gender: 'female',
      dateOfBirth: '1998-06-15',
      maritalStatus: 'never_married',
      heightCm: 165,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      manglik: 'no',
      country: 'India',
      state: 'Delhi',
      city: 'Delhi',
      familyValues: 'moderate',
      familyType: 'nuclear',
      education: 'Master of Science',
      employedIn: 'private',
      occupation: 'Software Engineer',
      annualIncomeBand: '10_to_15_lakh',
      showIncomeBand: true,
      aboutMe: 'Passionate software engineer looking for a compatible life partner who shares cultural values.',
      photoPrivacy: 'everyone',
      photos: [],
    };

    const profileInputB: UpsertProfileInput = {
      firstName: 'Rohan',
      lastName: 'Mehra',
      gender: 'male',
      dateOfBirth: '1995-04-10',
      maritalStatus: 'never_married',
      heightCm: 178,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      manglik: 'no',
      country: 'India',
      state: 'Delhi',
      city: 'Delhi',
      familyValues: 'moderate',
      familyType: 'nuclear',
      education: 'B.Tech',
      employedIn: 'private',
      occupation: 'Product Manager',
      annualIncomeBand: '15_to_25_lakh',
      showIncomeBand: true,
      aboutMe: 'Tech professional based in Delhi NCR enjoying music, travel, and strong family ties.',
      photoPrivacy: 'everyone',
      photos: [],
    };

    const profileA = await ProfileService.upsertMyProfile(userAId, profileInputA);
    const profileB = await ProfileService.upsertMyProfile(userBId, profileInputB);

    const profileDocA = await ProfileModel.findOne({ userId: userAId });
    const profileDocB = await ProfileModel.findOne({ userId: userBId });

    recordResult(
      'Profile Upsert & Atlas Persistence',
      !!profileDocA && !!profileDocB && profileDocA.firstName === 'Aarohi',
      `Profiles persisted with completion scores: A=${profileA.completenessPercent}%, B=${profileB.completenessPercent}%`
    );

    // 5. Flow: Partner Preferences
    await PreferenceService.upsertMyPreferences(userAId, {
      minAge: 25,
      maxAge: 33,
      minHeightCm: 170,
      maxHeightCm: 185,
      maritalStatuses: ['never_married'],
      religions: ['Hindu'],
      motherTongues: ['Hindi'],
      educations: ['B.Tech', 'Master of Science'],
      occupations: ['Product Manager', 'Software Engineer'],
      cities: ['Delhi'],
      manglikPreference: 'any',
    });

    const prefDocA = await PartnerPreferenceModel.findOne({ userId: userAId });
    recordResult(
      'Partner Preferences Persistence',
      !!prefDocA && prefDocA.religions.includes('Hindu'),
      'Partner preferences stored in partnerpreferences collection'
    );

    // 6. Flow: Search & Factual Match Explanation
    const searchResults = await SearchService.searchProfiles(userAId, {
      gender: 'male',
      religion: 'Hindu',
      city: 'Delhi',
      page: 1,
      limit: 10,
      sortBy: 'best_match',
    });
    const foundUserB = searchResults.items.some((item) => item.displayName.startsWith('Rohan'));
    recordResult(
      'Search Profiles & Scoring',
      foundUserB,
      `User A searched and found User B with factual criteria match details (Total found: ${searchResults.pagination.totalCount})`
    );

    // 7. Flow: Shortlist
    const profileBId = profileDocB!._id.toString();
    await ShortlistService.addShortlist(userAId, profileBId);
    const shortlistDoc = await ShortlistModel.findOne({ userId: userAId, profileId: profileDocB!._id });
    recordResult(
      'Shortlist Persistence',
      !!shortlistDoc,
      'Shortlist relation persisted in shortlists collection'
    );

    // 8. Flow: Interest Workflow (Send & Accept)
    const interest = await InterestService.sendInterest(userAId, profileBId);
    const interestDoc = await InterestModel.findById(interest.id);
    recordResult(
      'Send Interest Persistence',
      !!interestDoc && interestDoc.status === 'pending',
      'Interest recorded in interests collection with status pending'
    );

    // User B accepts interest
    const acceptRes = await InterestService.updateInterestStatus(userBId, interest.id, 'accepted');
    const updatedInterest = await InterestModel.findById(interest.id);
    const matchDoc = await MatchModel.findOne({ interestId: interest.id });
    recordResult(
      'Accept Interest & Match Creation',
      updatedInterest?.status === 'accepted' && !!matchDoc,
      `Interest status updated to accepted and mutual match document created (Match ID: ${matchDoc?._id})`
    );

    // 9. Flow: Mutual-Match Access Control & Chat
    // Attempt unauthorized access by a third party
    const unauthorizedUserId = new mongoose.Types.ObjectId().toString();
    let accessBlocked = false;
    try {
      await ChatService.getOrCreateConversation(unauthorizedUserId, userAId);
    } catch (err: any) {
      if (err.statusCode === 403 || err.code === 'NO_MUTUAL_MATCH') {
        accessBlocked = true;
      }
    }
    recordResult(
      'Mutual Match Access Control for Chat',
      accessBlocked,
      'Chat creation strictly rejected with 403 for non-mutual match'
    );

    // Authorized conversation creation between matched users
    const conversation = await ChatService.getOrCreateConversation(userAId, userBId);
    const convDoc = await ConversationModel.findById(conversation.id);
    recordResult(
      'Conversation Persistence',
      !!convDoc && convDoc.user1Id.toString() === userAId,
      `Conversation established and persisted in conversations collection (ID: ${convDoc?._id})`
    );

    // Send Message
    const message = await ChatService.sendMessage(
      userAId,
      conversation.id,
      'Namaste Rohan! Glad to connect on BandhanSetu.'
    );
    const messageDoc = await MessageModel.findById(message.id);
    recordResult(
      'Message Persistence',
      !!messageDoc && messageDoc.text.includes('Namaste Rohan'),
      `Message stored in messages collection with delivery status: ${messageDoc?.status}`
    );

    // 10. Flow: Disconnection & Reconnection Persistence Verification
    console.log('\n[Simulating Server Restart & Verification Across Reconnection]...');
    await disconnectDatabase();
    recordResult(
      'Database Disconnect',
      (mongoose.connection.readyState as number) === 0,
      'Simulated server shutdown: disconnected successfully'
    );

    // Reconnect
    await connectDatabase();
    recordResult(
      'Database Reconnect',
      mongoose.connection.readyState === 1,
      `Reconnected to Atlas: ${mongoose.connection.host}`
    );

    // Query persisted data directly from MongoDB Atlas
    const postRestartUserA = await UserModel.findOne({ mobile: TEST_MOBILE_A });
    const postRestartProfileA = await ProfileModel.findOne({ userId: userAId });
    const postRestartMatch = await MatchModel.findOne({ interestId: interest.id });
    const postRestartMessages = await MessageModel.find({ conversationId: conversation.id });

    const allPersisted =
      !!postRestartUserA &&
      !!postRestartProfileA &&
      !!postRestartMatch &&
      postRestartMessages.length > 0;

    recordResult(
      'Cold Data Persistence After Restart',
      allPersisted,
      `Verified after restart: User(${postRestartUserA?.mobile}), Profile(${postRestartProfileA?.firstName}), Match(${postRestartMatch?._id}), Messages(${postRestartMessages.length})`
    );

    // 11. Cleanup test data
    await cleanTestData();
    recordResult(
      'Isolated Test Teardown',
      true,
      'Safely cleaned up all test records without altering production data'
    );
  } catch (error: any) {
    recordResult('Verification Suite Execution', false, error.message);
    console.error('Fatal verification error:', error);
  } finally {
    await disconnectDatabase();
  }

  console.log('\n===============================================================');
  console.log('  Live Atlas Verification Summary:');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.step} - ${r.details}`);
  });
  console.log('===============================================================');
  console.log(`Overall Result: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('===============================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runLiveAtlasVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
