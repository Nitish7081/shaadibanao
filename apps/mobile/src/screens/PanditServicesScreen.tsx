import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ds, PressableScale, Skeleton } from '../design';
import { PanditProfile } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';
import { getInitials } from '../components/home/matchPhoto';

export const PanditServicesScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [pandits, setPandits] = useState<PanditProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCeremony, setSelectedCeremony] = useState<string>(
    route?.params?.ceremonyType || 'all'
  );

  useEffect(() => {
    if (route?.params?.ceremonyType) {
      setSelectedCeremony(route?.params?.ceremonyType);
    }
  }, [route?.params?.ceremonyType]);

  const ceremonies = [
    { key: 'all', title: t('panditServices.allCeremonies'), icon: 'sparkles' as const },
    { key: 'wedding', title: t('panditServices.wedding'), icon: 'heart' as const },
    { key: 'griha_pravesh', title: t('panditServices.grihaPravesh'), icon: 'home' as const },
    { key: 'satyanarayan_puja', title: t('panditServices.satyanarayan'), icon: 'book' as const },
    { key: 'rudrabhishek', title: t('panditServices.rudrabhishek'), icon: 'flame' as const },
    { key: 'kundli_milan', title: t('panditServices.kundliMilan'), icon: 'planet' as const },
  ];

  useEffect(() => {
    fetchPandits();
  }, [selectedCeremony]);

  const fetchPandits = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const headers = await getAuthHeader();
      const ceremonyParam = selectedCeremony !== 'all' ? `?ceremonyType=${selectedCeremony}` : '';
      const res = await fetch(`${API_BASE}/pandits${ceremonyParam}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setPandits(json.data.items || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Top Bar */}
      <View style={styles.headerTopRow}>
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
            {t('panditServices.headerTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('panditServices.headerSubtitle')}
          </Text>
        </View>

        <PressableScale
          style={styles.myBookingsBtn}
          onPress={() => navigation.navigate('MyBookings')}
          accessibilityLabel="My Bookings"
        >
          <Ionicons name="calendar-outline" size={15} color={ds.color.maroon} />
          <Text maxFontSizeMultiplier={1.2} style={styles.myBookingsBtnText}>
            {t('panditServices.myBookings')}
          </Text>
        </PressableScale>
      </View>

      {/* Direct Booking Request Banner */}
      <View style={styles.directBookingBanner}>
        <View style={styles.directBookingLeft}>
          <Text maxFontSizeMultiplier={1.2} style={styles.directBannerTitle}>
            {t('panditServices.directBookingCardTitle')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.directBannerSub}>
            {t('panditServices.directBookingCardSub')}
          </Text>
        </View>

        <PressableScale
          style={styles.directBookingActionBtn}
          onPress={() => navigation.navigate('PanditBookingRequest')}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.directBookingActionText}>
            Request
          </Text>
          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
        </PressableScale>
      </View>

      {/* Ceremonies Horizontal Filter Bar */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={ceremonies}
        keyExtractor={(c) => c.key}
        contentContainerStyle={styles.ceremoniesScroll}
        renderItem={({ item }) => {
          const isSelected = selectedCeremony === item.key;
          return (
            <PressableScale
              style={[styles.ceremonyChip, isSelected && styles.ceremonyChipActive]}
              onPress={() => setSelectedCeremony(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : ds.color.maroon}
              />
              <Text
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.ceremonyChipText,
                  isSelected && styles.ceremonyChipTextActive,
                ]}
              >
                {item.title}
              </Text>
            </PressableScale>
          );
        }}
      />
    </View>
  );

  const renderPanditCard = ({ item }: { item: PanditProfile }) => {
    const mainService = (item.services || [])[0];
    const initials = getInitials(item.name);

    return (
      <View style={styles.panditCard}>
        {/* Pandit Header */}
        <View style={styles.panditHeaderRow}>
          <LinearGradient
            colors={['#7A1528', '#A22842']}
            style={styles.avatarCircle}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.avatarText}>
              {initials || 'P'}
            </Text>
          </LinearGradient>

          <View style={styles.panditInfoCol}>
            <View style={styles.nameRow}>
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.panditNameText}
              >
                {item.name}
              </Text>
              <View style={styles.verifiedIconWrap}>
                <Ionicons name="shield-checkmark" size={12} color="#166534" />
              </View>
            </View>

            <Text maxFontSizeMultiplier={1.2} style={styles.traditionText}>
              {item.religiousTradition || 'Vedic Sanatan Tradition'}
            </Text>

            <Text maxFontSizeMultiplier={1.2} style={styles.expLangText}>
              {t('panditServices.experienceYears', { years: item.experienceYears })} •{' '}
              {item.languages?.slice(0, 2).join(', ')}
            </Text>
          </View>

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#854D0E" />
            <Text maxFontSizeMultiplier={1.2} style={styles.ratingText}>
              {item.rating ? item.rating.toFixed(1) : '5.0'}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {item.bio ? (
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={2}
            style={styles.bioText}
          >
            {item.bio}
          </Text>
        ) : null}

        {/* Featured Service Box */}
        {mainService && (
          <View style={styles.servicePreviewBox}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.serviceNameText}
              >
                {mainService.name}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.serviceDurationText}>
                {mainService.durationMinutes} Mins • Vedic Rituals
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text maxFontSizeMultiplier={1.2} style={styles.servicePriceText}>
                ₹{mainService.priceInr.toLocaleString('en-IN')}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.servicePriceSub}>
                {t('panditServices.transparentFee')}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActionsRow}>
          <PressableScale
            style={styles.detailsBtn}
            onPress={() =>
              navigation.navigate('PanditDetail', {
                panditId: item.id,
                panditName: item.name,
              })
            }
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.detailsBtnText}>
              {t('panditServices.viewDetails')}
            </Text>
          </PressableScale>

          <PressableScale
            style={styles.bookBtn}
            onPress={() =>
              navigation.navigate('BookingFlow', {
                panditId: item.id,
                serviceId: mainService?.serviceId || 'srv_default',
                serviceName: mainService?.name || 'Ceremony Consultation',
                priceInr: mainService?.priceInr || 2100,
              })
            }
          >
            <LinearGradient
              colors={['#7A1528', '#9B1D36']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookBtnGradient}
            >
              <Ionicons name="calendar" size={14} color="#FFFFFF" />
              <Text maxFontSizeMultiplier={1.2} style={styles.bookBtnText}>
                {t('panditServices.bookPandit')}
              </Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    );
  };

  const renderEmptyOrLoading = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={52} height={52} radius={26} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Skeleton width="60%" height={16} radius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="40%" height={12} radius={4} />
                </View>
              </View>
              <Skeleton width="100%" height={50} radius={12} style={{ marginTop: 14 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <Skeleton width="48%" height={40} radius={12} />
                <Skeleton width="48%" height={40} radius={12} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={['#FFF6E8', '#FFEECF']}
          style={styles.emptyIconCircle}
        >
          <Ionicons name="flower-outline" size={36} color={ds.color.maroon} />
        </LinearGradient>
        <Text maxFontSizeMultiplier={1.2} style={styles.emptyTitle}>
          {t('panditServices.noPanditsFound')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.emptySubtitle}>
          {t('panditServices.noPanditsSub')}
        </Text>
        <PressableScale
          style={styles.emptyActionBtn}
          onPress={() => navigation.navigate('PanditBookingRequest')}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.emptyActionBtnText}>
            {t('panditServices.directBookingBtn')}
          </Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={loading && !refreshing ? [] : pandits}
        keyExtractor={(p) => p.id}
        renderItem={renderPanditCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyOrLoading}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPandits(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  listContent: {
    paddingHorizontal: ds.space.md,
  },
  headerBlock: {
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ds.space.md,
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
    marginTop: 1,
  },
  myBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  myBookingsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  directBookingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  directBookingLeft: {
    flex: 1,
    paddingRight: ds.space.sm,
  },
  directBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  directBannerSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  directBookingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  directBookingActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  ceremoniesScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  ceremonyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.border,
    gap: 6,
  },
  ceremonyChipActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  ceremonyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  ceremonyChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  panditCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  panditHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  panditInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  panditNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
  },
  verifiedIconWrap: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    padding: 2,
  },
  traditionText: {
    fontSize: 12,
    color: ds.color.maroon,
    fontWeight: '600',
    marginTop: 1,
  },
  expLangText: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  bioText: {
    fontSize: 13,
    color: ds.color.textBody,
    lineHeight: 19,
    marginTop: 10,
  },
  servicePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: 10,
    marginTop: 12,
  },
  serviceNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.text,
  },
  serviceDurationText: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  servicePriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: ds.color.maroon,
  },
  servicePriceSub: {
    fontSize: 10,
    color: ds.color.textMuted,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.space.sm,
    marginTop: 12,
    paddingTop: ds.space.sm,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
  },
  detailsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.maroon,
  },
  bookBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bookBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
  skeletonCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  emptyContainer: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.xl,
    alignItems: 'center',
    marginTop: ds.space.lg,
    ...ds.shadow.soft,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: ds.space.lg,
    paddingHorizontal: ds.space.md,
  },
  emptyActionBtn: {
    backgroundColor: ds.color.maroon,
    paddingVertical: 11,
    paddingHorizontal: ds.space.lg,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
