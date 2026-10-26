/**
 * OPTIONAL one-time migration: local-disk uploads  ->  Cloudinary.   *** REVIEW BEFORE RUNNING ***
 *
 *   DRY RUN (default, changes nothing):  npx ts-node scripts/migrate-local-uploads-to-cloudinary.ts
 *   APPLY:                               npx ts-node scripts/migrate-local-uploads-to-cloudinary.ts --apply
 *
 * What it does
 *  - Profile photos / community posts whose DB url is a local "/media/..." path
 *      -> uploaded as PUBLIC Cloudinary images; DB field replaced with secure_url.
 *  - Identity verification docs whose documentStorageKey is a local "secure-vault/..." key
 *      -> uploaded as PRIVATE (type "authenticated") under shaadibanao/private/identity_document/<userId>/;
 *         documentStorageKey replaced with the private public_id. (No raw URL stored or printed.)
 *  - Existing DB fields only. No schema change.
 *  - NEVER deletes local files (you may remove them manually later, after verifying).
 *  - Never prints URLs, keys, file contents or document numbers - only counts and record ids.
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { StorageService } from '../src/services/storage.service';
import { ProfileModel } from '../src/models/profile.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';

const APPLY = process.argv.includes('--apply');
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

/** Resolve a stored reference to a file inside uploads/ (blocks path traversal). */
function resolveLocal(ref: string): string | null {
  const rel = ref.replace(/^\/?media\//, '').replace(/^\//, '');
  const abs = path.resolve(UPLOADS_DIR, rel);
  if (!abs.startsWith(UPLOADS_DIR + path.sep)) return null;
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

const stats = { scanned: 0, migrated: 0, missingFile: 0, failed: 0 };

async function migratePublic(ref: string, folder: string): Promise<string | null> {
  const abs = resolveLocal(ref);
  if (!abs) {
    stats.missingFile++;
    return null;
  }
  if (!APPLY) return 'DRY_RUN';
  const res = await StorageService.uploadToCloudinary(fs.readFileSync(abs), { folder });
  return res.secureUrl;
}

async function main() {
  console.log(`[migrate] mode: ${APPLY ? 'APPLY' : 'DRY RUN (no changes)'}`);
  if (!StorageService.isConfigured()) {
    console.error('[migrate] Cloudinary is not configured. Aborting.');
    process.exit(1);
  }
  await connectDatabase();

  // 1) Profile photos
  for (const profile of await (ProfileModel as any).find({ 'photos.url': /^\/?media\// })) {
    for (const photo of profile.photos) {
      if (!/^\/?media\//.test(photo.url || '')) continue;
      stats.scanned++;
      try {
        const url = await migratePublic(photo.url, `shaadibanao/profiles/${profile.userId}`);
        if (url && APPLY) {
          photo.url = url;
          stats.migrated++;
        }
      } catch {
        stats.failed++;
        console.error(`[migrate] profile ${profile.id}: upload failed`);
      }
    }
    if (APPLY) await profile.save();
  }

  // 2) Community posts
  for (const post of await (CommunityPostModel as any).find({ mediaUrl: /^\/?media\// })) {
    stats.scanned++;
    try {
      const url = await migratePublic(post.mediaUrl, 'shaadibanao/community');
      if (url && APPLY) {
        post.mediaUrl = url;
        await post.save();
        stats.migrated++;
      }
    } catch {
      stats.failed++;
      console.error(`[migrate] post ${post.id}: upload failed`);
    }
  }

  // 3) Identity documents -> PRIVATE authenticated
  for (const reqDoc of await (VerificationRequestModel as any).find({ documentStorageKey: /^secure-vault\// }).select('+documentStorageKey')) {
    stats.scanned++;
    const abs = resolveLocal(reqDoc.documentStorageKey);
    if (!abs) {
      stats.missingFile++;
      continue;
    }
    if (!APPLY) continue;
    try {
      const res = await StorageService.uploadToCloudinary(fs.readFileSync(abs), {
        folder: `shaadibanao/private/identity_document/${reqDoc.userId}`,
        isPrivate: true,
      });
      reqDoc.documentStorageKey = res.publicId; // private public_id only; no URL
      await reqDoc.save();
      stats.migrated++;
    } catch {
      stats.failed++;
      console.error(`[migrate] verification ${reqDoc.id}: upload failed`);
    }
  }

  console.log('[migrate] summary:', stats, APPLY ? '' : '(dry run - nothing changed)');
  await disconnectDatabase();
  await mongoose.disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('[migrate] fatal:', e?.message || 'unknown error');
  process.exit(1);
});
