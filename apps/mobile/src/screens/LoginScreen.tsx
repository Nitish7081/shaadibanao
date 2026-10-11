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
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { BackendStatusBadge } from '../components/common/BackendStatusBadge';

interface LoginScreenProps {
  onLoginSuccess: (mobile: string) => void;
  onBackToWelcome: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onBackToWelcome }) => {
  const [profileFor, setProfileFor] = useState<ProfileCreatedFor>('myself');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const handleSendOtp = () => {
    const cleanMobile = mobileNumber.replace(/\D/g, '');
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
    // Simulating sending OTP via centralized service
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setResendTimer(30);
      Alert.alert(
        'OTP Sent',
        `A 6-digit verification code has been sent to +91 ${cleanMobile}.\n(For testing in Milestone 1, enter 123456)`
      );
    }, 800);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP received on your mobile.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(mobileNumber);
    }, 700);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBackToWelcome}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <BackendStatusBadge />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>BandhanSetu</Text>
          <Text style={styles.tagline}>Serious about marriage. Safe by design.</Text>
        </View>

        {/* Card Container */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {otpSent ? 'Verify Mobile Number' : 'Create your account'}
          </Text>

          {!otpSent ? (
            <>
              {/* Profile For Selection */}
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

              {/* Mobile Input */}
              <Input
                label="Mobile number"
                prefix="+91"
                placeholder="98XXXXXXXX"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={setMobileNumber}
              />

              {/* Consent Checkbox */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentAgreed(!consentAgreed)}
                style={styles.checkboxContainer}
              >
                <View style={[styles.checkbox, consentAgreed && styles.checkboxChecked]}>
                  {consentAgreed && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>
                  I agree to{' '}
                  <Text style={styles.linkText}>Terms</Text> and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text> and consent to my data being
                  used to find matches.
                </Text>
              </TouchableOpacity>

              {/* Blueprint Safety Note */}
              <View style={styles.safetyNoteCard}>
                <Text style={styles.safetyNoteIcon}>ℹ️</Text>
                <Text style={styles.safetyNoteText}>
                  Safety note: OTP only confirms your number. It does not prove identity. Verify
                  your ID later for a badge.
                </Text>
              </View>

              {/* Primary Action Button */}
              <Button
                title="Send OTP"
                onPress={handleSendOtp}
                loading={loading}
                variant="primary"
                style={styles.submitButton}
              />
            </>
          ) : (
            <>
              <Text style={styles.subtext}>
                Enter the 6-digit code sent to +91 {mobileNumber}
              </Text>

              {/* OTP Input */}
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
                title="Continue"
                onPress={handleVerifyOtp}
                loading={loading}
                variant="primary"
                style={styles.submitButton}
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

        {/* Pandit / Astrologer Join Card (Blueprint S-00c) */}
        <View style={styles.panditCard}>
          <Text style={styles.panditTitle}>Are you a Pandit / Astrologer?</Text>
          <Text style={styles.panditDesc}>Offer live guidance to verified members</Text>
          <Button
            title="Join as Pandit"
            onPress={() =>
              Alert.alert(
                'Pandit Onboarding',
                'The Pandit registration module is scheduled for Phase 2.'
              )
            }
            variant="upgrade"
            style={styles.panditButton}
          />
        </View>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Browse Profiles',
              'Guest browsing will show limited anonymous profiles in accordance with our display rules.'
            )
          }
          style={styles.guestButton}
        >
          <Text style={styles.guestButtonText}>Browse profiles without login</Text>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    fontSize: typography.fontSizes.base,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  brandTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: spacing.xxs,
  },
  tagline: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: spacing.xl,
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
  safetyNoteCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F0',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.deepTeal,
    marginBottom: spacing.xl,
  },
  safetyNoteIcon: {
    marginRight: spacing.sm,
    fontSize: 16,
  },
  safetyNoteText: {
    flex: 1,
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    lineHeight: 18,
  },
  submitButton: {
    width: '100%',
  },
  panditCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.softGold,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  panditTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.xxs,
  },
  panditDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  panditButton: {
    width: '100%',
  },
  guestButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  guestButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
});
