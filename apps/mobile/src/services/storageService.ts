import * as ImagePicker from 'expo-image-picker';
import { apiClient, getApiBaseUrl } from './apiClient';

export interface UploadIntentInput {
  purpose: 'profile_photo' | 'identity_document' | 'community_post' | 'kundli_chart';
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

export interface UploadIntentResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl?: string;
  isPrivate: boolean;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface UploadResponse {
  success: boolean;
  fileKey: string;
  url: string;
  publicId?: string;
  secureUrl?: string;
}

/**
 * Request cryptographically signed upload intent from backend (uses apiClient for auto token refresh & Render retry)
 */
export async function requestUploadIntent(
  token: string,
  input: UploadIntentInput
): Promise<UploadIntentResult> {
  const json = await apiClient<{ success: boolean; data: UploadIntentResult; message?: string }>(
    '/storage/upload-intent',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!json.success || !json.data) {
    throw new Error(json.message || 'Failed to generate upload intent.');
  }

  return json.data;
}

/**
 * Pick image from gallery with validation and compression
 */
export async function pickImageFromGallery(options?: {
  aspect?: [number, number];
}): Promise<ImagePicker.ImagePickerAsset | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // On older platforms if permanently denied, warn only if the system picker isn't available
    if (!permission.granted && !permission.canAskAgain) {
      // Still attempt system picker, as Android 13+ PhotoPicker does not require READ_EXTERNAL_STORAGE
    }
  } catch {
    // Ignore permission request errors on platforms with built-in system pickers
  }

  let result;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: options?.aspect || [1, 1],
      quality: 0.8,
      base64: true,
    });
  } catch (err: any) {
    if (err?.message?.toLowerCase().includes('permission')) {
      throw new Error('Photo gallery permission is required to select photos.');
    }
    throw err;
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  // Raw camera photos can be 6-15MB before resize/compression in imageUpload.ts; only block extreme >25MB files here
  if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) {
    throw new Error('Image size exceeds 25MB limit. Please choose a smaller photo.');
  }

  return asset;
}

/**
 * Capture image using camera with permissions and validation
 */
export async function captureImageWithCamera(options?: {
  aspect?: [number, number];
}): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required to capture photos.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options?.aspect || [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) {
    throw new Error('Captured image exceeds 25MB limit.');
  }

  return asset;
}
