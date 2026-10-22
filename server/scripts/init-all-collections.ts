import mongoose from 'mongoose';
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
import { AuditLogModel } from '../src/models/audit-log.model';
import { BannerModel } from '../src/models/banner.model';
import { BookingModel } from '../src/models/booking.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { KundliModel } from '../src/models/kundli.model';
import { PanditModel } from '../src/models/pandit.model';
import { ReportModel } from '../src/models/report.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';

const allModels = [
  { name: 'User', model: UserModel },
  { name: 'Profile', model: ProfileModel },
  { name: 'PartnerPreference', model: PartnerPreferenceModel },
  { name: 'Shortlist', model: ShortlistModel },
  { name: 'Interest', model: InterestModel },
  { name: 'Match', model: MatchModel },
  { name: 'Conversation', model: ConversationModel },
  { name: 'Message', model: MessageModel },
  { name: 'Membership', model: MembershipModel },
  { name: 'Otp', model: OtpModel },
  { name: 'AuditLog', model: AuditLogModel },
  { name: 'Banner', model: BannerModel },
  { name: 'Booking', model: BookingModel },
  { name: 'CommunityPost', model: CommunityPostModel },
  { name: 'Kundli', model: KundliModel },
  { name: 'Pandit', model: PanditModel },
  { name: 'Report', model: ReportModel },
  { name: 'VerificationRequest', model: VerificationRequestModel },
];

async function initializeCollectionsAndIndexes() {
  console.log('=================================================================');
  console.log('  ShaadiBanao — Database Collections & Schema Initializer');
  console.log('=================================================================\n');

  await connectDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is undefined.');
  }

  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host;
  console.log(`Connected Cluster Host : ${host}`);
  console.log(`Target Database Name   : ${dbName}\n`);

  console.log('Ensuring all 18 collections and indexes exist in MongoDB Atlas...\n');

  for (const item of allModels) {
    const collectionName = item.model.collection.name;

    try {
      // 1. Ensure collection exists
      await item.model.createCollection();
      
      // 2. Ensure indexes are built
      await item.model.syncIndexes();

      // 3. Count documents and indexes
      const count = await item.model.countDocuments();
      const indexes = await item.model.collection.indexes();

      console.log(
        `✓ [${item.name.padEnd(20)}] Collection: '${collectionName.padEnd(22)}' | Docs: ${count.toString().padEnd(4)} | Indexes: ${indexes.length}`
      );
    } catch (err: any) {
      console.error(`❌ Error on ${item.name} (${collectionName}):`, err.message);
    }
  }

  // List all collections directly from DB catalog
  const existingCollections = await db.listCollections().toArray();
  console.log(`\n=================================================================`);
  console.log(`  Total Active Collections in '${dbName}': ${existingCollections.length} / 18`);
  console.log(`=================================================================`);
  existingCollections.forEach((c, idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2)}. ${c.name}`);
  });
  console.log(`=================================================================\n`);

  await disconnectDatabase();
}

initializeCollectionsAndIndexes().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
