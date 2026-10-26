import * as ImagePicker from 'expo-image-picker';
import { getApiBaseUrl } from './apiClient';

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
 * Request cryptographically signed upload intent from backend
 */
export async function requestUploadIntent(
  token: string,
  input: UploadIntentInput
): Promise<UploadIntentResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/storage/upload-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || json.message || 'Failed to generate upload intent.');
  }

  return json.data;
}

/**
 * Pick image from gallery with validation and compression
 */
export async function pickImageFromGallery(options?: {
  aspect?: [number, number];
}): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo gallery permission is required to select photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
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
  // Size validation: max 5MB
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    throw new Error('Image size exceeds 5MB limit. Please choose a smaller photo.');
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
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    throw new Error('Captured image exceeds 5MB limit.');
  }

  return asset;
}
