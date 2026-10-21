import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';
import {
  getMembershipPlans,
  getMyMembership,
  requestCheckout,
  getSessionToken,
} from '../services';
import { MembershipPlan, UserMembership } from '@bandhansetu/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

export const MembershipScreen: React.FC<Props> = ({ navigation }) => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [myMembership, setMyMembership] = useState<UserMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const token = getSessionToken();

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [plansRes, meRes] = await Promise.all([
        getMembershipPlans(),
        getMyMembership(token).catch(() => null), // Gracefully handle if not authenticated yet
      ]);

      if (plansRes.data) {
        setPlans(plansRes.data);
      }
      if (meRes?.data) {
        setMyMembership(meRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load membership plans. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPlan = async (plan: MembershipPlan) => {
    if (plan.id === 'free') {
      Alert.alert('ShaadiBanao Free', 'You are already enjoying the essential features of ShaadiBanao Free.');
      return;
    }

    setActionLoadingId(plan.id);
    try {
      const res = await requestCheckout(token, plan.id as 'plus' | 'premium');
      const notice = res.data?.notice || 'Payment gateway integration is currently unconfigured.';

      Alert.alert(
        'Payment Gateway Notice 🔒',
        `${notice}\n\nPlan: ${plan.name} (₹${plan.priceInr.toLocaleString('en-IN')})\nPayment Status: Gateway Unconfigured (Testing/Dev Mode).`,
        [{ text: 'Understand & Close' }]
      );
    } catch (err: any) {
      Alert.alert('Checkout Unavailable', err.message || 'Payment system is currently unavailable.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentTier = myMembership?.planId || 'free';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="Membership Plans"
        subtitle="Transparent Pricing. No Auto-Deduction Surprises."
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon]}
          />
        }
      >
        <StatusNotice
          milestoneText="Milestone 7A Membership Plans Active"
          subtext="Server-enforced plan entitlements. Live payment gateway webhooks are safely unconfigured."
        />

        {/* Current Entitlements Overview Card */}
        {myMembership && (
          <Card style={styles.myMembershipCard}>
            <View style={styles.myMembershipHeader}>
              <View>
                <Text style={styles.myPlanLabel}>YOUR ACTIVE PLAN</Text>
                <Text style={styles.myPlanTitle}>{myMembership.planName}</Text>
              </View>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>Active</Text>
              </View>
            </View>

            <View style={styles.quotaRow}>
              <View style={styles.quotaItem}>
                <Text style={styles.quotaNumber}>
                  {myMembership.entitlements.contactDisclosuresRemaining}
                </Text>
                <Text style={styles.quotaLabel}>Contacts Left</Text>
              </View>
              <View style={styles.quotaDivider} />
              <View style={styles.quotaItem}>
                <Text style={styles.quotaNumber}>
                  {myMembership.entitlements.canInitiateChat ? 'Active' : 'Locked'}
                </Text>
                <Text style={styles.quotaLabel}>1-on-1 Chat</Text>
              </View>
              <View style={styles.quotaDivider} />
              <View style={styles.quotaItem}>
                <Text style={styles.quotaNumber}>
                  {myMembership.entitlements.prioritySearchRanking ? 'Top' : 'Normal'}
                </Text>
                <Text style={styles.quotaLabel}>Search Rank</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Loading Indicator */}
        {loading && !refreshing && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.royalMaroon} />
            <Text style={styles.loadingText}>Fetching available plans...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error Loading Plans</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => loadData()}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Dynamic Plans List */}
        {!loading &&
          plans.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const isActing = actionLoadingId === plan.id;

            return (
              <Card
                key={plan.id}
                variant={plan.isPopular ? 'goldAccent' : undefined}
                style={styles.planCard}
              >
                {plan.isPopular && (
                  <View style={styles.badgeTop}>
                    <Text style={styles.badgeTopText}>MOST POPULAR</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planTitle}>{plan.name}</Text>
                    <Text style={styles.planBilling}>{plan.billingCycle}</Text>
                  </View>
                  <Text style={styles.priceTag}>
                    {plan.priceInr === 0 ? '₹0' : `₹${plan.priceInr.toLocaleString('en-IN')}`}
                  </Text>
                </View>

                <Text style={styles.planSub}>{plan.tagline}</Text>

                <View style={styles.featuresList}>
                  {plan.features.map((feature, idx) => (
                    <Text key={idx} style={styles.featureItem}>
                      ✓ {feature}
                    </Text>
                  ))}
                </View>

                {isCurrent ? (
                  <Button
                    title="Current Active Plan"
                    onPress={() => {}}
                    variant="secondary"
                    disabled={true}
                    style={styles.planBtn}
                  />
                ) : (
                  <Button
                    title={
                      isActing
                        ? 'Connecting...'
                        : plan.id === 'free'
                        ? 'Select Plan'
                        : `Upgrade to ${plan.tier === 'plus' ? 'Plus' : 'Premium'}`
                    }
                    onPress={() => handleSelectPlan(plan)}
                    loading={isActing}
                    variant={plan.tier === 'premium' ? 'upgrade' : 'primary'}
                    style={styles.planBtn}
                  />
                )}
              </Card>
            );
          })}

        {/* Terms & Payment Security Notice */}
        <View style={styles.securityNote}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Payments are currently disabled pending production payment gateway integration.
            Subscribing will require official gateway signature verification. No hidden charges or
            auto-deductions.
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
    padding: spacing.base,
    paddingBottom: 60,
  },
  centerBox: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  errorCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.alertRed,
  },
  errorSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  myMembershipCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: '#FAF5EE',
    borderColor: colors.softGold,
    borderWidth: 1.5,
  },
  myMembershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  myPlanLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.royalMaroon,
  },
  myPlanTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 1,
  },
  activeTag: {
    backgroundColor: colors.verifiedGreen,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  activeTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  quotaItem: {
    alignItems: 'center',
  },
  quotaNumber: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  quotaLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quotaDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderDefault,
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
    alignItems: 'flex-start',
    marginBottom: spacing.xxs,
  },
  planTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.charcoal,
  },
  planBilling: {
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    marginTop: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  securityText: {
    flex: 1,
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
