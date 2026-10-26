/**
 * ONE shared upload helper for every image/document upload in the app.
 *  - validates type (jpg/png/webp, + pdf for private docs) and size
 *  - resizes (max 1600px) and compresses (~0.75) when expo-image-manipulator is available
 *  - reports progress, throws friendly typed errors, retries once on network failure
 *  - public uploads return a Cloudinary secure_url; private uploads return ONLY a fileKey
 */
import { getApiBaseUrl } from './apiClient';
import { requestUploadIntent, UploadIntentInput } from './storageService';

export type UploadPurpose = UploadIntentInput['purpose'];

export type UploadErrorCode =
  | 'INVALID_TYPE'
  | 'TOO_LARGE'
  | 'NETWORK'
  | 'STORAGE_NOT_CONFIGURED'
  | 'SERVER'
  | 'PROCESSING';

export class UploadError extends Error {
  code: UploadErrorCode;
  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
  }
}

export interface UploadableAsset {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  base64?: string | null;
}

export interface UploadResult {
  /** Cloudinary secure_url (public uploads only). Undefined for private uploads. */
  url?: string;
  /** Private reference to store/send to the API (private uploads) or public_id (public uploads). */
  fileKey: string;
  publicId?: string;
  isPrivate: boolean;
}

export const MAX_DIMENSION = 1600;
export const COMPRESS_QUALITY = 0.75;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function resolveMime(asset: UploadableAsset): string {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const name = (asset.fileName || asset.uri || '').split('?')[0];
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || 'image/jpeg'; // picker output without metadata is a JPEG
}

export function validateAsset(asset: UploadableAsset, allowPdf = false): string {
  const mime = resolveMime(asset);
  const ok = IMAGE_TYPES.includes(mime) || (allowPdf && mime === 'application/pdf');
  if (!ok) {
    throw new UploadError(
      'INVALID_TYPE',
      allowPdf
        ? 'Only JPG, PNG, WEBP or PDF files are allowed.'
        : 'Only JPG, PNG or WEBP photos are allowed.'
    );
  }
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new UploadError('TOO_LARGE', 'File is larger than 5MB. Please choose a smaller one.');
  }
  return mime;
}

/** Resize + compress. Falls back to the picker's own (already compressed) base64. */
async function prepareBase64(asset: UploadableAsset, mime: string): Promise<{ base64: string; mime: string }> {
  if (mime === 'application/pdf') {
    if (!asset.base64) throw new UploadError('PROCESSING', 'Could not read the selected file.');
    return { base64: asset.base64, mime };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Manipulator = require('expo-image-manipulator');
    const needsResize = (asset.width || 0) > MAX_DIMENSION || (asset.height || 0) > MAX_DIMENSION;
    const landscape = (asset.width || 0) >= (asset.height || 0);
    const actions = needsResize
      ? [{ resize: landscape ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION } }]
      : [];
    const out = await Manipulator.manipulateAsync(asset.uri, actions, {
      compress: COMPRESS_QUALITY,
      format: Manipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (out?.base64) return { base64: out.base64, mime: 'image/jpeg' };
  } catch {
    // module not in this native build yet - fall through to picker base64
  }
  if (!asset.base64) throw new UploadError('PROCESSING', 'Could not process the selected image.');
  return { base64: asset.base64, mime };
}

function xhrUpload(
  url: string,
  signature: string,
  body: string,
  onProgress?: (pct: number) => void
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Upload-Signature', signature);
    xhr.timeout = 60000;
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      let json: any = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new UploadError('NETWORK', 'Network error. Please check your internet.'));
    xhr.ontimeout = () => reject(new UploadError('NETWORK', 'Upload timed out. Please try again.'));
    xhr.send(body);
  });
}

/** Single entry point: validate -> compress -> intent -> upload (retry once on network failure). */
export async function uploadAsset(params: {
  token: string;
  asset: UploadableAsset;
  purpose: UploadPurpose;
  onProgress?: (pct: number) => void;
}): Promise<UploadResult> {
  const { token, asset, purpose, onProgress } = params;
  const allowPdf = purpose === 'identity_document' || purpose === 'kundli_chart';
  const mime = validateAsset(asset, allowPdf);
  const prepared = await prepareBase64(asset, mime);

  const ext = prepared.mime === 'application/pdf' ? 'pdf' : prepared.mime === 'image/png' ? 'png' : prepared.mime === 'image/webp' ? 'webp' : 'jpg';
  const sizeBytes = Math.ceil((prepared.base64.length * 3) / 4);

  let intent;
  try {
    intent = await requestUploadIntent(token, {
      purpose,
      fileName: `${purpose}.${ext}`,
      fileType: prepared.mime,
      fileSizeBytes: sizeBytes,
    });
  } catch (e: any) {
    if (e instanceof UploadError) throw e;
    const msg = String(e?.message || '');
    if (/network request failed|failed to fetch/i.test(msg)) {
      throw new UploadError('NETWORK', 'Network error. Please check your internet.');
    }
    if (/STORAGE_NOT_CONFIGURED|not configured/i.test(msg)) {
      throw new UploadError('STORAGE_NOT_CONFIGURED', 'Image storage is not available right now. Please try later.');
    }
    throw new UploadError('SERVER', msg || 'Could not start upload.');
  }

  let uploadUrl = intent.uploadUrl;
  if (!uploadUrl.startsWith('http')) {
    const origin = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
    uploadUrl = `${origin}${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`;
  }
  const signature = intent.headers['X-Upload-Signature'] || '';
  const body = JSON.stringify({ base64: prepared.base64 });

  let res: { status: number; json: any };
  try {
    res = await xhrUpload(uploadUrl, signature, body, onProgress);
  } catch (e) {
    if (e instanceof UploadError && e.code === 'NETWORK') {
      onProgress?.(0);
      res = await xhrUpload(uploadUrl, signature, body, onProgress); // retry once
    } else {
      throw e;
    }
  }

  if (res.status === 503) {
    throw new UploadError('STORAGE_NOT_CONFIGURED', 'Image storage is not available right now. Please try later.');
  }
  if (res.status < 200 || res.status >= 300 || !res.json?.success) {
    throw new UploadError('SERVER', res.json?.error?.message || res.json?.message || 'Upload failed. Please try again.');
  }

  const data = res.json.data || {};
  const isPrivate = !!(data.isPrivate ?? intent.isPrivate);
  return {
    url: isPrivate ? undefined : data.secureUrl || data.url,
    fileKey: data.fileKey || data.publicId || intent.fileKey,
    publicId: isPrivate ? undefined : data.publicId,
    isPrivate,
  };
}
