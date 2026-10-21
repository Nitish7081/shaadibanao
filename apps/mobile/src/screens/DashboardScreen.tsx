import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Button } from '../components/common/Button';
import { BackendStatusBadge } from '../components/common/BackendStatusBadge';

interface DashboardScreenProps {
  mobile: string;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ mobile, onLogout }) => {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetingText}>Namaste,</Text>
          <Text style={styles.userMobile}>+91 {mobile || '98XXXXXXXX'}</Text>
        </View>
        <BackendStatusBadge />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Completion Card (Blueprint S-08) */}
        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionTitle}>Profile 72% complete</Text>
            <Text style={styles.completionSub}>Add 2 more photos to reach 90%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={styles.progressBarFill} />
          </View>
        </View>

        {/* Real-time Activity Counters */}
        <View style={styles.countersRow}>
          <View style={styles.counterCard}>
            <Text style={styles.counterNumber}>5</Text>
            <Text style={styles.counterLabel}>New Interests</Text>
          </View>
          <View style={styles.counterCard}>
            <Text style={styles.counterNumber}>2</Text>
            <Text style={styles.counterLabel}>Mutual Matches</Text>
          </View>
          <View style={styles.counterCard}>
            <Text style={styles.counterNumber}>3</Text>
            <Text style={styles.counterLabel}>Messages</Text>
          </View>
        </View>

        {/* Today's Matches Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's matches</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* Mock Match Preview Card */}
        <View style={styles.matchCard}>
          <View style={styles.matchPhotoPlaceholder}>
            <Text style={styles.matchPhotoIcon}>👤</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
            </View>
          </View>
          <View style={styles.matchDetails}>
            <Text style={styles.matchName}>Priya S., 27</Text>
            <Text style={styles.matchMeta}>5'4" • Delhi NCR • MBA</Text>
            <Text style={styles.matchRole}>Product Manager</Text>
            <View style={styles.matchReasonChip}>
              <Text style={styles.matchReasonText}>6 of 7 preferences match</Text>
            </View>
          </View>
        </View>

        {/* Membership Banner (Blueprint S-08 & S-16) */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planBadge}>FREE PLAN</Text>
              <Text style={styles.planTitle}>Upgrade to unlock direct messaging</Text>
            </View>
          </View>
          <Button
            title="View Membership Plans"
            onPress={() => {}}
            variant="upgrade"
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Session Actions */}
        <Button
          title="Sign Out"
          onPress={onLogout}
          variant="secondary"
          style={{ marginTop: spacing.lg }}
        />
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  greetingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  userMobile: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  completionCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  completionHeader: {
    marginBottom: spacing.sm,
  },
  completionTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  completionSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.warmGrey,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '72%',
    height: '100%',
    backgroundColor: colors.royalMaroon,
    borderRadius: 4,
  },
  countersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  counterCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  counterNumber: {
    fontSize: typography.fontSizes.xl,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 2,
  },
  counterLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.charcoal,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  matchPhotoPlaceholder: {
    width: 90,
    height: 110,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.warmGrey,
  },
  matchPhotoIcon: {
    fontSize: 40,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: colors.verifiedGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  matchDetails: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  matchName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  matchMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  matchRole: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
    marginTop: 2,
  },
  matchReasonChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  matchReasonText: {
    fontSize: typography.fontSizes.xs,
    color: colors.deepTeal,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.softGold,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planBadge: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '800',
    color: colors.softGold,
    letterSpacing: 1,
  },
  planTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.charcoal,
    marginTop: spacing.xxs,
  },
});
