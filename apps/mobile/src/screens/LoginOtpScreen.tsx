import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'LoginOtp'>;

export const LoginOtpScreen: React.FC<Props> = ({ navigation }) => {
  const [profileFor, setProfileFor] = useState<ProfileCreatedFor>('myself');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const handleSendOtp = () => {
    const clean = mobileNumber.replace(/\D/g, '');
    if (clean.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number.');
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
    }, 600);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Navigate to Profile Creation Wizard (S-05)
      navigation.navigate('ProfileCreation');
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Account Access"
        subtitle="Secure OTP Login & Registration"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Authentication Milestone: Milestone 4"
          subtext="UI navigation & flow ready. Milestone 4 will connect server-side OTP dispatch and short-lived JWT generation."
        />

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
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Input
                label="Mobile number"
                prefix="+91"
                placeholder="98XXXXXXXX"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                helperText="We will send a 6-digit one-time password"
              />

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentAgreed(!consentAgreed)}
                style={styles.checkboxContainer}
              >
                <View style={[styles.checkbox, consentAgreed && styles.checkboxChecked]}>
                  {consentAgreed && <Text style={styles.checkboxCheckmark}>✓</Text>}
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
                title="Send OTP"
                onPress={handleSendOtp}
                loading={loading}
                variant="primary"
                style={styles.submitBtn}
              />
            </>
          ) : (
            <>
              <Text style={styles.subtext}>
                We sent a 6-digit verification code to +91 {mobileNumber}
              </Text>

              <Input
                label="Enter 6-digit OTP"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                helperText={`Resend code in 00:${resendTimer < 10 ? `0${resendTimer}` : resendTimer}`}
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
                onPress={() => setOtpSent(false)}
                variant="text"
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </View>

        {/* Direct Bypass to MainTabs for Development Inspection */}
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          style={styles.devBypassBtn}
        >
          <Text style={styles.devBypassText}>
            ⚡ Dev Preview: Explore Main App Without Authentication →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
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
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.lg,
  },
  subtext: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
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
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  chipSelected: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  chipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '500',
    color: colors.charcoal,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    color: colors.textSecondary,
    lineHeight: 18,
  },
  linkText: {
    color: colors.royalMaroon,
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
    fontWeight: '700',
    color: colors.deepTeal,
    marginBottom: 2,
  },
  safetyText: {
    fontSize: typography.fontSizes.xs - 1,
    color: colors.charcoal,
    lineHeight: 16,
  },
  submitBtn: {
    width: '100%',
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
    color: '#8D6E63',
    fontWeight: '700',
  },
});
