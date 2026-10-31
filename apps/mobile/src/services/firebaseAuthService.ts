import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

export const GOOGLE_WEB_CLIENT_ID = '680373929265-4o135sk0pjkirjvpmbht9c8d6c0d1ef8.apps.googleusercontent.com';

// Confirmation result wrapper interface
export interface PhoneConfirmResult {
  confirm: (code: string) => Promise<any>;
  verificationId?: string;
}

let googleSigninConfigured = false;

/**
 * Detects whether the JavaScript bundle is currently executing inside the
 * standard Expo Go client where custom native modules cannot be loaded.
 */
export function isExpoGo(): boolean {
  try {
    const Constants = require('expo-constants').default;
    return (
      Constants?.appOwnership === 'expo' ||
      Constants?.executionEnvironment === 'storeClient'
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether native Firebase modules are compiled into the active binary.
 * Uses safe non-enforcing checks so TurboModuleRegistry never throws fatal exceptions.
 */
export function isFirebaseNativeAvailable(): boolean {
  if (isExpoGo()) {
    return false;
  }
  try {
    const turbo = TurboModuleRegistry?.get ? TurboModuleRegistry.get('NativeRNFBTurboApp') : null;
    const classic = (NativeModules as any)?.RNFBAppModule || (NativeModules as any)?.RNFBAuthModule;
    return !!(turbo || classic);
  } catch {
    return false;
  }
}

/**
 * Checks whether native Google Sign-In is compiled into the active binary.
 * Uses safe non-enforcing checks so TurboModuleRegistry never throws fatal exceptions.
 */
export function isGoogleSignInNativeAvailable(): boolean {
  if (isExpoGo()) {
    return false;
  }
  try {
    const turbo = TurboModuleRegistry?.get ? TurboModuleRegistry.get('RNGoogleSignin') : null;
    const classic = (NativeModules as any)?.RNGoogleSignin;
    return !!(turbo || classic);
  } catch {
    return false;
  }
}

/**
 * Checks if both native Firebase and Google Sign-In are available in the current runtime.
 */
export function isNativeAuthAvailable(): boolean {
  return isFirebaseNativeAvailable() && isGoogleSignInNativeAvailable();
}

/**
 * Returns a human-friendly diagnostic status for the runtime environment.
 */
export function getRuntimeAuthNotice(): {
  isExpoGo: boolean;
  canUseFirebasePhone: boolean;
  canUseGoogleSignIn: boolean;
  message: string;
} {
  const inExpoGo = isExpoGo();
  const fbOk = isFirebaseNativeAvailable();
  const googleOk = isGoogleSignInNativeAvailable();

  if (inExpoGo) {
    return {
      isExpoGo: true,
      canUseFirebasePhone: false,
      canUseGoogleSignIn: false,
      message:
        'Expo Go client detected. Native Firebase SMS OTP and Google Sign-In require an Expo Development Build (APK). Running in server test mode.',
    };
  }

  if (!fbOk || !googleOk) {
    return {
      isExpoGo: false,
      canUseFirebasePhone: fbOk,
      canUseGoogleSignIn: googleOk && fbOk,
      message:
        'Native authentication modules partially unavailable in current build. Install development APK for full Firebase support.',
    };
  }

  return {
    isExpoGo: false,
    canUseFirebasePhone: true,
    canUseGoogleSignIn: true,
    message: 'Native Firebase & Google Sign-In modules active.',
  };
}

/**
 * Initializes Google Sign-In configuration with the Web Client ID
 */
export function configureGoogleSignIn(): void {
  if (googleSigninConfigured) return;
  if (!isGoogleSignInNativeAvailable()) return;

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
      scopes: ['profile', 'email'],
    });
    googleSigninConfigured = true;
  } catch (error: any) {
    console.warn('[GoogleSignIn] Configuration deferred:', error.message);
  }
}

/**
 * Triggers native Google Sign-In and returns Firebase ID token
 */
export async function signInWithGoogle(): Promise<{ idToken: string }> {
  if (!isGoogleSignInNativeAvailable() || !isFirebaseNativeAvailable()) {
    throw new Error(
      'Native Google Sign-In is only available in an Expo Development Build (APK). It is not supported in Expo Go.'
    );
  }

  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  const authModule = require('@react-native-firebase/auth');

  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();

  // @react-native-google-signin v13+ resolves with { type: 'cancelled' } instead of throwing
  if (signInResult?.type === 'cancelled') {
    const cancelled: any = new Error('Google Sign-In was cancelled.');
    cancelled.code = 'SIGN_IN_CANCELLED';
    throw cancelled;
  }

  // In newer @react-native-google-signin versions, idToken is nested under data
  const idToken = signInResult.data?.idToken || signInResult.idToken;
  if (!idToken) {
    throw new Error(
      'No Google ID token was returned. Verify the Web client ID matches the Firebase project (saadibaano) and the Google provider is enabled.'
    );
  }

  // Resolve GoogleAuthProvider (modular v22+/v26+ export vs legacy namespaced)
  const GoogleAuthProvider =
    authModule.GoogleAuthProvider ||
    authModule.default?.GoogleAuthProvider;

  if (!GoogleAuthProvider) {
    throw new Error('Firebase GoogleAuthProvider could not be loaded from @react-native-firebase/auth.');
  }

  // Create Firebase credential using the Google ID token
  const googleCredential = GoogleAuthProvider.credential(idToken);

  let userCredential: any;
  if (typeof authModule.getAuth === 'function' && typeof authModule.signInWithCredential === 'function') {
    // Modular API (RN Firebase v22+ / v26+)
    const authInstance = authModule.getAuth();
    userCredential = await authModule.signInWithCredential(authInstance, googleCredential);
  } else {
    // Legacy namespaced API
    const authFn = typeof authModule === 'function' ? authModule : authModule.default;
    userCredential = await authFn().signInWithCredential(googleCredential);
  }

  if (!userCredential?.user) {
    throw new Error('Firebase Google Sign-In failed: User credential was not returned.');
  }

  const firebaseIdToken = await userCredential.user.getIdToken(false);
  if (!firebaseIdToken) {
    throw new Error('Failed to retrieve Firebase ID token from authenticated Google user.');
  }

  return { idToken: firebaseIdToken };
}

/**
 * Requests Firebase SMS Phone OTP
 */
export async function sendFirebasePhoneOtp(
  rawMobile: string
): Promise<PhoneConfirmResult> {
  if (!isFirebaseNativeAvailable()) {
    throw new Error(
      'Native Firebase Phone Authentication is only available in an Expo Development Build (APK). It is not supported in Expo Go.'
    );
  }

  const authModule = require('@react-native-firebase/auth');

  const clean = rawMobile.replace(/\D/g, '');
  const formattedPhone = clean.startsWith('+') ? clean : `+91${clean.slice(-10)}`;

  let confirmation: any;
  if (typeof authModule.getAuth === 'function' && typeof authModule.signInWithPhoneNumber === 'function') {
    // Modular API (RN Firebase v22+ / v26+)
    const authInstance = authModule.getAuth();
    confirmation = await authModule.signInWithPhoneNumber(authInstance, formattedPhone);
  } else {
    // Legacy namespaced API
    const authFn = typeof authModule === 'function' ? authModule : authModule.default;
    confirmation = await authFn().signInWithPhoneNumber(formattedPhone);
  }

  if (!confirmation || typeof confirmation.confirm !== 'function') {
    throw new Error('Firebase SMS verification could not be initialized.');
  }

  return confirmation;
}

/**
 * Confirms OTP code with Firebase and returns verified Firebase ID token
 */
export async function confirmFirebasePhoneOtp(
  confirmation: PhoneConfirmResult,
  otpCode: string
): Promise<{ idToken: string }> {
  const userCredential = await confirmation.confirm(otpCode);
  if (!userCredential?.user) {
    throw new Error('Firebase phone confirmation failed: User was not returned.');
  }

  const idToken = await userCredential.user.getIdToken(true);
  if (!idToken) {
    throw new Error('Failed to retrieve Firebase ID token after phone confirmation.');
  }

  return { idToken };
}

/**
 * Converts raw Firebase / Google Sign-In native errors into actionable, non-sensitive messages.
 */
export function describeFirebaseAuthError(err: any): string {
  const code: string = err?.code || '';
  const msg: string = err?.message || '';

  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'SMS to this region is blocked by the Firebase SMS region policy (or Phone sign-in is disabled). The administrator must allow India (+91) in Firebase Console > Authentication > Settings > SMS region policy.';
  }
  if (code === 'auth/invalid-phone-number') {
    return 'This phone number is not valid. Enter a 10-digit Indian mobile number.';
  }
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
    return 'Too many verification attempts or SMS quota exceeded. Please wait and try again later.';
  }
  if (code === 'auth/app-not-authorized' || msg.includes('Play Integrity') || msg.includes('app-not-authorized')) {
    return 'This app build is not authorised for Firebase. The signing SHA-1/SHA-256 certificate must be registered in Firebase project settings.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Firebase. Check your internet connection.';
  }
  if (code === 'auth/invalid-verification-code') {
    return 'The verification code is incorrect.';
  }
  if (code === 'auth/code-expired' || code === 'auth/session-expired') {
    return 'The verification code has expired. Request a new code.';
  }
  return msg || 'Firebase authentication failed.';
}

/**
 * Signs out of BOTH Firebase and the native Google account so the next login starts clean
 * (fresh Google account chooser, fresh Firebase ID token). Never throws.
 */
export async function signOutNativeAuth(): Promise<void> {
  if (isGoogleSignInNativeAvailable()) {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (e: any) {
      console.warn('[Logout] Google signOut skipped:', e?.code || e?.message);
    }
  }
  if (isFirebaseNativeAvailable()) {
    try {
      const authModule = require('@react-native-firebase/auth');
      if (typeof authModule.getAuth === 'function' && typeof authModule.signOut === 'function') {
        await authModule.signOut(authModule.getAuth());
      } else {
        const authFn = typeof authModule === 'function' ? authModule : authModule.default;
        await authFn().signOut();
      }
    } catch (e: any) {
      console.warn('[Logout] Firebase signOut skipped:', e?.code || e?.message);
    }
  }
}

/**
 * Turns a login failure (backend ApiError or native error) into a clear, actionable message.
 * Backend error codes come from POST /auth/firebase-login.
 */
export function describeLoginError(err: any): string {
  const code: string = err?.code || '';
  const status: number = err?.status ?? -1;

  switch (code) {
    case 'ACCOUNT_CONFLICT':
      return 'This phone number or email is already linked to a different account. Please contact support.';
    case 'UNVERIFIED_EMAIL':
      return 'Your Google email is not verified. Verify it with Google and try again.';
    case 'TOKEN_EXPIRED':
      return 'Your sign-in expired before it finished. Please try again.';
    case 'INVALID_FIREBASE_TOKEN':
      return 'We could not verify your sign-in. Please sign in again.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many sign-in attempts. Please wait a few minutes and try again.';
    case 'DATABASE_TEMPORARY_UNAVAILABLE':
      return 'Our server is reconnecting. Please try again in a moment.';
    case 'TIMEOUT_ERROR':
    case 'CONNECTION_FAILED':
      return err?.message || 'Cannot reach the server. Check your internet connection and try again.';
    default:
      break;
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please try again shortly.';
  }
  return describeFirebaseAuthError(err);
}


// Pre-initialize Google Sign-In for instant tap response
try {
  configureGoogleSignIn();
} catch {}
