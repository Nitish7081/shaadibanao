import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Global Navigation Container Reference
 * Enables navigating outside of React components (e.g. from session expiry handlers).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Resets the root navigation stack directly to the Login/OTP screen.
 */
export function navigateToLogin(): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'LoginOtp' }],
      })
    );
  }
}
