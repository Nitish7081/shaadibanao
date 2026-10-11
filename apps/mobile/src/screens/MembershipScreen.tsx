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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

export const MembershipScreen: React.FC<Props> = ({ navigation }) => {
  const [duration, setDuration] = useState<'3' | '12'>('3');

  const handleSelectPlan = (tier: string) => {
    Alert.alert(
      `${tier} Plan Selected`,
      `Payment gateway integration is scheduled for Milestone 7 with server-side webhook signature verification.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Membership Plans"
        subtitle="Transparent Pricing. No Auto-Deduction Surprises."
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Payment & Subscriptions: Milestone 7"
          subtext="Payment verification is handled strictly server-side with gateway webhooks. Client never self-certifies payment."
        />

        {/* Duration Selector */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, duration === '3' && styles.toggleBtnActive]}
            onPress={() => setDuration('3')}
          >
            <Text style={[styles.toggleText, duration === '3' && styles.toggleTextActive]}>
              3 Months Plan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, duration === '12' && styles.toggleBtnActive]}
            onPress={() => setDuration('12')}
          >
            <Text style={[styles.toggleText, duration === '12' && styles.toggleTextActive]}>
              12 Months (Best Value)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Free Plan Card */}
        <Card style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Free Plan</Text>
            <Text style={styles.priceTag}>₹0</Text>
          </View>
          <Text style={styles.planSub}>Essential features for creating your profile</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ Create and manage verified profile</Text>
            <Text style={styles.featureItem}>✓ Search & view profiles with privacy controls</Text>
            <Text style={styles.featureItem}>✓ Receive & respond to unlimited interests</Text>
            <Text style={styles.featureItem}>✓ Send up to 5 interests per month</Text>
          </View>
          <Button
            title="Current Active Plan"
            onPress={() => {}}
            variant="secondary"
            disabled={true}
            style={styles.planBtn}
          />
        </Card>

        {/* Plus Plan Card */}
        <Card variant="goldAccent" style={styles.planCard}>
          <View style={styles.badgeTop}>
            <Text style={styles.badgeTopText}>MOST POPULAR</Text>
          </View>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Bandhan Plus</Text>
            <Text style={styles.priceTag}>{duration === '3' ? '₹2,999' : '₹5,999'}</Text>
          </View>
          <Text style={styles.planSub}>Unlocks unlimited direct communication</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ Everything in Free Plan</Text>
            <Text style={styles.featureItem}>✓ Unlimited Interests to all members</Text>
            <Text style={styles.featureItem}>✓ Direct 1-on-1 Chat with mutual matches</Text>
            <Text style={styles.featureItem}>✓ See who viewed your profile</Text>
            <Text style={styles.featureItem}>✓ Priority customer support</Text>
          </View>
          <Button
            title="Choose Plus Plan"
            onPress={() => handleSelectPlan('Bandhan Plus')}
            variant="primary"
            style={styles.planBtn}
          />
        </Card>

        {/* Premium Plan Card */}
        <Card style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Bandhan Premium</Text>
            <Text style={styles.priceTag}>{duration === '3' ? '₹4,999' : '₹9,999'}</Text>
          </View>
          <Text style={styles.planSub}>Maximum visibility and dedicated matchmaker review</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ Everything in Plus Plan</Text>
            <Text style={styles.featureItem}>✓ Top placement in search results</Text>
            <Text style={styles.featureItem}>✓ Gold Profile Highlight Badge</Text>
            <Text style={styles.featureItem}>✓ Assisted relationship advisor guidance</Text>
            <Text style={styles.featureItem}>✓ Kundli matching reports included</Text>
          </View>
          <Button
            title="Choose Premium Plan"
            onPress={() => handleSelectPlan('Bandhan Premium')}
            variant="upgrade"
            style={styles.planBtn}
          />
        </Card>

        {/* Terms & Payment Security Notice */}
        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🔒 100% Secure Payment via UPI, Cards & Net Banking. Clear GST invoices provided.
            Subscription details and cancellation terms are transparently displayed before payment.
          </Text>
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 3,
    marginBottom: spacing.xl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.royalMaroon,
  },
  toggleText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  planCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  badgeTop: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: colors.softGold,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeTopText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  planTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.charcoal,
  },
  priceTag: {
    fontSize: typography.fontSizes.xl,
    fontWeight: '800',
    color: colors.royalMaroon,
  },
  planSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  featuresList: {
    marginBottom: spacing.xl,
  },
  featureItem: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    marginVertical: 4,
    lineHeight: 18,
  },
  planBtn: {
    width: '100%',
  },
  securityNote: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  securityText: {
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
