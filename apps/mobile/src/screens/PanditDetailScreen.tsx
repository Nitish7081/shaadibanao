import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  BackHandler,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { PanditChatEntitlementSummary } from '@bandhansetu/shared';
import { ds, PressableScale, AnimatedPage } from '../design';
import {
  API_BASE,
  getSessionToken,
  getPanditDetail,
  getPanditChatEligibility,
  getAuthorizedPanditWhatsapp,
  getPlayBillingCatalog,
  purchasePanditConsultationProduct,
  getSessionUserId,
  getOrCreateConversation,
} from '../services';
import { getInitials } from '../components/home/matchPhoto';

export const PanditDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { panditId, panditName } = route.params || {};
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [pandit, setPandit] = useState<any>(null);
  const [entitlement, setEntitlement] = useState<PanditChatEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPanditDetails = useCallback(async () => {
    try {
      const token = getSessionToken();
      if (token) {
        const [detailRes, entRes] = await Promise.allSettled([
          getPanditDetail(panditId),
          getPanditChatEligibility(panditId),
        ]);
        if (detailRes.status === 'fulfilled' && detailRes.value?.data) {
          setPandit(detailRes.value.data);
          if (detailRes.value.data.entitlement) {
            setEntitlement(detailRes.value.data.entitlement);
          }
        }
        if (entRes.status === 'fulfilled' && entRes.value?.data) {
          setEntitlement(entRes.value.data);
        }
      } else {
        const res = await fetch(`${API_BASE}/pandits/${panditId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setPandit(json.data);
        }
      }
    } catch {
      // fallback handled below
    } finally {
      setLoading(false);
    }
  }, [panditId]);

  useEffect(() => {
    fetchPanditDetails();
  }, [fetchPanditDetails]);

  const p = pandit || {
    name: panditName || 'Vedic Pandit Ji',
    religiousTradition: 'Vedic Sanatan Tradition',
    experienceYears: 10,
    languages: ['Hindi', 'Sanskrit', 'English'],
    serviceLocations: ['Delhi NCR', 'Online Video Consultation'],
    bio: 'Dedicated Vedic scholar and purohit conducting weddings, Satyanarayan Katha, Griha Pravesh, and comprehensive astrological consultations.',
    services: [
      {
        serviceId: 'srv_vivah',
        name: 'Vedic Wedding Ceremony (Vivah Sanskar)',
        priceInr: 15100,
        durationMinutes: 240,
        description: 'Complete Vedic vivah rituals including Kanyadaan, Saptapadi, and Havan.',
      },
      {
        serviceId: 'srv_kundli',
        name: 'Kundli Milan & Consultation',
        priceInr: 1100,
        durationMinutes: 45,
        description: 'In-depth 36 Guna analysis and Muhurat selection.',
      },
    ],
  };

  const initials = getInitials(p.name);

  const handleSafeBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleSafeBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  const handlePayConsultation = async () => {
    const token = getSessionToken();
    const userId = getSessionUserId();
    if (!token || !userId) {
      navigation.navigate('LoginOtp');
      return;
    }
    setActionLoading(true);
    try {
      const catalogRes = await getPlayBillingCatalog().catch(() => null);
      const catalog = catalogRes?.data;
      const targetPanditId = p.id || panditId;

      Alert.alert(
        t('chatScreen.unlockPanditChatTitle'),
        `Unlock consultation chat with ${p.name} via Google Play or activate a Plus/Premium subscription?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Membership Plans',
            onPress: () => navigation.navigate('Membership'),
          },
          {
            text: 'Unlock via Google Play',
            onPress: async () => {
              try {
                if (!catalog) {
                  Alert.alert('Billing Unavailable', 'Unable to load Google Play Billing catalog.');
                  return;
                }
                const outcome = await purchasePanditConsultationProduct({
                  accessToken: token,
                  userId,
                  panditId: targetPanditId,
                  catalog,
                });
                if (outcome.status === 'purchased') {
                  if (outcome.verification?.panditEntitlement) {
                    setEntitlement(outcome.verification.panditEntitlement);
                  }
                  Alert.alert('Unlocked ✓', 'Personal consultation access is now active!');
                  await fetchPanditDetails();
                } else if (outcome.status === 'pending') {
                  Alert.alert('Payment Pending', outcome.message);
                } else if (outcome.status === 'blocked') {
                  Alert.alert('Play Billing Setup Pending', outcome.message);
                } else if (outcome.status !== 'cancelled') {
                  Alert.alert('Verification Failed', outcome.message);
                }
              } catch (err: any) {
                Alert.alert('Verification Failed', err?.message || 'Unable to verify Google Play purchase.');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Consultation Notice', err?.message || 'Unable to initiate Google Play Billing.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartPanditChat = async () => {
    const token = getSessionToken();
    if (!token) {
      navigation.navigate('LoginOtp');
      return;
    }

    if (entitlement?.requiresPayment) {
      await handlePayConsultation();
      return;
    }

    setActionLoading(true);
    try {
      const convRes = await getOrCreateConversation(token, p.userId || panditId, {
        category: 'pandit_consultation',
        panditId: p.id || panditId,
      });
      if (convRes?.data?.entitlement) {
        setEntitlement(convRes.data.entitlement);
      }
      if (convRes?.data?.id) {
        navigation.navigate('ChatDetail', {
          conversationId: convRes.data.id,
          partnerName: p.name,
          partnerId: p.userId,
          category: 'pandit_consultation',
          panditId: p.id || panditId,
        });
      }
    } catch (err: any) {
      if (err?.status === 402 || err?.code === 'PANDIT_CHAT_PAYMENT_REQUIRED') {
        await handlePayConsultation();
      } else {
        Alert.alert('Chat Unavailable', err?.message || 'Unable to open consultation chat.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenWhatsapp = async () => {
    const token = getSessionToken();
    if (!token) {
      navigation.navigate('LoginOtp');
      return;
    }
    setActionLoading(true);
    try {
      const res = await getAuthorizedPanditWhatsapp(p.id || panditId);
      if (res?.data?.whatsappUrl) {
        await Linking.openURL(res.data.whatsappUrl);
      }
    } catch (err: any) {
      Alert.alert(
        'WhatsApp Protected',
        err?.message || t('panditServices.whatsappLockedNote')
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <PressableScale
          style={styles.backBtn}
          onPress={handleSafeBack}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          style={styles.navTitle}
        >
          {p.name}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ds.color.maroon} />
          <Text maxFontSizeMultiplier={1.2} style={styles.loadingText}>
            Loading Pandit profile...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <AnimatedPage duration={300}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {p.profilePhoto ? (
              <Image source={{ uri: p.profilePhoto }} style={styles.avatarCircle} />
            ) : (
              <LinearGradient
                colors={['#7A1528', '#A22842']}
                style={styles.avatarCircle}
              >
                <Text maxFontSizeMultiplier={1.2} style={styles.avatarText}>
                  {initials || 'P'}
                </Text>
              </LinearGradient>
            )}

            <Text maxFontSizeMultiplier={1.2} style={styles.nameHeadline}>
              {p.name}
            </Text>

            <View style={styles.verifiedRow}>
              <Ionicons name="shield-checkmark" size={14} color="#166534" />
              <Text maxFontSizeMultiplier={1.2} style={styles.verifiedText}>
                Certified Vedic Purohit & Astrologer
              </Text>
            </View>

            <Text maxFontSizeMultiplier={1.2} style={styles.traditionSub}>
              {p.religiousTradition}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="star" size={13} color="#D97706" />
                <Text maxFontSizeMultiplier={1.2} style={styles.metaChipText}>
                  {(p.rating ? Number(p.rating).toFixed(1) : '5.0')} ★ ({p.reviewsCount || 0})
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons
                  name="ellipse"
                  size={10}
                  color={p.isOnline !== false ? '#10B981' : '#94A3B8'}
                />
                <Text maxFontSizeMultiplier={1.2} style={styles.metaChipText}>
                  {p.isOnline !== false
                    ? t('panditServices.onlineNow')
                    : t('panditServices.currentlyOffline')}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="ribbon-outline" size={13} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.metaChipText}>
                  {p.experienceYears} Years Experience
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="language-outline" size={13} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.metaChipText}>
                  {p.languages?.join(', ')}
                </Text>
              </View>
            </View>
          </View>

          {/* Consultation Chat & Authorized WhatsApp Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="chatbubbles-outline" size={18} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                Personal Consultation & Guidance
              </Text>
            </View>

            <View
              style={[
                styles.entitlementBanner,
                entitlement?.paidAccessActive
                  ? styles.entitlementPaid
                  : entitlement?.requiresPayment
                  ? styles.entitlementLocked
                  : styles.entitlementFree,
              ]}
            >
              <Ionicons
                name={
                  entitlement?.paidAccessActive
                    ? 'shield-checkmark'
                    : entitlement?.requiresPayment
                    ? 'lock-closed'
                    : 'sparkles'
                }
                size={15}
                color={
                  entitlement?.paidAccessActive
                    ? '#166534'
                    : entitlement?.requiresPayment
                    ? '#991B1B'
                    : '#92400E'
                }
              />
              <Text maxFontSizeMultiplier={1.2} style={styles.entitlementText}>
                {entitlement?.paidAccessActive
                  ? t('chatScreen.panditPaidActive')
                  : entitlement?.requiresPayment
                  ? t('chatScreen.panditFreeIntroUsed')
                  : t('chatScreen.panditFreeIntroAvailable')}
              </Text>
            </View>

            <View style={styles.consultActionsRow}>
              <PressableScale
                style={[styles.chatPrimaryBtn, actionLoading && { opacity: 0.7 }]}
                onPress={handleStartPanditChat}
                disabled={actionLoading}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.chatPrimaryBtnText}>
                  {entitlement?.paidAccessActive
                    ? t('panditServices.continueChatBtn')
                    : entitlement?.requiresPayment
                    ? t('panditServices.unlockChatBtn')
                    : t('panditServices.freeIntroChatBtn')}
                </Text>
              </PressableScale>

              {entitlement?.whatsappAuthorized && (
                <PressableScale
                  style={[styles.whatsappBtn, actionLoading && { opacity: 0.7 }]}
                  onPress={handleOpenWhatsapp}
                  disabled={actionLoading}
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                  <Text maxFontSizeMultiplier={1.2} style={styles.whatsappBtnText}>
                    {t('panditServices.whatsappContactBtn')}
                  </Text>
                </PressableScale>
              )}
            </View>

            {entitlement?.whatsappAvailable && !entitlement?.whatsappAuthorized && (
              <Text maxFontSizeMultiplier={1.2} style={styles.whatsappLockedHint}>
                🔒 {t('panditServices.whatsappLockedNote')}
              </Text>
            )}
          </View>

          {/* About Pandit Ji */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-outline" size={18} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                {t('panditServices.aboutPandit')}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.2} style={styles.bioBody}>
              {p.bio}
            </Text>
          </View>

          {/* Ceremony Services & Pricing */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="flame-outline" size={18} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                {t('panditServices.ceremoniesAndPricing')}
              </Text>
            </View>

            {(p.services || []).map((s: any, idx: number) => (
              <View
                key={s.serviceId || idx}
                style={[
                  styles.serviceCard,
                  idx < p.services.length - 1 && styles.serviceCardBorder,
                ]}
              >
                <View style={styles.serviceTopRow}>
                  <Text
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={2}
                    style={styles.serviceName}
                  >
                    {s.name}
                  </Text>
                  <Text maxFontSizeMultiplier={1.2} style={styles.servicePrice}>
                    ₹{(s.priceInr || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                {s.description ? (
                  <Text maxFontSizeMultiplier={1.2} style={styles.serviceDesc}>
                    {s.description}
                  </Text>
                ) : null}

                <View style={styles.serviceBottomRow}>
                  <View style={styles.durationChip}>
                    <Ionicons name="time-outline" size={13} color={ds.color.textMuted} />
                    <Text maxFontSizeMultiplier={1.2} style={styles.durationChipText}>
                      {s.durationMinutes} Minutes Ritual
                    </Text>
                  </View>

                  <PressableScale
                    style={styles.bookActionBtn}
                    onPress={() =>
                      navigation.navigate('BookingFlow', {
                        panditId,
                        serviceId: s.serviceId,
                        serviceName: s.name,
                        priceInr: s.priceInr,
                      })
                    }
                  >
                    <Text maxFontSizeMultiplier={1.2} style={styles.bookActionBtnText}>
                      {t('panditServices.bookNow')}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                  </PressableScale>
                </View>
              </View>
            ))}
          </View>
          </AnimatedPage>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: ds.space.sm,
    fontSize: 13,
    color: ds.color.textMuted,
  },
  scrollContent: {
    padding: ds.space.md,
  },
  profileCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.lg,
    alignItems: 'center',
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.sm,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  nameHeadline: {
    fontSize: 19,
    fontWeight: '800',
    color: ds.color.text,
    marginBottom: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
    marginBottom: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  traditionSub: {
    fontSize: 13,
    color: ds.color.maroon,
    fontWeight: '600',
    marginBottom: ds.space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  metaChipText: {
    fontSize: 12,
    color: ds.color.text,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.lg,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: ds.space.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  bioBody: {
    fontSize: 14,
    color: ds.color.textBody,
    lineHeight: 22,
  },
  serviceCard: {
    paddingVertical: ds.space.md,
  },
  serviceCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  serviceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  serviceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.text,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: ds.color.maroon,
  },
  serviceDesc: {
    fontSize: 13,
    color: ds.color.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  serviceBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ds.space.sm,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationChipText: {
    fontSize: 12,
    color: ds.color.textMuted,
  },
  bookActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  bookActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  entitlementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  entitlementFree: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  entitlementPaid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  entitlementLocked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  entitlementText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.text,
  },
  consultActionsRow: {
    gap: 10,
  },
  chatPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
  },
  chatPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  whatsappLockedHint: {
    marginTop: 10,
    fontSize: 12,
    color: ds.color.textMuted,
    lineHeight: 17,
  },
});
