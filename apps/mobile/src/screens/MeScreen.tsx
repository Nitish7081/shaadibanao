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
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

type MeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Me'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: MeNavProp;
}

export const MeScreen: React.FC<Props> = ({ navigation }) => {
  const menuItems = [
    {
      title: 'Edit Full Matrimonial Profile',
      subtitle: 'Manage bio, career, family & preferences',
      icon: '📝',
      onPress: () => navigation.navigate('ProfileCreation'),
    },
    {
      title: 'Privacy & Visibility Settings',
      subtitle: 'Control who sees photos, phone & income',
      icon: '🔒',
      onPress: () => navigation.navigate('PrivacySettings'),
    },
    {
      title: 'Membership & Subscriptions',
      subtitle: 'View plans, invoice history & entitlements',
      icon: '👑',
      onPress: () => navigation.navigate('Membership'),
    },
    {
      title: 'Notification Preferences',
      subtitle: 'Configure daily match emails & push alerts',
      icon: '🔔',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      title: 'Help & Customer Care',
      subtitle: 'Dedicated matrimonial relationship support',
      icon: '💬',
      onPress: () =>
        Alert.alert(
          'Customer Support',
          'BandhanSetu Support is available Monday - Saturday, 9am - 7pm IST at support@bandhansetu.in.'
        ),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Account" subtitle="Rohan Sharma" showStatusBadge={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Quick Card */}
        <Card style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>Rohan Sharma, 28</Text>
              <Text style={styles.userSub}>Member ID: BS-098231</Text>
              <View style={styles.badgeRow}>
                <Badge label="Mobile Verified" variant="verified" />
                <Badge label="Free Tier" variant="gold" />
              </View>
            </View>
          </View>
        </Card>

        {/* Menu Items List */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.menuRow,
                idx < menuItems.length - 1 && styles.menuRowBorder,
              ]}
              onPress={item.onPress}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSub}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out of BandhanSetu"
          onPress={() => {
            Alert.alert('Signed Out', 'You have been safely signed out.', [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Welcome'),
              },
            ]);
          }}
          variant="secondary"
          style={styles.logoutBtn}
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  userCard: {
    padding: spacing.lg,
    marginBottom: spacing.base,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.softGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  userSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginVertical: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.charcoal,
  },
  menuSub: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
  },
  logoutBtn: {
    marginTop: spacing.sm,
  },
});
