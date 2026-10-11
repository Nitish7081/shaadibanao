import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type SearchNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: SearchNavProp;
}

export const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filterChips = [
    { id: 'all', label: 'All Matches' },
    { id: 'verified', label: '✓ Verified Only' },
    { id: 'delhi', label: 'Delhi NCR' },
    { id: 'age24_28', label: 'Age 24-28' },
    { id: 'engineer', label: 'Tech & Engineers' },
  ];

  const searchResults = [
    {
      id: 'BS-2001',
      name: 'Priya S.',
      age: 27,
      height: "5'4\"",
      city: 'Delhi NCR',
      education: 'MBA',
      job: 'Product Manager',
      matched: '6 of 7',
      isVerified: true,
      photoChecked: true,
    },
    {
      id: 'BS-2002',
      name: 'Ananya K.',
      age: 26,
      height: "5'5\"",
      city: 'Gurgaon',
      education: 'B.Des',
      job: 'UX Designer',
      matched: '6 of 7',
      isVerified: true,
      photoChecked: true,
    },
    {
      id: 'BS-2003',
      name: 'Sneha M.',
      age: 28,
      height: "5'3\"",
      city: 'Noida',
      education: 'MS Analytics',
      job: 'Data Scientist',
      matched: '5 of 7',
      isVerified: false,
      photoChecked: true,
    },
  ];

  const handleSendInterest = (name: string) => {
    Alert.alert(
      'Interest Sent',
      `Your interest has been conveyed to ${name}. You will be notified when they accept. (Milestone 5 will persist real backend state).`
    );
  };

  const handleShortlist = (name: string) => {
    Alert.alert('Shortlisted', `${name} has been added to your shortlist.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Search & Discover" subtitle="128 Profiles Found" showStatusBadge={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Search Filters & Ranking: Milestone 5"
          subtext="Server-side compound queries, geocoding filters, and preference scoring will be wired in Milestone 5."
        />

        {/* Filter Chips Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {filterChips.map((chip) => {
            const isSelected = selectedFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setSelectedFilter(chip.id)}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              >
                <Text
                  style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort & Count Header */}
        <View style={styles.resultsMeta}>
          <Text style={styles.countText}>Showing 3 of 128 verified profiles</Text>
          <Text style={styles.sortText}>Sort: Best Match ▾</Text>
        </View>

        {/* Results List */}
        {searchResults.map((item) => (
          <Card key={item.id} style={styles.resultCard}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ProfileDetail', {
                  profileId: item.id,
                  name: item.name,
                })
              }
              activeOpacity={0.85}
              style={styles.cardHeader}
            >
              <View style={styles.photoContainer}>
                <Text style={styles.photoPlaceholder}>👤</Text>
                {item.isVerified && (
                  <View style={styles.verifiedDot}>
                    <Text style={styles.verifiedCheck}>✓</Text>
                  </View>
                )}
              </View>

              <View style={styles.profileTextInfo}>
                <Text style={styles.profileName}>
                  {item.name}, {item.age}
                </Text>
                <Text style={styles.profileMeta}>
                  {item.height} • {item.city}
                </Text>
                <Text style={styles.profileEducation}>
                  {item.education} • {item.job}
                </Text>

                <View style={styles.badgeRow}>
                  {item.isVerified && <Badge label="ID Verified" variant="verified" />}
                  {item.photoChecked && <Badge label="Photo Checked" variant="photoChecked" />}
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.matchReasonContainer}>
              <Badge label={`${item.matched} preferences match`} variant="match" icon="🎯" />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <Button
                title="Send Interest"
                onPress={() => handleSendInterest(item.name)}
                variant="primary"
                style={styles.actionBtn}
              />
              <Button
                title="Shortlist"
                onPress={() => handleShortlist(item.name)}
                variant="secondary"
                style={styles.actionBtn}
              />
            </View>
          </Card>
        ))}
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
  chipsScroll: {
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
  },
  filterChipSelected: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  filterChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  countText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  sortText: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
  resultCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  photoContainer: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoPlaceholder: {
    fontSize: 34,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.verifiedGreen,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedCheck: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  profileTextInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
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
  profileEducation: {
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
  matchReasonContainer: {
    marginVertical: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
});
