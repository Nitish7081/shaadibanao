import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';
import { ds, PressableScale } from '../design';

interface LoginScreenProps {
  onLoginSuccess: (mobile: string) => void;
  onBackToWelcome: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onBackToWelcome }) => {
  const insets = useSafeAreaInsets();
  const [profileFor, setProfileFor] = useState<ProfileCreatedFor>('myself');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const cleanMobile = mobileNumber.replace(/\D/g, '');

  const handleSendOtp = () => {
    if (cleanMobile.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit Indian mobile number.');
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
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setResendTimer(30);
      Alert.alert(
        'OTP Sent',
        `A 6-digit verification code has been sent to +91 ${cleanMobile}.`
      );
    }, 600);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP received on your mobile.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(cleanMobile);
    }, 600);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <View style={styles.topNav}>
        <PressableScale
          style={styles.backBtn}
          onPress={onBackToWelcome}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>
        <Text maxFontSizeMultiplier={1.2} style={styles.navTitle}>
          BandhanSetu
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
          <View style={styles.header}>
            <Text maxFontSizeMultiplier={1.2} style={styles.brandTitle}>
              BandhanSetu Matrimony
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.tagline}>
              Serious about marriage • Safe & Vedic by design
            </Text>
          </View>

          <View style={styles.card}>
            <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle}>
              {otpSent ? 'Verify Mobile Number' : 'Create your account'}
            </Text>

            {!otpSent ? (
              <>
                <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
                  This profile is for
                </Text>
                <View style={styles.chipsRow}>
                  {PROFILE_CREATED_FOR.map((item) => {
                    const isSelected = profileFor === item;
                    return (
                      <PressableScale
                        key={item}
                        onPress={() => setProfileFor(item)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
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
                          style={[styles.chipText, isSelected && styles.chipTextSelected]}
                        >
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>

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
                    I agree to the Terms of Service & Sanatan Privacy Policy.
                  </Text>
                </PressableScale>

                <PressableScale
                  style={styles.submitBtn}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#7A1528', '#9B1D36']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    <Ionicons name="chatbubble-ellipses" size={17} color="#FFFFFF" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.submitBtnText}>
                      Send Verification Code
                    </Text>
                  </LinearGradient>
                </PressableScale>
              </>
            ) : (
              <>
                <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
                  Enter 6-digit OTP code
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

                <PressableScale
                  style={styles.submitBtn}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#7A1528', '#9B1D36']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.submitBtnText}>
                      Verify & Proceed
                    </Text>
                  </LinearGradient>
                </PressableScale>
              </>
            )}
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
  header: {
    alignItems: 'center',
    marginVertical: ds.space.md,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.lg,
    ...ds.shadow.soft,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ds.color.text,
    marginBottom: ds.space.md,
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
  chip: {
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
  chipSelected: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  chipTextSelected: {
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
    marginBottom: 16,
  },
  otpTextInput: {
    fontSize: 26,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
});
