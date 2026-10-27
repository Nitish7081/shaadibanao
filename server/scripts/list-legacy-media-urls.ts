/**
 * READ-ONLY report: stored media references that still point at the old server
 * (shaadibanao.onrender.com or a local "/media/..." path) instead of Cloudinary.
 *
 *   npx ts-node scripts/list-legacy-media-urls.ts
 *
 * Writes nothing. Prints only: collection, field, masked record id (last 6 chars), and the host / kind.
 * Never prints full URLs, keys, tokens or secrets.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';

const mask = (id: any) => `…${String(id).slice(-6)}`;
const LEGACY = /onrender\.com|^\/?media\//i;

function kind(url: unknown): string {
  const s = String(url || '');
  if (/^\/?media\//i.test(s)) return 'local /media path';
  if (/onrender\.com/i.test(s)) return 'onrender.com';
  return 'other';
}

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const found: Array<{ where: string; id: string; kind: string }> = [];

  for await (const p of db.collection('profiles').find({}, { projection: { photos: 1 } })) {
    for (const ph of (p as any).photos || []) {
      if (LEGACY.test(String(ph.url || ''))) found.push({ where: 'profiles.photos[].url', id: mask(p._id), kind: kind(ph.url) });
    }
  }
  const simple: Array<[string, string]> = [
    ['users', 'avatarUrl'],
    ['communityposts', 'mediaUrl'],
    ['banners', 'imageUrl'],
    ['kundlis', 'chartUrl'],
  ];
  for (const [col, field] of simple) {
    try {
      for await (const d of db.collection(col).find({ [field]: { $regex: 'onrender\\.com|^/?media/', $options: 'i' } }, { projection: { [field]: 1 } })) {
        found.push({ where: `${col}.${field}`, id: mask(d._id), kind: kind((d as any)[field]) });
      }
    } catch {
      /* collection missing */
    }
  }
  // Identity documents: only report the KIND of each stored key (never the key itself).
  let docsPrivate = 0;
  let docsOther = 0;
  for await (const v of db.collection('verificationrequests').find({}, { projection: { documentStorageKey: 1 } })) {
    if (String((v as any).documentStorageKey || '').startsWith('shaadibanao/private/')) docsPrivate++;
    else docsOther++;
  }

  console.log(`[legacy-media] legacy references found: ${found.length}`);
  found.forEach((f) => console.log(`  ${f.where}  record=${f.id}  kind=${f.kind}`));
  console.log(`[legacy-media] identity documents in private vault: ${docsPrivate}, not in private vault (legacy/missing): ${docsOther}`);
  console.log('[legacy-media] READ ONLY - nothing was changed.');
  await disconnectDatabase();
}

main().catch(async (e) => {
  console.error('[legacy-media] fatal:', String(e?.message || e).slice(0, 200));
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
