import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export const ProfileDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profileId, name } = route.params;

  const handleSendInterest = () => {
    Alert.alert(
      'Interest Sent',
      `Your interest has been expressed to ${name}. Once accepted, chat and contact sharing will unlock.`
    );
  };

  const handleReport = () => {
    navigation.navigate('ReportBlock', { profileId, name });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={name}
        subtitle={`ID: ${profileId}`}
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        rightAction={
          <TouchableOpacity onPress={handleReport} style={styles.moreBtn}>
            <Text style={styles.moreIcon}>⚠️ Report</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Profile & Privacy Rules: Milestone 5"
          subtext="Contact info is locked behind mutual interest. Identity verification badges strictly follow Blueprint S-11."
        />

        {/* Hero Photo Carousel Card */}
        <View style={styles.photoCarousel}>
          <View style={styles.photoView}>
            <Text style={styles.photoAvatar}>👤</Text>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>1 of 4 Photos</Text>
            </View>
          </View>
        </View>

        {/* Profile Core Header */}
        <Card style={styles.detailsCard}>
          <View style={styles.titleRow}>
            <Text style={styles.profileName}>{name}, 27</Text>
            <Badge label="ID Verified" variant="verified" />
          </View>

          <Text style={styles.headline}>
            5'4" • Delhi NCR • Never Married • Hindi, English
          </Text>

          {/* "Why You Match" Breakdown (Blueprint S-11 Requirement) */}
          <View style={styles.whyMatchBox}>
            <Text style={styles.whyMatchTitle}>Why you match (6 of 7 criteria met)</Text>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Age in your preferred range (24-29 yrs)</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Lives in your preferred city (Delhi NCR)</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Education matches (MBA / Postgraduate)</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Diet & Lifestyle compatible (Vegetarian)</Text>
            </View>
          </View>

          {/* About Section */}
          <Text style={styles.sectionHeading}>About Her</Text>
          <Text style={styles.bodyText}>
            Family-oriented, ambitious, and loves weekend cooking and traveling. Looking for a
            supportive, respectful partner who believes in mutual growth and traditional family values.
          </Text>

          {/* Education & Career */}
          <Text style={styles.sectionHeading}>Education & Profession</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Highest Education:</Text>
            <Text style={styles.detailValue}>MBA in Marketing (Top Tier B-School)</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Profession:</Text>
            <Text style={styles.detailValue}>Product Manager at FinTech MNC</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Annual Income:</Text>
            <Text style={styles.detailValue}>₹20L - ₹30L (Band only)</Text>
          </View>

          {/* Family Details */}
          <Text style={styles.sectionHeading}>Family Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Family Type:</Text>
            <Text style={styles.detailValue}>Nuclear, Moderate values</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Father:</Text>
            <Text style={styles.detailValue}>Retired Chief Engineer (CPWD)</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mother:</Text>
            <Text style={styles.detailValue}>Homemaker</Text>
          </View>

          {/* Blueprint Locked Contact Banner (Rule from Page 14) */}
          <View style={styles.lockedContactCard}>
            <Text style={styles.lockIcon}>🔒</Text>
            <View style={styles.lockTextContainer}>
              <Text style={styles.lockTitle}>Contact Details Locked</Text>
              <Text style={styles.lockDesc}>
                Phone numbers and email addresses are protected by default and only disclosed after
                mutual interest and explicit mutual consent.
              </Text>
            </View>
          </View>
        </Card>

        {/* Sticky Action Footer */}
        <View style={styles.actionRow}>
          <Button
            title="Send Interest"
            onPress={handleSendInterest}
            variant="primary"
            style={styles.mainActionBtn}
          />
          <Button
            title="Save"
            onPress={() => Alert.alert('Saved', 'Profile saved to your bookmarks.')}
            variant="secondary"
            style={styles.saveActionBtn}
          />
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
    paddingBottom: spacing['4xl'],
  },
  moreBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorBg,
    marginRight: spacing.xs,
  },
  moreIcon: {
    fontSize: typography.fontSizes.xs,
    color: colors.alertRed,
    fontWeight: '700',
  },
  photoCarousel: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  photoView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoAvatar: {
    fontSize: 90,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs - 2,
    fontWeight: '600',
  },
  detailsCard: {
    padding: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  profileName: {
    fontSize: typography.fontSizes.xl,
    fontWeight: '700',
    color: colors.charcoal,
  },
  headline: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  whyMatchBox: {
    backgroundColor: '#F3FAF8',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C2E5DD',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  whyMatchTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: colors.deepTeal,
    marginBottom: spacing.sm,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  matchIcon: {
    color: colors.verifiedGreen,
    fontWeight: '800',
    marginRight: spacing.sm,
    fontSize: typography.fontSizes.xs,
  },
  matchText: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
  },
  sectionHeading: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.charcoal,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  lockedContactCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: colors.softGold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  lockTextContainer: {
    flex: 1,
  },
  lockTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: '#8D6E63',
    marginBottom: 2,
  },
  lockDesc: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.charcoal,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  mainActionBtn: {
    flex: 2,
  },
  saveActionBtn: {
    flex: 1,
  },
});
