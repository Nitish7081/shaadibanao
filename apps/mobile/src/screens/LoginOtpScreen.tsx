import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, fonts } from '../constants/theme';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { StatusNotice } from '../components/common/StatusNotice';
import { requestOtp, verifyOtp, registerUser, loginWithFirebase } from '../services/authService';
import { setSessionAuth } from '../services/authSession';
import {
  isFirebaseNativeAvailable,
  isGoogleSignInNativeAvailable,
  getRuntimeAuthNotice,
  signInWithGoogle,
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
  describeFirebaseAuthError,
  PhoneConfirmResult,
} from '../services/firebaseAuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'LoginOtp'>;

export const LoginOtpScreen: React.FC<Props> = ({ navigation }) => {
  const authNotice = getRuntimeAuthNotice();
  const [profileFor, setProfileFor] = useState<ProfileCreatedFor>('myself');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [phoneConfirmation, setPhoneConfirmation] = useState<PhoneConfirmResult | null>(null);

  const cleanMobile = mobileNumber.replace(/\D/g, '');

  const handleSendOtp = async () => {
    if (cleanMobile.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }
    if (!consentAgreed) {
      Alert.alert(
        'Consent Required',
        'Please review and agree to our Terms & Privacy Policy to proceed.'
      );
      return;
    }

    setLoading(true);

    // 1. Try Native Firebase Phone OTP (Available in native development build)
    if (isFirebaseNativeAvailable()) {
      try {
        const confirmation = await sendFirebasePhoneOtp(cleanMobile);
        setPhoneConfirmation(confirmation);
        setLoading(false);
        setOtpSent(true);
        setResendTimer(60);
        Alert.alert(
          'Firebase OTP Dispatched',
          `A 6-digit SMS verification code was sent to +91 ${cleanMobile} via Firebase.`
        );
        return;
      } catch (fbErr: any) {
        // Firebase is the production OTP provider: do NOT fall back to the server OTP route.
        setLoading(false);
        console.warn('[FirebasePhoneAuth] SMS request failed:', fbErr?.code || fbErr?.message);
        Alert.alert('Phone Verification Failed', describeFirebaseAuthError(fbErr));
        return;
      }
    }

    // 2. Fallback to centralized server route (Development mode / mock)
    try {
      const response = await requestOtp(cleanMobile);
      setLoading(false);
      setOtpSent(true);
      setResendTimer(30);

      const notice = response.data?.devTestOtpHint
        ? `${response.message}\n\n${response.data.devTestOtpHint}`
        : response.message || 'OTP sent successfully.';

      Alert.alert('OTP Dispatched', notice);
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Request Failed', err.message || 'Unable to request OTP. Check backend server connection.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);

    // 1. If Firebase Phone confirmation object exists (native SMS flow)
    if (phoneConfirmation) {
      try {
        const { idToken } = await confirmFirebasePhoneOtp(phoneConfirmation, otp);
        const res = await loginWithFirebase(idToken, profileFor);

        if (res.data?.tokens && res.data?.user) {
          setSessionAuth(res.data.tokens, res.data.user.id, res.data.user);
          setLoading(false);

          if (res.data.isNewUser) {
            Alert.alert(
              'Account Verified',
              'Your number has been verified via Firebase! Let\'s build your profile.',
              [
                {
                  text: 'Create Profile',
                  onPress: () => navigation.navigate('ProfileCreation'),
                },
              ]
            );
          } else {
            Alert.alert('Welcome Back', 'Authentication successful!', [
              {
                text: 'Go to App',
                onPress: () => navigation.navigate('MainTabs'),
              },
            ]);
          }
          return;
        }
      } catch (fbVerifyErr: any) {
        setLoading(false);
        Alert.alert(
          'Verification Failed',
          describeFirebaseAuthError(fbVerifyErr)
        );
        return;
      }
    }

    // 2. Fallback to centralized server OTP verification
    try {
      const verifyRes = await verifyOtp(cleanMobile, otp);

      if (verifyRes.data?.auth) {
        // Returning user - already has an account
        setSessionAuth(
          verifyRes.data.auth.tokens,
          verifyRes.data.auth.user.id,
          verifyRes.data.auth.user
        );
        const authUser = verifyRes.data.auth.user;
        setLoading(false);
        if (authUser.approvalStatus && authUser.approvalStatus !== 'approved') {
          navigation.replace('ApprovalPending');
        } else {
          Alert.alert('Welcome Back', 'Authentication successful!', [
            {
              text: 'Go to App',
              onPress: () => navigation.navigate('MainTabs'),
            },
          ]);
        }
        return;
      }

      if (verifyRes.data?.verificationToken) {
        // New user - complete account registration
        const regRes = await registerUser({
          mobile: cleanMobile,
          verificationToken: verifyRes.data.verificationToken,
          profileFor,
          consentToTerms: true,
        });

        if (regRes.data) {
          setSessionAuth(regRes.data.tokens, regRes.data.user.id, regRes.data.user);
        }

        setLoading(false);
        Alert.alert('Account Created', 'Your account has been registered. Let\'s build your profile!', [
          {
            text: 'Create Profile',
            onPress: () => navigation.navigate('ProfileCreation'),
          },
        ]);
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Verification Failed', err.message || 'Invalid or expired OTP. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!consentAgreed) {
      Alert.alert(
        'Consent Required',
        'Please review and agree to our Terms & Privacy Policy to proceed with Google Sign-In.'
      );
      return;
    }

    if (!isGoogleSignInNativeAvailable() || !isFirebaseNativeAvailable()) {
      Alert.alert(
        'Development Build Required',
        'Google Sign-In uses Google Play Services, which is available in an Expo Development Build (npx expo run:android or EAS build). Expo Go does not support native Google Sign-In.\n\nPlease test in a development build or use Phone OTP.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await loginWithFirebase(idToken, profileFor);

      if (res.data?.tokens && res.data?.user) {
        setSessionAuth(res.data.tokens, res.data.user.id, res.data.user);
        setGoogleLoading(false);

        if (res.data.isNewUser) {
          Alert.alert('Welcome to ShaadiBanao', 'Account created with Google! Let\'s build your profile.', [
            {
              text: 'Create Profile',
              onPress: () => navigation.navigate('ProfileCreation'),
            },
          ]);
        } else {
          if (res.data.user.approvalStatus && res.data.user.approvalStatus !== 'approved') {
            navigation.replace('ApprovalPending');
          } else {
            Alert.alert('Welcome Back', 'Signed in successfully with Google!', [
              {
                text: 'Go to App',
                onPress: () => navigation.navigate('MainTabs'),
              },
            ]);
          }
        }
      }
    } catch (err: any) {
      setGoogleLoading(false);
      if (err.code === 'SIGN_IN_CANCELLED' || err.message?.includes('CANCELLED')) {
        return;
      }
      const isDeveloperError =
        err.message?.includes('DEVELOPER_ERROR') ||
        err.code === 10 ||
        err.code === '10' ||
        err.code === 'DEVELOPER_ERROR';

      if (isDeveloperError) {
        Alert.alert(
          'Google Sign-In Configuration Required',
          'DEVELOPER_ERROR (Status 10): The APK signing certificate SHA-1 fingerprint is not registered in Firebase / Google Cloud Console for com.shaadibanao.app.\n\nPlease add the EAS build / debug keystore SHA-1 to Firebase Console to activate Google Sign-In on real devices.'
        );
        return;
      }
      Alert.alert(
        'Google Sign-In Failed',
        `${describeFirebaseAuthError(err)}${err?.code ? `\n\n(code: ${err.code})` : ''}`
      );
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="ShaadiBanao Access"
        subtitle="Rishton ki nayi shuruaat"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        variant="royal"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <StatusNotice
            milestoneText="Firebase Phone & Google Auth Enabled"
            subtext="Integrated with Firebase project saadibaano. Verification verified cryptographically on server."
          />

          {authNotice.isExpoGo && (
            <View style={styles.clientNoticeBox}>
              <Text style={styles.clientNoticeTitle}>Running in Expo Go</Text>
              <Text style={styles.clientNoticeText}>
                Native Google Sign-In & Firebase SMS OTP require an Expo Development Build (APK). Running in server test mode.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {otpSent ? 'Enter Verification Code' : 'Create Account / Sign In'}
            </Text>

            {!otpSent ? (
              <>
                <Text style={styles.fieldLabel}>This profile is for</Text>
                <View style={styles.chipsContainer}>
                  {PROFILE_CREATED_FOR.map((item) => {
                    const isSelected = profileFor === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setProfileFor(item)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        activeOpacity={0.75}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={colors.royalMaroon}
                            style={{ marginRight: 5 }}
                          />
                        )}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  style={styles.googleBtn}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={colors.royalMaroon} />
                  ) : (
                    <>
                      <View style={styles.googleIconCircle}>
                        <Text style={styles.googleIconText}>G</Text>
                      </View>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with phone</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Input
                  label="Mobile number"
                  prefix="+91"
                  placeholder="98XXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  helperText="Enter 10-digit mobile number (e.g. 9876543210)"
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setConsentAgreed(!consentAgreed)}
                  style={styles.checkboxContainer}
                >
                  <View style={[styles.checkbox, consentAgreed && styles.checkboxChecked]}>
                    {consentAgreed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.consentText}>
                    I agree to <Text style={styles.linkText}>Terms</Text> and{' '}
                    <Text style={styles.linkText}>Privacy Policy</Text> and consent to my data being
                    used for partner matching.
                  </Text>
                </TouchableOpacity>

                <View style={styles.safetyBox}>
                  <Text style={styles.safetyTitle}>Safety Note</Text>
                  <Text style={styles.safetyText}>
                    OTP verification only confirms your telephone number. It does not constitute proof
                    of government identity. You can submit your ID for an authentic verification
                    badge inside the app.
                  </Text>
                </View>

                <Button
                  title="Send Verification OTP"
                  onPress={handleSendOtp}
                  loading={loading}
                  variant="primary"
                  style={styles.submitBtn}
                />
              </>
            ) : (
              <>
                <Text style={styles.subtext}>
                  We sent a 6-digit verification code to +91 {cleanMobile}
                </Text>

                <Input
                  label="Enter 6-digit OTP"
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  helperText={
                    phoneConfirmation
                      ? `Firebase SMS sent • Resend code in 00:${resendTimer < 10 ? `0${resendTimer}` : resendTimer}`
                      : `In dev mode, enter 123456 • Resend code in 00:${resendTimer < 10 ? `0${resendTimer}` : resendTimer}`
                  }
                />

                <Button
                  title="Verify & Continue"
                  onPress={handleVerifyOtp}
                  loading={loading}
                  variant="primary"
                  style={styles.submitBtn}
                />

                <Button
                  title="Change mobile number"
                  onPress={() => {
                    setOtpSent(false);
                    setPhoneConfirmation(null);
                  }}
                  variant="text"
                  style={{ marginTop: spacing.sm }}
                />
              </>
            )}
          </View>

          {/* Direct Bypass to MainTabs for Development Inspection */}
          {__DEV__ && (
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs')}
            style={styles.devBypassBtn}
          >
            <Text style={styles.devBypassText}>
              ⚡ Dev Preview: Explore Main App Without Authentication →
            </Text>
          </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.lg,
  },
  subtext: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '600',
    color: colors.charcoal,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.2,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  chipSelected: {
    backgroundColor: '#FFF0F4',
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    fontWeight: '500',
    color: colors.charcoal,
  },
  chipTextSelected: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  googleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  googleIconText: {
    color: '#FFFFFF',
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    fontSize: 14,
  },
  googleBtnText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '600',
    color: colors.charcoal,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyMedium,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  consentText: {
    flex: 1,
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  linkText: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    textDecorationLine: 'underline',
  },
  safetyBox: {
    backgroundColor: '#F5F5F0',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.deepTeal,
    marginBottom: spacing.xl,
  },
  safetyTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.deepTeal,
    marginBottom: 2,
  },
  safetyText: {
    fontSize: typography.fontSizes.xs - 1,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 16,
  },
  submitBtn: {
    width: '100%',
    minHeight: 50,
  },
  devBypassBtn: {
    padding: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    alignItems: 'center',
  },
  devBypassText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodySemiBold,
    color: '#8D6E63',
    fontWeight: '700',
  },
  clientNoticeBox: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  clientNoticeTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: '#F57F17',
    marginBottom: 4,
  },
  clientNoticeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: '#795548',
    lineHeight: 18,
  },
});
