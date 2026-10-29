import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale, Skeleton } from '../design';
import {
  getMembershipPlans,
  getMyMembership,
  requestCheckout,
  getSessionToken,
} from '../services';
import { MembershipPlan, UserMembership } from '@bandhansetu/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

export const MembershipScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

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
        getMyMembership(token).catch(() => null),
      ]);

      if (plansRes?.data) {
        setPlans(plansRes.data);
      }
      if (meRes?.data) {
        setMyMembership(meRes.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load membership plans. Please try again.');
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
      Alert.alert(
        'ShaadiBanao Free',
        'You are already enjoying the essential features of ShaadiBanao Free.'
      );
      return;
    }

    setActionLoadingId(plan.id);
    try {
      const res = await requestCheckout(token, plan.id as 'plus' | 'premium');
      const notice = res?.data?.notice || 'Payment gateway integration is currently in testing mode.';

      Alert.alert(
        'Payment Notice 🔒',
        `${notice}\n\nPlan: ${plan.name} (₹${plan.priceInr.toLocaleString('en-IN')})\nPayment Status: Unconfigured Gateway (Testing Mode).`,
        [{ text: 'Understand & Close' }]
      );
    } catch (err: any) {
      Alert.alert('Checkout Notice', err?.message || 'Payment system is currently unavailable.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentTier = myMembership?.planId || 'free';

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>

        <View style={styles.headerTitlesCol}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenHeading}
          >
            {t('membershipScreen.headerTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('membershipScreen.headerSubtitle')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
      >
        {/* Loading state */}
        {loading && !refreshing ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={120} radius={20} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={280} radius={22} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={280} radius={22} />
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Ionicons name="alert-circle-outline" size={38} color="#DC2626" />
            <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
              Error Loading Plans
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.stateSub}>
              {error}
            </Text>
            <PressableScale style={styles.retryBtn} onPress={() => loadData()}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text maxFontSizeMultiplier={1.2} style={styles.retryBtnText}>
                Try Again
              </Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* Current Active Plan Overview Card */}
            {myMembership && (
              <View style={styles.myMembershipCard}>
                <View style={styles.myMembershipHeader}>
                  <View>
                    <Text maxFontSizeMultiplier={1.2} style={styles.myPlanLabel}>
                      {t('membershipScreen.activePlanLabel')}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.myPlanTitle}>
                      {myMembership.planName}
                    </Text>
                  </View>
                  <View style={styles.activeTag}>
                    <Ionicons name="checkmark-circle" size={12} color="#166534" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.activeTagText}>
                      {t('membershipScreen.activeTag')}
                    </Text>
                  </View>
                </View>

                <View style={styles.quotaRow}>
                  <View style={styles.quotaItem}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaNumber}>
                      {myMembership.entitlements.contactDisclosuresRemaining}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaLabel}>
                      {t('membershipScreen.contactsLeft')}
                    </Text>
                  </View>

                  <View style={styles.quotaDivider} />

                  <View style={styles.quotaItem}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaNumber}>
                      {myMembership.entitlements.canInitiateChat ? 'Active' : 'Locked'}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaLabel}>
                      {t('membershipScreen.chatStatus')}
                    </Text>
                  </View>

                  <View style={styles.quotaDivider} />

                  <View style={styles.quotaItem}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaNumber}>
                      {myMembership.entitlements.prioritySearchRanking ? 'Top' : 'Normal'}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.quotaLabel}>
                      {t('membershipScreen.searchRanking')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Plans List */}
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.id;
              const isPopular = plan.isPopular;
              const isActing = actionLoadingId === plan.id;

              return (
                <View
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isPopular && styles.planCardPopular,
                    isCurrent && styles.planCardCurrent,
                  ]}
                >
                  {/* Popular or Tier Pill */}
                  {plan.badgeText && (
                    <View style={styles.badgePill}>
                      <Ionicons name="sparkles" size={11} color="#854D0E" />
                      <Text maxFontSizeMultiplier={1.2} style={styles.badgePillText}>
                        {plan.badgeText}
                      </Text>
                    </View>
                  )}

                  <View style={styles.planHeader}>
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={1.2} style={styles.planName}>
                        {plan.name}
                      </Text>
                      <Text maxFontSizeMultiplier={1.2} style={styles.planTagline}>
                        {plan.tagline}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text maxFontSizeMultiplier={1.2} style={styles.priceNumber}>
                        {plan.priceInr === 0
                          ? '₹0'
                          : `₹${plan.priceInr.toLocaleString('en-IN')}`}
                      </Text>
                      <Text maxFontSizeMultiplier={1.2} style={styles.billingCycle}>
                        {plan.billingCycle}
                      </Text>
                    </View>
                  </View>

                  {/* Feature Checklist */}
                  <View style={styles.featureList}>
                    {plan.features.map((feat, fIdx) => (
                      <View key={fIdx} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={17} color={ds.color.maroon} />
                        <Text maxFontSizeMultiplier={1.2} style={styles.featureText}>
                          {feat}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Button */}
                  <PressableScale
                    style={[
                      styles.planActionBtn,
                      isCurrent && styles.planActionBtnCurrent,
                      isActing && styles.planActionBtnDisabled,
                    ]}
                    onPress={() => handleSelectPlan(plan)}
                    disabled={isCurrent || isActing}
                  >
                    {isCurrent ? (
                      <View style={styles.currentBtnInner}>
                        <Ionicons name="checkmark" size={16} color={ds.color.maroon} />
                        <Text maxFontSizeMultiplier={1.2} style={styles.currentBtnText}>
                          {t('membershipScreen.currentPlanBtn')}
                        </Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={
                          isPopular
                            ? ['#7A1528', '#9B1D36']
                            : ['#8A2035', '#A22842']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.upgradeBtnGradient}
                      >
                        {isActing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="ribbon-outline" size={16} color="#FFFFFF" />
                            <Text maxFontSizeMultiplier={1.2} style={styles.upgradeBtnText}>
                              {t('membershipScreen.upgradeToPlan', { plan: plan.name })}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    )}
                  </PressableScale>
                </View>
              );
            })}

            {/* Transparency Guarantee Card */}
            <View style={styles.guaranteeCard}>
              <View style={styles.guaranteeHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#166534" />
                <Text maxFontSizeMultiplier={1.2} style={styles.guaranteeTitle}>
                  {t('membershipScreen.guaranteeTitle')}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.2} style={styles.guaranteeBody}>
                {t('membershipScreen.guaranteeBody')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...ds.shadow.soft,
  },
  headerTitlesCol: {
    flex: 1,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: ds.space.md,
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
  stateContainer: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.xl,
    alignItems: 'center',
    marginTop: ds.space.lg,
    ...ds.shadow.soft,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ds.color.text,
    marginTop: ds.space.sm,
    marginBottom: 6,
  },
  stateSub: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: ds.space.lg,
    paddingHorizontal: ds.space.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 10,
    paddingHorizontal: ds.space.lg,
    borderRadius: 12,
    gap: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  myMembershipCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBDCB9',
    padding: ds.space.lg,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  myMembershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: ds.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  myPlanLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ds.color.textMuted,
    letterSpacing: 0.5,
  },
  myPlanTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ds.color.maroon,
    marginTop: 2,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: ds.space.md,
  },
  quotaItem: {
    alignItems: 'center',
    flex: 1,
  },
  quotaNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: ds.color.maroon,
  },
  quotaLabel: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  quotaDivider: {
    width: 1,
    height: 32,
    backgroundColor: ds.color.border,
  },
  planCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.lg,
    marginBottom: ds.space.md,
    position: 'relative',
    ...ds.shadow.soft,
  },
  planCardPopular: {
    borderColor: '#D4AF37',
    borderWidth: 1.5,
  },
  planCardCurrent: {
    borderColor: '#86EFAC',
  },
  badgePill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: ds.space.md,
    paddingRight: 60,
  },
  planName: {
    fontSize: 19,
    fontWeight: '800',
    color: ds.color.text,
  },
  planTagline: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  priceNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.maroon,
  },
  billingCycle: {
    fontSize: 11,
    color: ds.color.textMuted,
  },
  featureList: {
    gap: 10,
    marginBottom: ds.space.lg,
    paddingTop: ds.space.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: ds.color.textBody,
    flex: 1,
    lineHeight: 18,
  },
  planActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  planActionBtnCurrent: {
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  planActionBtnDisabled: {
    opacity: 0.7,
  },
  currentBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  currentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  upgradeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  guaranteeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: ds.space.md,
    marginTop: ds.space.xs,
    marginBottom: ds.space.md,
  },
  guaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  guaranteeBody: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 18,
  },
});
