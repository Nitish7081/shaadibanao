import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

export const PrivacySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [hideProfile, setHideProfile] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const [showIncomeBand, setShowIncomeBand] = useState(true);
  const [contactOnlyWithConsent, setContactOnlyWithConsent] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const handleDownloadData = () => {
    Alert.alert(
      'Download Data Request',
      'Under the Digital Personal Data Protection Act, your complete profile and interaction history archive will be compiled and sent to your registered email address.'
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? Your profile, photos, and active chats will be purged. (Legal transaction logs are archived in accordance with statutory regulations).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Deletion',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Closed', 'You have been signed out.');
            navigation.navigate('Welcome');
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
          milestoneText="Consent & Data Protection: Milestone 4"
          subtext="Server-side consent tracking and audit logs will be connected in Milestone 4."
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
            title="Delete Account Permanently"
            onPress={handleDeleteAccount}
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
