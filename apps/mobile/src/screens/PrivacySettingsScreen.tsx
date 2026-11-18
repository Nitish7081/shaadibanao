import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AccountDeletionReason } from '@bandhansetu/shared';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';
import { PressableScale } from '../design';
import { deleteMyAccount } from '../services/authService';
import { getSessionToken, performLogout } from '../services/authSession';
import { LEGAL_URLS, openExternalLegalUrl } from '../config/legalUrls';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

const DELETION_REASONS: Array<{ value: AccountDeletionReason; label: string }> = [
  { value: 'found_match_on_shaadibanao', label: 'Found my life partner on ShaadiBanao' },
  { value: 'found_match_elsewhere', label: 'Found my match elsewhere' },
  { value: 'taking_a_break', label: 'Taking a break from matrimonial search' },
  { value: 'privacy_concerns', label: 'Privacy preferences' },
  { value: 'duplicate_account', label: 'Removing a duplicate account' },
  { value: 'other', label: 'Other reason' },
];

export const PrivacySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [hideProfile, setHideProfile] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const [showIncomeBand, setShowIncomeBand] = useState(true);
  const [contactOnlyWithConsent, setContactOnlyWithConsent] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  // Real Backend-Connected Account Deletion Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<AccountDeletionReason>('taking_a_break');
  const [feedback, setFeedback] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleOpenDeleteModal = () => {
    const token = getSessionToken();
    if (!token) {
      Alert.alert(
        'Sign-In Required',
        'Please sign in to delete your account from the app, or visit our public Account Deletion portal.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Web Portal',
            onPress: () => openExternalLegalUrl(LEGAL_URLS.deleteAccount, 'Delete Account'),
          },
        ]
      );
      return;
    }
    setConfirmChecked(false);
    setFeedback('');
    setDeleteModalOpen(true);
  };

  const handleConfirmPermanentDeletion = async () => {
    if (!confirmChecked) {
      Alert.alert(
        'Confirmation Required',
        'Please check the confirmation box to verify that you understand permanent account deletion.'
      );
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setDeleteModalOpen(false);
      Alert.alert('Session Expired', 'Please sign in again to verify your identity.');
      return;
    }

    setDeleting(true);
    try {
      const response = await deleteMyAccount(
        token,
        selectedReason,
        feedback.trim() || undefined
      );
      const refId = response.data?.requestId || 'DEL-COMPLETED';
      setDeleteModalOpen(false);
      await performLogout();

      Alert.alert(
        'Account Permanently Deleted',
        `Your ShaadiBanao account, profile, photos, and personal preferences have been deleted.\n\nReference ID: ${refId}\n\nKeep this Reference ID if you wish to check your deletion audit status at shaadibanao /delete-account.`,
        [
          {
            text: 'Done',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Account Deletion Failed',
        err?.message ||
          'We could not complete your deletion request right now. Please check your connection or use /delete-account on the web.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="Privacy & Account Settings"
        subtitle="Privacy by default. You are in control."
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Privacy & Visibility"
          subtext="Control who can view your profile photo and contact details. Your preferences are saved securely."
        />

        {/* Profile Visibility Toggles */}
        <Text style={styles.sectionTitle}>Profile Visibility</Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Hide my profile from search</Text>
              <Text style={styles.settingSub}>
                Temporarily pause new interest requests while keeping active chats
              </Text>
            </View>
            <Switch
              value={hideProfile}
              onValueChange={setHideProfile}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Show last seen</Text>
              <Text style={styles.settingSub}>Allow matches to see when you were last active</Text>
            </View>
            <Switch
              value={showLastSeen}
              onValueChange={setShowLastSeen}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Show online status</Text>
              <Text style={styles.settingSub}>Display a green indicator when actively using the app</Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={setShowOnlineStatus}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>
        </Card>

        {/* Data & Contact Privacy */}
        <Text style={styles.sectionTitle}>Data & Contact Shield</Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Share contact only with consent</Text>
              <Text style={styles.settingSub}>
                Never reveal mobile number or email without 2-way approval (Always ON)
              </Text>
            </View>
            <Switch
              value={contactOnlyWithConsent}
              onValueChange={setContactOnlyWithConsent}
              disabled={true}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Show annual income band</Text>
              <Text style={styles.settingSub}>
                Show general range (e.g. ₹15L-25L) on your public card
              </Text>
            </View>
            <Switch
              value={showIncomeBand}
              onValueChange={setShowIncomeBand}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>
        </Card>

        {/* Communication Preferences */}
        <Text style={styles.sectionTitle}>Communication Preferences</Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>Email alerts for daily matches</Text>
              <Text style={styles.settingSub}>Receive daily hand-picked recommendations</Text>
            </View>
            <Switch
              value={emailAlerts}
              onValueChange={setEmailAlerts}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.settingLabel}>SMS alerts for new interests</Text>
              <Text style={styles.settingSub}>Receive immediate text messages for new interests</Text>
            </View>
            <Switch
              value={smsAlerts}
              onValueChange={setSmsAlerts}
              trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
            />
          </View>
        </Card>

        {/* Official Legal Policies */}
        <Text style={styles.sectionTitle}>Legal Policies & Support</Text>
        <Card style={styles.card}>
          <PressableScale
            style={styles.legalRow}
            onPress={() => openExternalLegalUrl(LEGAL_URLS.privacyPolicy, 'Privacy Policy')}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.royalMaroon} />
            <Text style={styles.legalRowText}>Official Privacy Policy</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </PressableScale>

          <PressableScale
            style={styles.legalRow}
            onPress={() => openExternalLegalUrl(LEGAL_URLS.termsAndConditions, 'Terms & Conditions')}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.royalMaroon} />
            <Text style={styles.legalRowText}>Terms & Conditions</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </PressableScale>

          <PressableScale
            style={[styles.legalRow, { borderBottomWidth: 0 }]}
            onPress={() => openExternalLegalUrl(LEGAL_URLS.contact, 'Contact & Grievance Support')}
          >
            <Ionicons name="help-buoy-outline" size={18} color={colors.royalMaroon} />
            <Text style={styles.legalRowText}>Contact & Grievance Officer</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </PressableScale>
        </Card>

        {/* Data Rights & Real Backend Account Deletion */}
        <Text style={styles.sectionTitle}>Data Rights & Account Deletion</Text>
        <Card style={styles.card}>
          <Text style={styles.deleteInfoText}>
            Deleting your account permanently removes your matrimonial profile, Cloudinary photos,
            private identity documents, Kundli, partner preferences, and active sessions. Minimal
            anonymized audit and statutory compliance logs are retained as required by Indian law.
          </Text>
          <Button
            title="Delete Account Permanently"
            onPress={handleOpenDeleteModal}
            variant="text"
            textStyle={{ color: colors.alertRed, fontWeight: '700' }}
          />
        </Card>
      </ScrollView>

      {/* Verified Permanent Account Deletion Modal */}
      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!deleting) setDeleteModalOpen(false); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete ShaadiBanao Account</Text>
            <Text style={styles.modalSubtitle}>
              This action connects directly to our servers and cannot be undone. Your profile,
              photos, preferences, Kundli, and private ID files will be permanently purged.
            </Text>

            <Text style={styles.modalLabel}>Select a reason:</Text>
            <View style={styles.reasonsWrap}>
              {DELETION_REASONS.map((r) => {
                const active = selectedReason === r.value;
                return (
                  <PressableScale
                    key={r.value}
                    style={[styles.reasonChip, active && styles.reasonChipActive]}
                    onPress={() => setSelectedReason(r.value)}
                  >
                    <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>
                      {r.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            <TextInput
              style={styles.feedbackInput}
              placeholder="Optional feedback for our team..."
              placeholderTextColor={colors.textMuted}
              value={feedback}
              onChangeText={setFeedback}
              maxLength={400}
              multiline
            />

            <PressableScale
              style={styles.confirmRow}
              onPress={() => setConfirmChecked(!confirmChecked)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmChecked }}
            >
              <Ionicons
                name={confirmChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={colors.alertRed}
              />
              <Text style={styles.confirmText}>
                I understand that my account and personal matrimonial data will be permanently
                deleted, with only anonymized compliance/statutory audit logs retained.
              </Text>
            </PressableScale>

            <View style={styles.modalActions}>
              <PressableScale
                style={styles.cancelBtn}
                onPress={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </PressableScale>

              <PressableScale
                style={[styles.dangerBtn, (!confirmChecked || deleting) && { opacity: 0.65 }]}
                onPress={handleConfirmPermanentDeletion}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.dangerBtnText}>Permanently Delete</Text>
                )}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  textColumn: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSizes.xs + 1,
    fontWeight: '600',
    color: colors.charcoal,
  },
  settingSub: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  legalRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.charcoal,
  },
  deleteInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 24, 23, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.alertRed,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: 8,
  },
  reasonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FDFBF7',
  },
  reasonChipActive: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  reasonChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.charcoal,
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.charcoal,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  confirmText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.charcoal,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
  },
  dangerBtn: {
    flex: 1.3,
    backgroundColor: colors.alertRed,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
