import type { App, ServiceAccount } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';
import { config } from './env';
import { AppError } from '../middleware/errorHandler';

let firebaseApp: App | null = null;

export function initializeFirebaseAdmin(): App {
  // Lazy require to prevent ESM/CommonJS conflicts during Jest test execution
  const { initializeApp, cert, getApps } = require('firebase-admin/app');

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp!;
  }

  const projectId = config.firebase.projectId || 'saadibaano';
  let credentialCert: any = null;

  // 1. Try file path
  if (config.firebase.serviceAccountPath) {
    const candidatePaths = [
      path.resolve(config.firebase.serviceAccountPath),
      path.resolve(__dirname, '../../', config.firebase.serviceAccountPath),
      path.resolve(__dirname, '../../../', config.firebase.serviceAccountPath),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const serviceAccount: ServiceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
          credentialCert = cert(serviceAccount);
          console.log(`[Firebase] Initialized with service account from ${p}`);
          break;
        } catch (err: any) {
          console.error(`[Firebase] Failed to parse service account from ${p}:`, err.message);
        }
      }
    }
  }

  // 2. Try JSON string from environment variable
  if (!credentialCert && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount: ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credentialCert = cert(serviceAccount);
      console.log('[Firebase] Initialized with FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch (err: any) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }

  // 3. Fallback: Initialize with project ID
  if (!credentialCert) {
    console.warn(
      `[Firebase] No service-account.json found. Initializing with Project ID '${projectId}'. ` +
      'To verify live tokens, place your service account file at server/service-account.json.'
    );
  }

  firebaseApp = initializeApp(
    credentialCert ? { credential: credentialCert, projectId } : { projectId }
  );

  return firebaseApp!;
}

export interface DecodedFirebaseToken {
  uid: string;
  phone_number?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  signInProvider?: string;
}

// Custom verifier hook for unit/integration testing
let tokenVerifierOverride: ((idToken: string) => Promise<DecodedFirebaseToken>) | null = null;

export function setFirebaseTokenVerifierForTesting(
  verifier: ((idToken: string) => Promise<DecodedFirebaseToken>) | null
): void {
  tokenVerifierOverride = verifier;
}

/**
 * Cryptographically verifies Firebase ID token using Firebase Admin SDK
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedFirebaseToken> {
  if (tokenVerifierOverride) {
    return tokenVerifierOverride(idToken);
  }

  const app = initializeFirebaseAdmin();
  const { getAuth } = require('firebase-admin/auth');
  const auth = getAuth(app);

  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      phone_number: decoded.phone_number,
      email: decoded.email,
      email_verified: decoded.email_verified,
      name: decoded.name,
      picture: decoded.picture,
      signInProvider: decoded.firebase?.sign_in_provider,
    };
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      throw new AppError('Firebase authentication token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }
    if (error.code === 'auth/id-token-revoked') {
      throw new AppError('Firebase token has been revoked. Please log in again.', 401, 'TOKEN_REVOKED');
    }
    throw new AppError(
      `Invalid Firebase authentication token: ${error.message || 'Verification failed'}`,
      401,
      'INVALID_FIREBASE_TOKEN'
    );
  }
}
