/**
 * ONE-TIME migration: existing PUBLIC profile photos  ->  Cloudinary type "authenticated".
 *                                   *** REVIEW BEFORE RUNNING ***
 *
 *   DRY RUN (default; reads the DB, calls NOTHING on Cloudinary, writes NOTHING):
 *       npx ts-node scripts/migrate-photos-to-authenticated.ts
 *       npx ts-node scripts/migrate-photos-to-authenticated.ts --user-ids <id1>,<id2>
 *
 *   APPLY (only after you reviewed the dry run; needs BOTH the flag and the env guard):
 *       $env:CONFIRM_PHOTO_MIGRATION='yes'; npx ts-node scripts/migrate-photos-to-authenticated.ts --apply
 *
 * What it does, per photo whose stored url is a public `/image/upload/` Cloudinary URL
 * inside shaadibanao/profiles/<userId>/:
 *   1. Cloudinary Rename API:  rename(publicId, publicId, { type: 'upload', to_type: 'authenticated' })
 *      (same public id, only the delivery type changes; the asset gets a new version number)
 *   2. updates ONLY that photo's `url` in Mongo with the URL Cloudinary returns (apply mode only).
 * No schema change. No photos deleted. Photos already authenticated / non-Cloudinary are skipped.
 * Output: profile id, photo id, public id and the old/new URL. Never prints secrets.
 *
 * Idempotent: a second run skips photos that are already authenticated.
 */
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { config } from '../src/config/env';
import { ProfileModel } from '../src/models/profile.model';
import { planPhotoMigration, PhotoMigrationPlan } from '../src/services/photoMigration';

const APPLY = process.argv.includes('--apply');
const userIdsArg = process.argv.find((a) => a.startsWith('--user-ids='))
  ?? (process.argv.includes('--user-ids') ? `--user-ids=${process.argv[process.argv.indexOf('--user-ids') + 1]}` : '');
const ONLY_USERS = userIdsArg ? userIdsArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : [];

async function main() {
  console.log(`[photos-auth] mode: ${APPLY ? 'APPLY (writes!)' : 'DRY RUN (no changes)'}`);
  if (APPLY && process.env.CONFIRM_PHOTO_MIGRATION !== 'yes') {
    console.error("[photos-auth] Refusing to apply: set CONFIRM_PHOTO_MIGRATION='yes' after reviewing the dry run.");
    process.exit(1);
  }
  if (APPLY) {
    if (!config.cloudinary.isConfigured) {
      console.error('[photos-auth] Cloudinary is not configured. Aborting.');
      process.exit(1);
    }
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
  }

  await connectDatabase();
  const filter: any = ONLY_USERS.length ? { userId: { $in: ONLY_USERS } } : {};
  const profiles: any[] = await (ProfileModel as any).find(filter).select('userId photos');

  const stats = { profiles: profiles.length, photos: 0, toMigrate: 0, skipped: 0, migrated: 0, failed: 0 };
  const plans: Array<Extract<PhotoMigrationPlan, { action: 'migrate' }> & { profileId: string; photoId: string }> = [];

  for (const profile of profiles) {
    for (const photo of profile.photos || []) {
      stats.photos++;
      const plan = planPhotoMigration({ url: photo.url, publicId: photo.publicId }, String(profile.userId));
      if (plan.action === 'skip') {
        stats.skipped++;
        const ref = /^https?:\/\//i.test(photo.url || '') ? String(photo.url).split('/')[2] : String(photo.url || '').split('/').slice(0, 2).join('/');
        console.log(`  SKIP     profile=${profile._id} photo=${photo._id} reason=${plan.reason} ref=${ref}`);
        continue;
      }
      stats.toMigrate++;
      const item = { ...plan, profileId: String(profile._id), photoId: String(photo._id) };
      plans.push(item);
      console.log(`  MIGRATE  profile=${item.profileId} user=${profile.userId} photo=${item.photoId}`);
      console.log(`           publicId : ${plan.publicId}`);
      console.log(`           old url  : ${plan.oldUrl}`);
      console.log(`           new url  : ${plan.newUrlPreview}`);
      console.log('           (Cloudinary assigns a new version on apply; the stored url will use that version)');
    }
  }

  if (APPLY) {
    for (const item of plans) {
      try {
        const res: any = await cloudinary.uploader.rename(item.publicId, item.publicId, {
          type: 'upload',
          to_type: 'authenticated',
          resource_type: 'image',
          overwrite: false,
          invalidate: true,
        });
        const newUrl: string = res?.secure_url;
        if (!newUrl || !newUrl.includes('/image/authenticated/')) throw new Error('unexpected rename response');
        await (ProfileModel as any).updateOne(
          { _id: new mongoose.Types.ObjectId(item.profileId) },
          { $set: { 'photos.$[p].url': newUrl } },
          { arrayFilters: [{ 'p._id': new mongoose.Types.ObjectId(item.photoId) }] }
        );
        stats.migrated++;
        console.log(`  DONE     photo=${item.photoId}`);
      } catch (e: any) {
        stats.failed++;
        console.error(`  FAILED   photo=${item.photoId} reason=${String(e?.message || 'error').slice(0, 120)}`);
      }
    }
  }

  console.log('[photos-auth] summary:', JSON.stringify(stats));
  if (!APPLY) console.log('[photos-auth] DRY RUN only - nothing was changed on Cloudinary or in the database.');
  await disconnectDatabase();
}

main().catch(async (e) => {
  console.error('[photos-auth] fatal:', String(e?.message || e).slice(0, 200));
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
