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

  // In newer @react-native-google-signin versions, idToken may be nested under data or top-level
  const idToken = signInResult.data?.idToken || signInResult.idToken;
  if (!idToken) {
    throw new Error('No Google ID token was returned by Google Play Services.');
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

  const firebaseIdToken = await userCredential.user.getIdToken(true);
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
