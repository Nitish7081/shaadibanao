import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';
import { apiClient } from '../services/apiClient';
import { getSessionToken, performLogout } from '../services/authSession';
import { getMyProfile, upsertMyProfile } from '../services/profileService';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

export const PrivacySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [hideProfile, setHideProfile] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const [showIncomeBand, setShowIncomeBand] = useState(true);
  const [contactOnlyWithConsent, setContactOnlyWithConsent] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = getSessionToken();
      if (!token) return;
      const res = await getMyProfile(token);
      if (res?.data) {
        setProfileData(res.data);
        if (typeof res.data.showIncomeBand === 'boolean') setShowIncomeBand(res.data.showIncomeBand);
        if (typeof res.data.hideProfile === 'boolean') setHideProfile(res.data.hideProfile);
        if (typeof res.data.showLastSeen === 'boolean') setShowLastSeen(res.data.showLastSeen);
        if (typeof res.data.showOnlineStatus === 'boolean') setShowOnlineStatus(res.data.showOnlineStatus);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    const token = getSessionToken();
    if (!token) {
      Alert.alert('Session Expired', 'Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      if (profileData) {
        await upsertMyProfile(token, {
          ...profileData,
          showIncomeBand,
          hideProfile,
          showLastSeen,
          showOnlineStatus,
        });
      }
      Alert.alert('Settings Saved', 'Your privacy preferences have been updated successfully.');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not update privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = () => {
    if (!profileData) {
      Alert.alert('Data Export', 'No profile data found to export.');
      return;
    }
    const summary = `Name: ${profileData.firstName} ${profileData.lastName || ''}\nGender: ${profileData.gender}\nDOB: ${profileData.dateOfBirth}\nReligion: ${profileData.religion || 'Hindu'}\nCommunity: ${profileData.caste || 'N/A'}\nCity: ${profileData.city || 'N/A'}\nProfession: ${profileData.occupation || 'N/A'}\nIncome Band: ${profileData.annualIncomeBand || 'N/A'}\nVerification: ${profileData.isVerified ? 'Verified' : 'Pending'}`;
    Alert.alert(
      'Your Personal Data Summary (DPDP Act)',
      summary,
      [{ text: 'Done' }]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Permanently Delete Account',
      'Are you sure you want to permanently delete your account and personal data? This action is irreversible. Your profile, photos, active chats, and biodata will be completely removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Deletion',
          style: 'destructive',
          onPress: async () => {
            const token = getSessionToken();
            if (!token) {
              await performLogout();
              navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              return;
            }

            setDeleting(true);
            try {
              await apiClient('/auth/me', {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              await performLogout();
              Alert.alert(
                'Account Deleted',
                'Your account and associated profile data have been permanently removed.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    },
                  },
                ]
              );
            } catch (err: any) {
              Alert.alert('Deletion Failed', err?.message || 'Unable to delete account. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
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

        {/* Save Privacy Settings Button */}
        <Button
          title={saving ? 'Saving Changes...' : 'Save Privacy Settings'}
          onPress={handleSavePrivacy}
          loading={saving}
          disabled={saving}
          variant="primary"
          style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
        />

        {/* Data Rights & Deletion */}
        <Text style={styles.sectionTitle}>Data Rights & Account Control</Text>
        <Card style={styles.card}>
          <Button
            title="Download My Personal Data"
            onPress={handleDownloadData}
            variant="secondary"
            style={{ marginBottom: spacing.md }}
          />
          <Button
            title={deleting ? 'Deleting Account...' : 'Delete Account Permanently'}
            onPress={handleDeleteAccount}
            disabled={deleting}
            variant="text"
            textStyle={{ color: colors.alertRed }}
          />
        </Card>
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
});
