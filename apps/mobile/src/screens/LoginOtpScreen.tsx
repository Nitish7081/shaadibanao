import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';
import { ds, PressableScale } from '../design';
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
  describeLoginError,
  PhoneConfirmResult,
} from '../services/firebaseAuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'LoginOtp'>;

export const LoginOtpScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

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
        setLoading(false);
        Alert.alert('Phone Verification Failed', describeFirebaseAuthError(fbErr));
        return;
      }
    }

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
      Alert.alert('Request Failed', err?.message || 'Unable to request OTP. Check backend server connection.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);

    if (phoneConfirmation) {
      try {
        const { idToken } = await confirmFirebasePhoneOtp(phoneConfirmation, otp);
        const res = await loginWithFirebase(idToken, profileFor);

        if (res.data?.tokens && res.data?.user) {
          setSessionAuth(res.data.tokens, res.data.user.id, res.data.user);
          setLoading(false);

          if (res.data.isNewUser || !res.data.user.hasProfile) {
            Alert.alert('Account Verified', 'Authentication successful! Let us create your matrimonial profile.', [
              { text: 'Create Profile', onPress: () => navigation.navigate('ProfileCreation') },
            ]);
          } else if (res.data.user.approvalStatus && res.data.user.approvalStatus !== 'approved') {
            navigation.replace('ApprovalPending');
          } else {
            navigation.navigate('MainTabs');
          }
        }
      } catch (fbErr: any) {
        setLoading(false);
        Alert.alert('Verification Failed', describeFirebaseAuthError(fbErr));
      }
      return;
    }

    try {
      const verifyRes = await verifyOtp(cleanMobile, otp);
      if (verifyRes.data?.auth) {
        const authData = verifyRes.data.auth;
        setSessionAuth(authData.tokens, authData.user.id, authData.user);
        setLoading(false);

        if (!authData.user.hasProfile) {
          navigation.navigate('ProfileCreation');
        } else if (authData.user.approvalStatus && authData.user.approvalStatus !== 'approved') {
          navigation.replace('ApprovalPending');
        } else {
          navigation.navigate('MainTabs');
        }
        return;
      }

      if (verifyRes.data?.verificationToken) {
        const regRes = await registerUser({
          mobile: cleanMobile,
          verificationToken: verifyRes.data.verificationToken,
          profileFor,
          consentToTerms: true,
        });
        if (regRes.data?.tokens && regRes.data?.user) {
          setSessionAuth(regRes.data.tokens, regRes.data.user.id, regRes.data.user);
          setLoading(false);
          navigation.navigate('ProfileCreation');
          return;
        }
      }
      setLoading(false);
      Alert.alert('Login Notice', 'Could not complete registration. Please try again.');
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Verification Error', err?.message || 'Invalid OTP code.');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await loginWithFirebase(idToken, profileFor);
      if (res.data?.tokens && res.data?.user) {
        setSessionAuth(res.data.tokens, res.data.user.id, res.data.user);
        if (res.data.isNewUser || !res.data.user.hasProfile) {
          navigation.navigate('ProfileCreation');
        } else if (res.data.user.approvalStatus && res.data.user.approvalStatus !== 'approved') {
          navigation.replace('ApprovalPending');
        } else {
          navigation.navigate('MainTabs');
        }
      }
    } catch (gErr: any) {
      Alert.alert('Google Sign-In', describeLoginError(gErr));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <View style={styles.topNav}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>
        <Text maxFontSizeMultiplier={1.2} style={styles.navTitle}>
          BandhanSetu Sign In
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Title */}
          <View style={styles.headerBlock}>
            <Text maxFontSizeMultiplier={1.2} style={styles.mainTitle}>
              {otpSent ? 'Enter 6-Digit OTP' : 'Begin Your Matrimonial Journey'}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.subtitle}>
              {otpSent
                ? `Verification code dispatched to +91 ${cleanMobile}`
                : '100% verified matrimonial matchmaking with Vedic privacy.'}
            </Text>
          </View>

          {/* Card Container */}
          <View style={styles.card}>
            {!otpSent ? (
              <>
                {/* Profile For Selection */}
                <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
                  This profile is being created for:
                </Text>
                <View style={styles.chipsRow}>
                  {PROFILE_CREATED_FOR.map((item) => {
                    const isSelected = profileFor === item;
                    return (
                      <PressableScale
                        key={item}
                        style={[styles.profileChip, isSelected && styles.profileChipActive]}
                        onPress={() => setProfileFor(item)}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#FFFFFF"
                          />
                        )}
                        <Text
                          maxFontSizeMultiplier={1.2}
                          style={[
                            styles.profileChipText,
                            isSelected && styles.profileChipTextActive,
                          ]}
                        >
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>

                {/* Mobile Input */}
                <Text maxFontSizeMultiplier={1.2} style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Mobile Number
                </Text>
                <View style={styles.phoneInputWrap}>
                  <View style={styles.countryPill}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.countryCode}>
                      🇮🇳 +91
                    </Text>
                  </View>
                  <TextInput
                    style={styles.phoneTextInput}
                    placeholder="9876543210"
                    placeholderTextColor={ds.color.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                  />
                </View>

                {/* Consent Checkbox */}
                <PressableScale
                  style={styles.consentRow}
                  onPress={() => setConsentAgreed(!consentAgreed)}
                >
                  <Ionicons
                    name={consentAgreed ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={ds.color.maroon}
                  />
                  <Text maxFontSizeMultiplier={1.2} style={styles.consentText}>
                    I agree to the Terms of Service, Privacy Policy & Sanatan Community Guidelines.
                  </Text>
                </PressableScale>

                {/* Send OTP Button */}
                <PressableScale
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#7A1528', '#9B1D36']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-ellipses" size={17} color="#FFFFFF" />
                        <Text maxFontSizeMultiplier={1.2} style={styles.submitBtnText}>
                          Send Verification OTP
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              </>
            ) : (
              <>
                {/* OTP Input Section */}
                <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
                  Enter 6-Digit Code
                </Text>
                <View style={styles.otpInputWrap}>
                  <TextInput
                    style={styles.otpTextInput}
                    placeholder="• • • • • •"
                    placeholderTextColor={ds.color.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    autoFocus
                  />
                </View>

                <View style={styles.resendRow}>
                  <PressableScale
                    onPress={() => setOtpSent(false)}
                    style={styles.changeNumberBtn}
                  >
                    <Ionicons name="create-outline" size={14} color={ds.color.maroon} />
                    <Text maxFontSizeMultiplier={1.2} style={styles.changeNumberText}>
                      Change Number
                    </Text>
                  </PressableScale>

                  <PressableScale
                    onPress={handleSendOtp}
                    disabled={resendTimer > 0 || loading}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[
                        styles.resendText,
                        resendTimer > 0 && styles.resendTextDisabled,
                      ]}
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </Text>
                  </PressableScale>
                </View>

                {/* Verify OTP Button */}
                <PressableScale
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#7A1528', '#9B1D36']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                        <Text maxFontSizeMultiplier={1.2} style={styles.submitBtnText}>
                          Verify & Proceed
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              </>
            )}

            {/* Google Sign In Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text maxFontSizeMultiplier={1.2} style={styles.dividerText}>
                OR
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <PressableScale
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={ds.color.maroon} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={ds.color.maroon} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.googleBtnText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
  },
  scrollContent: {
    padding: ds.space.md,
  },
  headerBlock: {
    marginVertical: ds.space.md,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: ds.color.maroon,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: ds.space.md,
  },
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.lg,
    ...ds.shadow.soft,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 4,
  },
  profileChipActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  profileChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  profileChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ds.color.border,
    overflow: 'hidden',
  },
  countryPill: {
    backgroundColor: '#F3EADB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: ds.color.border,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.text,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: ds.color.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    letterSpacing: 1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    marginBottom: ds.space.lg,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: ds.color.textMuted,
    lineHeight: 18,
  },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  otpInputWrap: {
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  otpTextInput: {
    fontSize: 26,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ds.space.lg,
  },
  changeNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeNumberText: {
    fontSize: 13,
    color: ds.color.maroon,
    fontWeight: '600',
  },
  resendText: {
    fontSize: 13,
    color: ds.color.maroon,
    fontWeight: '700',
  },
  resendTextDisabled: {
    color: ds.color.textMuted,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: ds.space.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ds.color.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderRadius: 16,
    paddingVertical: 12,
    gap: 8,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.maroon,
  },
});
