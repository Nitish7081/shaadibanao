import { StorageService } from '../src/services/storage.service';

describe('Phase 2 - Cloudinary-only storage rules', () => {
  const userId = '6ad31f7a8ceb74912950d95d';

  it('rejects the legacy "any 64-hex signature" bypass', () => {
    expect(StorageService.verifyUploadSignature('k', 'a'.repeat(64))).toBe(false);
    expect(StorageService.verifyUploadSignature('k', 'a'.repeat(64), '9999999999', userId, 'profile_photo')).toBe(false);
  });

  it('accepts a freshly generated signed intent and never returns a local publicUrl', () => {
    const intent = StorageService.generateUploadIntent({
      userId,
      purpose: 'profile_photo',
      fileName: 'a.jpg',
      fileType: 'image/jpeg',
      fileSizeBytes: 1000,
    });
    expect(intent.publicUrl).toBeUndefined();
    const q = new URL(intent.uploadUrl, 'http://x').searchParams;
    expect(
      StorageService.verifyUploadSignature(q.get('key')!, q.get('sig')!, q.get('exp')!, q.get('uid')!, q.get('purp')!)
    ).toBe(true);
    // tampered user id must fail
    expect(
      StorageService.verifyUploadSignature(q.get('key')!, q.get('sig')!, q.get('exp')!, 'someoneelse', q.get('purp')!)
    ).toBe(false);
  });

  it('only treats shaadibanao/private/* ids as private and extracts the owner', () => {
    const id = `shaadibanao/private/identity_document/${userId}/abc`;
    expect(StorageService.isPrivatePublicId(id)).toBe(true);
    expect(StorageService.getPrivateOwnerId(id)).toBe(userId);
    expect(StorageService.isPrivatePublicId('shaadibanao/profiles/x/y')).toBe(false);
    expect(StorageService.isPrivatePublicId('secure-vault/identity/x.pdf')).toBe(false);
  });
});
