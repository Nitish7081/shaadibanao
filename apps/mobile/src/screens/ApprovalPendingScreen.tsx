import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, fonts } from '../constants/theme';
import { ShaadiBanaoLogo } from '../components/royal/ShaadiBanaoLogo';
import {
  getSessionUser,
  performLogout,
  hasActiveSession,
  syncCurrentUserWithBackend,
  onUserUpdated,
} from '../services/authSession';
import { isUserAdminVerified } from '../navigation/authRouting';

type Props = NativeStackScreenProps<RootStackParamList, 'ApprovalPending'>;

export const ApprovalPendingScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState(getSessionUser());
  const [loading, setLoading] = useState(false);
  const isNavigatingRef = useRef(false);

  const approvalStatus = user?.approvalStatus || 'pending';
  const idStatus = user?.identityVerificationStatus || 'none';
  const isSuspended = user?.status === 'suspended';
  const needsMandatoryIdUpload = !isSuspended && !isUserAdminVerified(user) && (idStatus === 'none' || idStatus === 'rejected');

  const routeVerifiedUser = (updatedUser: any, isSilent: boolean) => {
    isNavigatingRef.current = true;
    const targetScreen = updatedUser.hasProfile ? 'MainTabs' : 'ProfileCreation';
    if (!isSilent) {
      Alert.alert(
        updatedUser.hasProfile ? 'Account Approved! 🎉' : 'ID Verified by Admin! 🎉',
        updatedUser.hasProfile
          ? 'Congratulations! Your matrimonial profile has been approved. You now have full access to search and matching.'
          : 'Your identity document has been verified by Admin. You can now create your ShaadiBanao matrimonial profile!',
        [
          {
            text: updatedUser.hasProfile ? 'Enter ShaadiBanao' : 'Create My Profile',
            onPress: () => navigation.replace(targetScreen),
          },
        ]
      );
    } else {
      navigation.replace(targetScreen);
    }
  };

  const handleRefreshStatus = async (isSilent = false) => {
    if (isNavigatingRef.current) return;
    if (!isSilent) setLoading(true);

    try {
      const updatedUser = await syncCurrentUserWithBackend();
      if (!updatedUser && !hasActiveSession()) {
        isNavigatingRef.current = true;
        navigation.replace('LoginOtp');
        return;
      }
      if (updatedUser) {
        setUser(updatedUser);

        if (isUserAdminVerified(updatedUser) && updatedUser.status !== 'suspended') {
          routeVerifiedUser(updatedUser, isSilent);
          return;
        }

        if (!isSilent) {
          const latestIdStatus = updatedUser.identityVerificationStatus || 'none';
          const statusMsg =
            latestIdStatus === 'none'
              ? 'ID Proof NOT uploaded yet. Please upload Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook.'
              : latestIdStatus === 'rejected'
              ? `Your ID document was rejected.${updatedUser.rejectionReason ? ` Reason: ${updatedUser.rejectionReason}` : ''} Please re-upload a clear photo.`
              : `Your ID document is under Admin review.\nAccount Approval: ${updatedUser.approvalStatus.toUpperCase()}\nIdentity Status: ${latestIdStatus.toUpperCase()}`;
          Alert.alert('Verification Status', statusMsg);
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        Alert.alert('Refresh Failed', err.message || 'Unable to fetch latest status. Please try again.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial check on mount
    handleRefreshStatus(true);

    // 2. Poll every 6 seconds while waiting for admin review
    const interval = setInterval(() => {
      handleRefreshStatus(true);
    }, 6000);

    // 3. Listen to AppState foregrounding
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        handleRefreshStatus(true);
      }
    });

    // 4. Listen to authSession events
    const unsubUser = onUserUpdated((updatedUser) => {
      setUser(updatedUser);
      if (updatedUser && isUserAdminVerified(updatedUser) && updatedUser.status !== 'suspended') {
        routeVerifiedUser(updatedUser, true);
      }
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      unsubUser();
    };
  }, []);

  const handleLogout = async () => {
    await performLogout();
    navigation.replace('LoginOtp');
  };

  const getStatusBadge = () => {
    if (isSuspended) {
      return { label: 'Account Suspended', bg: 'rgba(239, 68, 68, 0.15)', text: colors.alertRed };
    }
    if (idStatus === 'none') {
      return { label: '🪪 ID Proof Required', bg: 'rgba(239, 68, 68, 0.15)', text: colors.alertRed };
    }
    if (idStatus === 'rejected') {
      return { label: '✕ ID Document Rejected', bg: 'rgba(239, 68, 68, 0.15)', text: colors.alertRed };
    }
    if (idStatus === 'pending' && !user?.hasProfile) {
      return { label: '⏳ Waiting for Admin ID Verification', bg: 'rgba(245, 158, 11, 0.15)', text: colors.softGold };
    }
    switch (approvalStatus) {
      case 'approved':
        return { label: '✓ Approved', bg: 'rgba(16, 185, 129, 0.15)', text: colors.verifiedGreen };
      case 'rejected':
        return { label: '✕ Registration Rejected', bg: 'rgba(239, 68, 68, 0.15)', text: colors.alertRed };
      case 'changes_requested':
        return { label: '💬 Changes Requested', bg: 'rgba(245, 158, 11, 0.15)', text: colors.softGold };
      default:
        return { label: '⏳ Verification Under Review', bg: 'rgba(245, 158, 11, 0.15)', text: colors.softGold };
    }
  };

  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Emblem & Branding */}
        <View style={styles.brandHeader}>
          <ShaadiBanaoLogo size="large" />
          <Text style={styles.brandTitle}>ShaadiBanao</Text>
          <Text style={styles.brandSubtitle}>Rishton ki nayi shuruaat • Trust & Safety</Text>
        </View>

        {/* Main Status Card */}
        <View style={styles.card}>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>

          <Text style={styles.headline}>
            {isSuspended
              ? 'Account Restricted'
              : idStatus === 'none'
              ? 'Upload Compulsory ID Document'
              : idStatus === 'rejected'
              ? 'ID Document Needs Re-upload'
              : !user?.hasProfile
              ? 'ID Submitted — Waiting for Admin Verification'
              : approvalStatus === 'rejected'
              ? 'Profile Did Not Meet Guidelines'
              : approvalStatus === 'changes_requested'
              ? 'Profile Updates Required'
              : 'Your Account is Under Review'}
          </Text>

          <Text style={styles.description}>
            {isSuspended
              ? 'Your account has been suspended by administration. Access to search, matching, and conversations is restricted.'
              : idStatus === 'none'
              ? 'Before creating your ShaadiBanao profile, you must upload a clear photo of ANY ONE document: Aadhaar Card, PAN Card, Voter ID Card, Passport, or Bank Passbook.'
              : idStatus === 'rejected'
              ? 'Our admin team could not verify your submitted ID document. Please upload a clearer photo of your Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook.'
              : !user?.hasProfile
              ? 'Thank you! Your identity document has been submitted to the Admin Panel. As soon as Admin verifies your ID, your profile creation form will unlock automatically.'
              : approvalStatus === 'rejected'
              ? 'Our moderation team reviewed your profile and could not approve it based on community guidelines.'
              : approvalStatus === 'changes_requested'
              ? 'Our moderation team reviewed your profile and requested specific changes before your account can be approved.'
              : 'Thank you for registering on ShaadiBanao. Every member is verified by an administrator before unlocking partner search and messaging.'}
          </Text>

          {/* Identity Document Status Box */}
          {!isSuspended && (
            <View style={styles.photoStatusBox}>
              <Ionicons
                name={
                  idStatus === 'verified'
                    ? 'shield-checkmark'
                    : idStatus === 'rejected' || idStatus === 'none'
                    ? 'alert-circle'
                    : 'hourglass-outline'
                }
                size={18}
                color={
                  idStatus === 'verified'
                    ? colors.verifiedGreen
                    : idStatus === 'rejected' || idStatus === 'none'
                    ? colors.alertRed
                    : colors.royalMaroon
                }
              />
              <Text style={styles.photoStatusText}>
                Identity Document:{' '}
                <Text style={{ fontWeight: '700' }}>
                  {idStatus === 'verified'
                    ? 'Verified by Admin ✓'
                    : idStatus === 'pending'
                    ? 'Uploaded — Pending Admin Review ⏳'
                    : idStatus === 'rejected'
                    ? 'Rejected (Please Re-upload)'
                    : 'Not Uploaded (Compulsory)'}
                </Text>
              </Text>
            </View>
          )}

          {/* Photo Moderation Status Box */}
          {user?.photoApprovalStatus && user.photoApprovalStatus !== 'none' && (
            <View style={styles.photoStatusBox}>
              <Ionicons
                name={
                  user.photoApprovalStatus === 'approved'
                    ? 'checkmark-circle'
                    : user.photoApprovalStatus === 'rejected'
                    ? 'close-circle'
                    : 'hourglass-outline'
                }
                size={18}
                color={
                  user.photoApprovalStatus === 'approved'
                    ? colors.verifiedGreen
                    : user.photoApprovalStatus === 'rejected'
                    ? colors.alertRed
                    : colors.royalMaroon
                }
              />
              <Text style={styles.photoStatusText}>
                Profile Photo:{' '}
                <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>
                  {user.photoApprovalStatus === 'approved'
                    ? 'Approved ✓'
                    : user.photoApprovalStatus === 'rejected'
                    ? 'Changes Requested (Please Replace)'
                    : 'Under Admin Moderation ⏳'}
                </Text>
              </Text>
            </View>
          )}

          {/* Rejection / Changes Feedback Box */}
          {(user?.rejectionReason || user?.moderationRemarks) && (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackTitle}>Feedback from Moderation Team:</Text>
              {user?.rejectionReason && (
                <Text style={styles.feedbackText}>
                  <Text style={{ fontWeight: '700' }}>Reason: </Text>
                  {user.rejectionReason}
                </Text>
              )}
              {user?.moderationRemarks && (
                <Text style={styles.feedbackText}>
                  <Text style={{ fontWeight: '700' }}>Remarks: </Text>
                  {user.moderationRemarks}
                </Text>
              )}
            </View>
          )}

          {/* Verification Steps Summary */}
          {!isSuspended && approvalStatus === 'pending' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>What happens during review?</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoBullet}>🛡️</Text>
                <Text style={styles.infoText}>Photo authenticity and quality check</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoBullet}>📋</Text>
                <Text style={styles.infoText}>Matrimonial biodata & career details verification</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoBullet}>⏱️</Text>
                <Text style={styles.infoText}>Typical review turnaround: 1–2 hours</Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {needsMandatoryIdUpload && (
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.8}
                onPress={() => navigation.replace('IdentityVerification', { mandatory: true })}
              >
                <Text style={styles.primaryBtnText}>
                  🪪 {idStatus === 'rejected' ? 'Re-upload Mandatory ID Proof' : 'Upload Mandatory ID Proof'}
                </Text>
              </TouchableOpacity>
            )}

            {!needsMandatoryIdUpload && approvalStatus === 'pending' && !isSuspended && (
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.8}
                onPress={() => handleRefreshStatus(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>⟳ Check / Refresh Admin Verification</Text>
                )}
              </TouchableOpacity>
            )}

            {!isSuspended && !needsMandatoryIdUpload && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.softGold, backgroundColor: '#FAF6ED' }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('IdentityVerification', { mandatory: true })}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.royalMaroon, fontWeight: '700' }]}>
                  🪪 Re-upload ID (Aadhaar / PAN / Voter ID / Passport / Passbook)
                </Text>
              </TouchableOpacity>
            )}

            {/* Existing profile edits are ONLY allowed if the user already has a profile AND is verified */}
            {user?.hasProfile && isUserAdminVerified(user) && (approvalStatus === 'rejected' || approvalStatus === 'changes_requested') && !isSuspended && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ProfileCreation')}
              >
                <Text style={styles.secondaryBtnText}>✏️ Edit & Resubmit Profile</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.textBtn} activeOpacity={0.7} onPress={handleLogout}>
              <Text style={styles.textBtnText}>Sign Out / Switch Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Need urgent assistance with your verification?</Text>
          <Text style={styles.supportLink}>support@shaadibanao.com</Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 90,
    height: 60,
    marginBottom: spacing.xs,
  },
  brandTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontFamily: fonts.headingBold,
    fontWeight: '800',
    color: colors.royalMaroon,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  statusBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: typography.fontSizes.xl,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  photoStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: spacing.md,
    gap: 8,
  },
  photoStatusText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    flex: 1,
  },
  feedbackBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  feedbackTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.alertRed,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  feedbackText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  infoBox: {
    backgroundColor: 'rgba(128, 0, 32, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(128, 0, 32, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoBullet: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: spacing.md,
    minHeight: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.md,
    minHeight: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },
  textBtn: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBtnText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    marginBottom: 4,
  },
  supportLink: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
});
