import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const notifications = [
    {
      id: 'notif-1',
      title: 'New Interest Received',
      body: 'Aarav M. expressed interest in your profile.',
      time: '2 mins ago',
      unread: true,
      type: 'interest',
      screen: 'MainTabs' as const,
    },
    {
      id: 'notif-2',
      title: 'Interest Accepted!',
      body: 'Priya S. accepted your interest. You can now chat.',
      time: '1 hour ago',
      unread: true,
      type: 'match',
      screen: 'MainTabs' as const,
    },
    {
      id: 'notif-3',
      title: 'New Message',
      body: 'Meera R. sent you a new message: "Namaste Rohan..."',
      time: '3 hours ago',
      unread: true,
      type: 'message',
      screen: 'MainTabs' as const,
    },
    {
      id: 'notif-4',
      title: 'ID Verification Approved',
      body: 'Your photo and profile review has been approved. The Verified Badge is now active.',
      time: 'Yesterday',
      unread: false,
      type: 'account',
      screen: 'MainTabs' as const,
    },
    {
      id: 'notif-5',
      title: 'Daily Recommendations',
      body: '3 new matches align with your partner preferences today.',
      time: 'Yesterday',
      unread: false,
      type: 'matches',
      screen: 'MainTabs' as const,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle="Recent activity and safety alerts"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Notification Dispatch: Milestone 6"
          subtext="Expo Push Notifications, SMS alerts, and server event channels will be connected in Milestone 6."
        />

        {notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Card
              style={[
                styles.notifCard,
                item.unread ? styles.unreadCard : styles.readCard,
              ]}
            >
              <View style={styles.notifRow}>
                <View
                  style={[
                    styles.notifDot,
                    item.unread ? styles.notifDotUnread : styles.notifDotRead,
                  ]}
                />
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifBody}>{item.body}</Text>
                  <Text style={styles.notifTime}>{item.time}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
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
  notifCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: colors.royalMaroon,
  },
  readCard: {
    backgroundColor: colors.surfaceCard,
    opacity: 0.85,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  notifDotUnread: {
    backgroundColor: colors.royalMaroon,
  },
  notifDotRead: {
    backgroundColor: 'transparent',
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
  },
  notifBody: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
