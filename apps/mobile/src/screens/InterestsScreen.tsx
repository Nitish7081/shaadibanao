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

type InterestsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Interests'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: InterestsNavProp;
}

export const InterestsScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'accepted'>('received');

  const receivedInterests = [
    {
      id: 'INT-01',
      name: 'Aarav M.',
      age: 29,
      height: "5'10\"",
      city: 'Gurgaon',
      job: 'Software Architect',
      receivedTime: '1 day ago',
      isVerified: true,
    },
    {
      id: 'INT-02',
      name: 'Kabir T.',
      age: 31,
      height: "5'11\"",
      city: 'Noida',
      job: 'Financial Analyst',
      receivedTime: '3 days ago',
      isVerified: true,
    },
  ];

  const acceptedInterests = [
    {
      id: 'INT-03',
      name: 'Meera R.',
      age: 26,
      height: "5'4\"",
      city: 'Delhi NCR',
      job: 'Civil Architect',
      acceptedTime: '2 hours ago',
      isVerified: true,
    },
  ];

  const handleAccept = (name: string) => {
    Alert.alert(
      'Interest Accepted',
      `You accepted ${name}'s interest! A mutual match has been established. You can now chat and exchange contacts.`
    );
  };

  const handleDecline = (name: string) => {
    Alert.alert('Declined', `Interest from ${name} has been respectfully declined.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Interests & Matches" subtitle="Manage your connections" showStatusBadge={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Interest Transactions: Milestone 5"
          subtext="MongoDB unique compound index (sender, receiver) and state machine (pending/accepted/declined) will be wired in Milestone 5."
        />

        {/* Tab Switcher */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'received' && styles.tabBtnActive]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
              Received (5)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sent' && styles.tabBtnActive]}
            onPress={() => setActiveTab('sent')}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              Sent (8)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'accepted' && styles.tabBtnActive]}
            onPress={() => setActiveTab('accepted')}
          >
            <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
              Accepted (2)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mutual Match Banner (Blueprint S-12) */}
        {activeTab === 'accepted' && (
          <View style={styles.mutualMatchBanner}>
            <Text style={styles.bannerEmoji}>🎉</Text>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Mutual Match with Meera R.</Text>
              <Text style={styles.bannerSub}>
                Both families are interested! You can now start chatting and request contact details.
              </Text>
            </View>
            <Button
              title="Start Chat"
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  conversationId: 'conv-101',
                  partnerName: 'Meera R.',
                })
              }
              variant="primary"
              style={styles.chatNowBtn}
            />
          </View>
        )}

        {/* Received List */}
        {activeTab === 'received' &&
          receivedInterests.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarIcon}>👤</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.personName}>{item.name}, {item.age}</Text>
                  <Text style={styles.metaLine}>{item.height} • {item.city}</Text>
                  <Text style={styles.jobLine}>{item.job}</Text>
                  <Text style={styles.timeLine}>Received {item.receivedTime}</Text>
                </View>
                <Badge label="Verified" variant="verified" />
              </View>

              <View style={styles.buttonGroup}>
                <Button
                  title="Accept"
                  onPress={() => handleAccept(item.name)}
                  variant="primary"
                  style={styles.halfBtn}
                />
                <Button
                  title="Decline"
                  onPress={() => handleDecline(item.name)}
                  variant="secondary"
                  style={styles.halfBtn}
                />
              </View>
            </Card>
          ))}

        {/* Sent Tab Placeholder */}
        {activeTab === 'sent' && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>8 Active Interests Sent</Text>
            <Text style={styles.emptySub}>
              Members usually reply within 48 hours. You can withdraw an interest anytime before
              they accept.
            </Text>
            <Button
              title="Find More Matches"
              onPress={() => navigation.navigate('Search')}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Accepted Tab */}
        {activeTab === 'accepted' &&
          acceptedInterests.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarIcon}>👤</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.personName}>{item.name}, {item.age}</Text>
                  <Text style={styles.metaLine}>{item.height} • {item.city} • {item.job}</Text>
                  <Text style={styles.timeLine}>Accepted {item.acceptedTime}</Text>
                </View>
              </View>
              <Button
                title="Open Conversation"
                onPress={() =>
                  navigation.navigate('ChatDetail', {
                    conversationId: 'conv-101',
                    partnerName: item.name,
                  })
                }
                variant="primary"
                style={{ marginTop: spacing.sm }}
              />
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 3,
    marginBottom: spacing.base,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.royalMaroon,
  },
  tabText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  mutualMatchBanner: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.verifiedGreen,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  bannerEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  bannerTextContainer: {
    marginBottom: spacing.sm,
  },
  bannerTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: '#1B5E20',
  },
  bannerSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    lineHeight: 18,
    marginTop: 2,
  },
  chatNowBtn: {
    minHeight: 40,
    backgroundColor: colors.verifiedGreen,
  },
  itemCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 60,
    height: 70,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 26,
  },
  infoBox: {
    flex: 1,
    marginLeft: spacing.md,
  },
  personName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  metaLine: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  jobLine: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
    marginTop: 1,
  },
  timeLine: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textMuted,
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  halfBtn: {
    flex: 1,
    minHeight: 40,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  emptySub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
