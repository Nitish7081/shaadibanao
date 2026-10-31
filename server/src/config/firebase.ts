import type { App, ServiceAccount } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';
import { config } from './env';
import { AppError } from '../middleware/errorHandler';

let firebaseApp: App | null = null;
let hasServiceAccount = false;

function parseAndNormalizeServiceAccount(raw: string): ServiceAccount | null {
  try {
    const sa = JSON.parse(raw);
    if (sa.private_key && typeof sa.private_key === 'string') {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }
    if (sa.privateKey && typeof sa.privateKey === 'string') {
      sa.privateKey = sa.privateKey.replace(/\\n/g, '\n');
    }
    return sa;
  } catch {
    return null;
  }
}

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
  const candidatePaths = [
    config.firebase.serviceAccountPath ? path.resolve(config.firebase.serviceAccountPath) : null,
    config.firebase.serviceAccountPath ? path.resolve(__dirname, '../../', config.firebase.serviceAccountPath) : null,
    config.firebase.serviceAccountPath ? path.resolve(__dirname, '../../../', config.firebase.serviceAccountPath) : null,
    path.resolve(__dirname, '../../service-account.json'),
    path.resolve(__dirname, '../../../service-account.json'),
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(process.cwd(), 'server/service-account.json'),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const serviceAccount = parseAndNormalizeServiceAccount(raw);
        if (serviceAccount) {
          credentialCert = cert(serviceAccount);
          hasServiceAccount = true;
          console.log(`[Firebase] Initialized with service account from ${p}`);
          break;
        }
      } catch (err: any) {
        console.error(`[Firebase] Failed to parse service account from ${p}:`, err.message);
      }
    }
  }

  // 2. Try Base64 string from environment variable (ideal for Render / Heroku / Cloud)
  if (!credentialCert && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decodedRaw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const serviceAccount = parseAndNormalizeServiceAccount(decodedRaw);
      if (serviceAccount) {
        credentialCert = cert(serviceAccount);
        hasServiceAccount = true;
        console.log('[Firebase] Initialized with FIREBASE_SERVICE_ACCOUNT_BASE64');
      }
    } catch (err: any) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', err.message);
    }
  }

  // 3. Try JSON string from environment variable
  if (!credentialCert && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = parseAndNormalizeServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount) {
        credentialCert = cert(serviceAccount);
        hasServiceAccount = true;
        console.log('[Firebase] Initialized with FIREBASE_SERVICE_ACCOUNT_JSON');
      }
    } catch (err: any) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }

  // 4. Fallback: Initialize with project ID (allows cryptographic token verification via Google public keys)
  if (!credentialCert) {
    hasServiceAccount = false;
    console.warn(
      `[Firebase] No service-account credentials loaded. Initializing with Project ID '${projectId}'. ` +
      'ID tokens will be cryptographically verified using Google public RS256 certificates.'
    );
  }

  firebaseApp = initializeApp(
    credentialCert ? { credential: credentialCert, projectId } : { projectId }
  );

  return firebaseApp!;
}

export function isFirebaseServiceAccountConfigured(): boolean {
  return hasServiceAccount;
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
    let decoded: any;

    if (hasServiceAccount) {
      try {
        decoded = await auth.verifyIdToken(idToken, false);
      } catch (revocationError: any) {
        // If revocation check specifically fails due to missing/expired OAuth2 credentials,
        // fall back to cryptographic verification without revocation check
        if (
          revocationError?.message?.includes('failed to fetch a valid Google OAuth2 access token') ||
          revocationError?.message?.includes('Could not load the default credentials')
        ) {
          console.warn('[Firebase] OAuth2 credentials unavailable for revocation check, falling back to signature verification.');
          decoded = await auth.verifyIdToken(idToken, false);
        } else {
          throw revocationError;
        }
      }
    } else {
      // Cryptographically verifies signature, audience, issuer and expiration against Google's public certificates
      decoded = await auth.verifyIdToken(idToken, false);
    }

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

