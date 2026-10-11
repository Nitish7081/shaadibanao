import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const mockDailyMatches = [
    {
      id: 'BS-1043',
      name: 'Priya S.',
      age: 27,
      height: "5'4\"",
      city: 'Delhi NCR',
      profession: 'Product Manager',
      education: 'MBA',
      matchedCount: '6 of 7',
      isVerified: true,
      photoChecked: true,
    },
    {
      id: 'BS-1044',
      name: 'Ananya K.',
      age: 26,
      height: "5'5\"",
      city: 'Gurgaon',
      profession: 'UI/UX Designer',
      education: 'B.Des, NID',
      matchedCount: '5 of 7',
      isVerified: true,
      photoChecked: true,
    },
    {
      id: 'BS-1045',
      name: 'Ritu V.',
      age: 28,
      height: "5'3\"",
      city: 'Noida',
      profession: 'Software Engineer',
      education: 'B.Tech (CS)',
      matchedCount: '7 of 7',
      isVerified: false,
      photoChecked: true,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="BandhanSetu"
        subtitle="Namaste, Rohan"
        showStatusBadge={true}
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.bellBtn}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Discovery & Matching: Milestone 5"
          subtext="Matching algorithms & preferences scoring will link in Milestone 5. Display adheres to Blueprint S-08."
        />

        {/* Profile Completion Bar (Blueprint S-08) */}
        <Card variant="outlined" style={styles.completionCard}>
          <View style={styles.completionTop}>
            <View>
              <Text style={styles.completionTitle}>Profile 72% complete</Text>
              <Text style={styles.completionSub}>Add 2 more photos to reach 90% visibility</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ProfileCreation')}>
              <Text style={styles.editLink}>Complete →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: '72%' }]} />
          </View>
        </Card>

        {/* Activity Counters Grid */}
        <View style={styles.countersRow}>
          <TouchableOpacity
            style={styles.counterCard}
            onPress={() => navigation.navigate('Interests')}
          >
            <Text style={styles.counterNum}>5</Text>
            <Text style={styles.counterLabel}>New Interests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.counterCard}
            onPress={() => navigation.navigate('Interests')}
          >
            <Text style={styles.counterNum}>2</Text>
            <Text style={styles.counterLabel}>Mutual Matches</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.counterCard}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.counterNum}>3</Text>
            <Text style={styles.counterLabel}>Messages</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Search Bar */}
        <TouchableOpacity
          style={styles.searchPill}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.searchPillIcon}>🔍</Text>
          <Text style={styles.searchPillText}>Search by name, ID or city...</Text>
        </TouchableOpacity>

        {/* Today's Matches Deck */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Matches</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.seeAllText}>See all ({mockDailyMatches.length})</Text>
          </TouchableOpacity>
        </View>

        {mockDailyMatches.map((profile) => (
          <TouchableOpacity
            key={profile.id}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ProfileDetail', {
                profileId: profile.id,
                name: profile.name,
              })
            }
          >
            <Card style={styles.profileCard}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarEmoji}>👤</Text>
                  {profile.isVerified && (
                    <View style={styles.verifiedDot}>
                      <Text style={styles.verifiedDotCheck}>✓</Text>
                    </View>
                  )}
                </View>

                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>
                      {profile.name}, {profile.age}
                    </Text>
                  </View>

                  <Text style={styles.profileMeta}>
                    {profile.height} • {profile.city} • {profile.education}
                  </Text>
                  <Text style={styles.profileJob}>{profile.profession}</Text>

                  <View style={styles.badgeRow}>
                    {profile.isVerified && <Badge label="Verified" variant="verified" />}
                    {profile.photoChecked && <Badge label="Photo Checked" variant="photoChecked" />}
                  </View>
                </View>
              </View>

              <View style={styles.matchReasonRow}>
                <Badge
                  label={`${profile.matchedCount} preferences match`}
                  variant="match"
                  icon="🎯"
                />
                <Text style={styles.tapToView}>View Profile →</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* Membership Upgrade Banner (Blueprint S-08 & S-16) */}
        <Card variant="goldAccent" style={styles.upgradeCard}>
          <Text style={styles.upgradeBadge}>PREMIUM MEMBERSHIP</Text>
          <Text style={styles.upgradeTitle}>Connect directly with verified mutual matches</Text>
          <Text style={styles.upgradeDesc}>
            Upgrade to Plus or Premium for priority placement, unlimited interests, and chat unlock.
          </Text>
          <Button
            title="Explore Plans"
            onPress={() => navigation.navigate('Membership')}
            variant="upgrade"
            style={{ marginTop: spacing.md }}
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
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  bellBtn: {
    position: 'relative',
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  bellIcon: {
    fontSize: 20,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.alertRed,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  completionCard: {
    marginBottom: spacing.base,
  },
  completionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  completionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
  },
  completionSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  editLink: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  track: {
    height: 6,
    backgroundColor: colors.warmGrey,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.royalMaroon,
    borderRadius: 3,
  },
  countersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  counterCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  counterNum: {
    fontSize: typography.fontSizes.xl,
    fontWeight: '800',
    color: colors.royalMaroon,
    marginBottom: 2,
  },
  counterLabel: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: spacing.xl,
  },
  searchPillIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchPillText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
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
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  profileCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  avatarPlaceholder: {
    width: 75,
    height: 95,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.verifiedGreen,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedDotCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  profileMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileJob: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  matchReasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  tapToView: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  upgradeCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  upgradeBadge: {
    fontSize: typography.fontSizes.xs - 2,
    fontWeight: '800',
    color: colors.softGold,
    letterSpacing: 1,
    marginBottom: spacing.xxs,
  },
  upgradeTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  upgradeDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
