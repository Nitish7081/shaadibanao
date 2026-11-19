import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDbReady } from '../src/config/database';

async function clearOldData() {
  console.log('=================================================================');
  console.log('  ShaadiBanao — Database Cleanup & Reset for Fresh App Testing');
  console.log('=================================================================\n');

  console.log('[1/4] Connecting to MongoDB Atlas via standard config...');
  await connectDatabase();

  if (!isDbReady()) {
    throw new Error('Database connection failed. Please verify MONGODB_URI and internet connection.');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is undefined.');
  }

  console.log(`[2/4] Successfully connected to database: ${db.databaseName}`);
  console.log(`[3/4] Purging old member records across all collections...`);

  // List of all collections to completely wipe
  const collectionsToWipe = [
    'profiles',
    'partnerpreferences',
    'verificationrequests',
    'interests',
    'shortlists',
    'matches',
    'bookings',
    'conversations',
    'messages',
    'communityposts',
    'kundlis',
    'memberships',
    'reports',
    'pandits',
    'banners',
    'otprecords',
    'consentlogs',
    'auditlogs',
    'audit_probes',
    'accountdeletionrequests',
    'deletionotps',
    'contactinquiries',
  ];

  const results: Record<string, number> = {};

  for (const collName of collectionsToWipe) {
    try {
      const res = await db.collection(collName).deleteMany({});
      results[collName] = res.deletedCount || 0;
    } catch {
      // Collection may not exist yet
      results[collName] = 0;
    }
  }

  // For 'users' collection: Delete all member accounts, strictly PRESERVE admin accounts
  const usersColl = db.collection('users');
  const userDelRes = await usersColl.deleteMany({ role: { $ne: 'admin' } });
  results['users (non-admin members)'] = userDelRes.deletedCount || 0;

  console.log('\n--- Cleanup Summary ---');
  for (const [coll, count] of Object.entries(results)) {
    if (count > 0) {
      console.log(`  ✓ ${coll}: ${count} record(s) deleted`);
    } else {
      console.log(`  - ${coll}: 0 records (already clean)`);
    }
  }

  // Inspect preserved Admin accounts
  console.log('\n[4/4] Verifying Admin Account(s) status:');
  const admins = await usersColl.find({ role: 'admin' }).toArray();
  if (admins.length === 0) {
    console.warn('⚠️ No admin account found! Creating default super admin...');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('Admin@1234', 10);
    await usersColl.insertOne({
      email: 'admin@shaadibanao.com',
      displayName: 'Super Admin',
      role: 'admin',
      status: 'active',
      approvalStatus: 'approved',
      identityVerificationStatus: 'verified',
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('  ✓ Created admin: admin@shaadibanao.com / Admin@1234');
  } else {
    for (const adm of admins) {
      console.log(`  ✓ Admin Preserved: ${adm.email || '(no email)'} | Name: ${adm.displayName || 'Admin'} | Status: ${adm.status} | Role: ${adm.role}`);
    }
  }

  // Final verification of collection counts
  console.log('\n--- Final Database Status ---');
  const allColls = await db.listCollections().toArray();
  for (const c of allColls) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`  - ${c.name}: ${count} document(s)`);
  }

  console.log('\n=================================================================');
  console.log('  DATABASE CLEANUP COMPLETE! Fresh testing can begin now.');
  console.log('=================================================================');

  await disconnectDatabase();
}

clearOldData().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
