import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { PaywallModal } from '../components/common/PaywallModal';
import { ds, PressableScale, Skeleton, Chip } from '../design';
import { photoSrc } from '../services/cloudinaryUrl';
import {
  getPublicProfile,
  sendInterest,
  addShortlist,
  getSessionToken,
} from '../services';
import { PublicProfile } from '@bandhansetu/shared';
import { getInitials, formatHeight } from '../components/home/matchPhoto';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export const ProfileDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profileId, name } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestLoading, setInterestLoading] = useState(false);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [isInterestSent, setIsInterestSent] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getSessionToken();
      const res = await getPublicProfile(token, profileId);
      if (res?.data) {
        setProfile(res.data);
      }
    } catch (err: any) {
      if (
        err?.status === 402 ||
        err?.code === 'SUBSCRIPTION_REQUIRED' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('SUBSCRIPTION_REQUIRED') ||
            err.message.includes('paid membership') ||
            err.message.includes('membership plan')))
      ) {
        setShowPaywallModal(true);
      } else {
        setError(err?.message || 'Could not load profile details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [profileId]);

  const handleSendInterest = async () => {
    if (isInterestSent) return;
    setInterestLoading(true);
    try {
      const token = getSessionToken();
      const res = await sendInterest(token, profileId);
      setIsInterestSent(true);
      Alert.alert(
        'Interest Sent 🎉',
        res.message ||
          `Your interest has been expressed to ${profile?.displayName || name}. Once accepted, contact sharing will unlock.`
      );
    } catch (err: any) {
      Alert.alert('Unable to Send Interest', err?.message || 'Could not express interest.');
    } finally {
      setInterestLoading(false);
    }
  };

  const handleShortlist = async () => {
    setShortlistLoading(true);
    try {
      const token = getSessionToken();
      const res = await addShortlist(token, profileId);
      setIsShortlisted(true);
      Alert.alert('Shortlisted', res.message || `${profile?.displayName || name} has been saved to your shortlist.`);
    } catch (err: any) {
      Alert.alert('Shortlist Failed', err?.message || 'Could not add to shortlist.');
    } finally {
      setShortlistLoading(false);
    }
  };

  const handleReport = () => {
    navigation.navigate('ReportBlock', { profileId, name: profile?.displayName || name });
  };

  const displayName = profile?.displayName || name;
  const age = profile?.age || 26;
  const heightStr = profile?.heightCm ? formatHeight(profile.heightCm) : null;
  const city = profile?.city || 'Delhi NCR';
  const state = profile?.state;
  const education = profile?.education || 'Graduate';
  const occupation = profile?.occupation || 'Professional';
  const maritalStatus = profile?.maritalStatus
    ? profile.maritalStatus.replace('_', ' ')
    : 'Never Married';

  const photos = profile?.photos && profile.photos.length > 0 ? profile.photos : [];

  const handleScrollPhoto = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (slide !== activePhotoIndex) {
      setActivePhotoIndex(slide);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <PressableScale
          style={styles.navIconBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={ds.color.maroon} />
        </PressableScale>

        <View style={styles.navTitleCenter}>
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={styles.navTitleText}
          >
            {displayName}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.navSubtitleText}>
            ID: {profileId.substring(0, 12)}
          </Text>
        </View>

        <PressableScale
          style={styles.reportBtn}
          onPress={handleReport}
          accessibilityLabel="Report Profile"
        >
          <Ionicons name="shield-outline" size={16} color="#DC2626" />
          <Text maxFontSizeMultiplier={1.2} style={styles.reportBtnText}>
            Report
          </Text>
        </PressableScale>
      </View>

      {/* Main Content */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.loadingContainer}>
          <Skeleton width={screenWidth - 32} height={320} radius={24} style={{ marginBottom: 16 }} />
          <Skeleton width="60%" height={26} radius={8} style={{ marginBottom: 10 }} />
          <Skeleton width="40%" height={16} radius={6} style={{ marginBottom: 20 }} />
          <Skeleton width={screenWidth - 32} height={120} radius={18} style={{ marginBottom: 16 }} />
          <Skeleton width={screenWidth - 32} height={140} radius={18} />
        </ScrollView>
      ) : showPaywallModal && !profile ? (
        <View style={styles.paywallLockedContainer}>
          <LinearGradient
            colors={['#801026', '#540917']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.paywallCrownCircle}
          >
            <Ionicons name="ribbon" size={34} color="#F9D976" />
          </LinearGradient>
          <Text maxFontSizeMultiplier={1.2} style={styles.paywallLockedTitle}>
            {t('paywall.sheetTitle')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.paywallLockedSub}>
            {t('paywall.sheetSubtitle')}
          </Text>
          <PressableScale
            style={styles.paywallUnlockBtn}
            onPress={() => setShowPaywallModal(true)}
          >
            <LinearGradient
              colors={['#801026', '#540917']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.paywallUnlockGradient}
            >
              <Ionicons name="sparkles" size={16} color="#F9D976" />
              <Text maxFontSizeMultiplier={1.2} style={styles.paywallUnlockBtnText}>
                {t('paywall.explorePlansBtn')}
              </Text>
            </LinearGradient>
          </PressableScale>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
          <Text maxFontSizeMultiplier={1.2} style={styles.errorTitle}>
            Could not load profile
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.errorSub}>
            {error}
          </Text>
          <PressableScale style={styles.retryBtn} onPress={fetchProfile}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text maxFontSizeMultiplier={1.2} style={styles.retryBtnText}>
              Try Again
            </Text>
          </PressableScale>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 100, 110) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Gallery Carousel */}
          <View style={styles.galleryCard}>
            {photos.length > 0 ? (
              <>
                <FlatList
                  data={photos}
                  keyExtractor={(_, index) => `photo-${index}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScrollPhoto}
                  scrollEventThrottle={16}
                  style={{ width: screenWidth - 32 }}
                  renderItem={({ item }) => {
                    const src = photoSrc(item, 'hero');
                    return (
                      <View style={[styles.photoSlide, { width: screenWidth - 32 }]}>
                        <Image
                          source={{ uri: src }}
                          style={styles.heroImage}
                          blurRadius={item.isBlurred ? 14 : 0}
                          resizeMode="cover"
                        />
                        {item.isBlurred && (
                          <View style={styles.blurredOverlayPill}>
                            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                            <Text maxFontSizeMultiplier={1.2} style={styles.blurredOverlayText}>
                              Photo Protected
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  }}
                />

                {/* Photo Counter Pill */}
                <View style={styles.photoCountPill}>
                  <Ionicons name="camera-outline" size={12} color="#FFFFFF" />
                  <Text maxFontSizeMultiplier={1.2} style={styles.photoCountText}>
                    {activePhotoIndex + 1} / {photos.length}
                  </Text>
                </View>
              </>
            ) : (
              <LinearGradient
                colors={['#7A1528', '#A22842']}
                style={[styles.heroImage, styles.fallbackHero]}
              >
                <Text style={styles.fallbackAvatarText}>{getInitials(displayName)}</Text>
                <Text style={styles.fallbackSub}>Photo privacy enabled</Text>
              </LinearGradient>
            )}
          </View>

          {/* Profile Core Header Card */}
          <View style={styles.sectionCard}>
            <View style={styles.coreHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameBadgeRow}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.nameHeadline}>
                    {displayName}, {age}
                  </Text>
                  {profile?.isVerified && (
                    <View style={styles.verifiedChip}>
                      <Ionicons name="shield-checkmark" size={13} color="#166534" />
                      <Text maxFontSizeMultiplier={1.2} style={styles.verifiedChipText}>
                        Verified
                      </Text>
                    </View>
                  )}
                </View>

                <Text maxFontSizeMultiplier={1.2} style={styles.metaSubline}>
                  {heightStr ? `${heightStr} • ` : ''}
                  {city}
                  {state ? `, ${state}` : ''} • {profile?.religion || 'Hindu'}
                  {profile?.caste ? ` (${profile.caste})` : ''}
                </Text>
              </View>
            </View>

            {/* Quick Chips Row */}
            <View style={styles.quickChipsWrap}>
              <View style={styles.infoChip}>
                <Ionicons name="ribbon-outline" size={14} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.infoChipText}>
                  {maritalStatus}
                </Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="language-outline" size={14} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.infoChipText}>
                  {profile?.motherTongue || 'Hindi'}
                </Text>
              </View>
              {profile?.annualIncomeBand && (
                <View style={styles.infoChip}>
                  <Ionicons name="cash-outline" size={14} color={ds.color.goldDeep} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.infoChipText}>
                    {profile.annualIncomeBand}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* About Me Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Ionicons name="person-outline" size={18} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                {t('profileDetail.aboutSection')}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.2} style={styles.bodyParagraph}>
              {profile?.aboutMe ||
                'A warm, family-oriented individual looking for a supportive and life-long Sanatan partner with mutual understanding and traditional values.'}
            </Text>
          </View>

          {/* Education & Career Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Ionicons name="school-outline" size={18} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                {t('profileDetail.educationCareer')}
              </Text>
            </View>

            <View style={styles.rowGrid}>
              <View style={styles.gridItem}>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridLabel}>
                  {t('profileDetail.educationLabel')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridValue}>
                  {education}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridLabel}>
                  {t('profileDetail.occupationLabel')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridValue}>
                  {occupation}
                </Text>
              </View>
            </View>

            {profile?.annualIncomeBand && (
              <View style={[styles.rowGrid, { marginTop: 12 }]}>
                <View style={styles.gridItem}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.gridLabel}>
                    {t('profileDetail.incomeLabel')}
                  </Text>
                  <Text maxFontSizeMultiplier={1.2} style={styles.gridValue}>
                    {profile.annualIncomeBand}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Horoscope & Vedic Details Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Ionicons name="planet-outline" size={18} color={ds.color.goldDeep} />
              <Text maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
                {t('profileDetail.horoscopeSection')}
              </Text>
            </View>

            <View style={styles.rowGrid}>
              <View style={styles.gridItem}>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridLabel}>
                  Religion & Community
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridValue}>
                  {profile?.religion || 'Hindu'}{profile?.caste ? `, ${profile.caste}` : ''}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridLabel}>
                  {t('profileDetail.manglikLabel')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.gridValue}>
                  Non-Manglik
                </Text>
              </View>
            </View>

            <PressableScale
              style={styles.kundliMatchPill}
              onPress={() => navigation.navigate('KundliForm')}
            >
              <Ionicons name="sparkles" size={16} color={ds.color.maroon} />
              <Text maxFontSizeMultiplier={1.2} style={styles.kundliMatchPillText}>
                Check 36 Gunas Vedic Kundli Milan
              </Text>
              <Ionicons name="arrow-forward" size={14} color={ds.color.maroon} />
            </PressableScale>
          </View>

          {/* Contact Details Protected Card */}
          <View style={styles.protectedCard}>
            <View style={styles.protectedHeader}>
              <Ionicons name="lock-closed" size={18} color="#92400E" />
              <Text maxFontSizeMultiplier={1.2} style={styles.protectedTitle}>
                {t('profileDetail.contactProtected')}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.2} style={styles.protectedBody}>
              {t('profileDetail.contactProtectedDesc')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Sticky Bottom Action Bar */}
      {!loading && !error && (
        <View
          style={[
            styles.bottomStickyBar,
            { paddingBottom: Math.max(insets.bottom, ds.space.sm) },
          ]}
        >
          <PressableScale
            style={[styles.shortlistActionBtn, isShortlisted && styles.shortlistedActiveBtn]}
            onPress={handleShortlist}
            disabled={shortlistLoading}
            accessibilityLabel="Shortlist Profile"
          >
            <Ionicons
              name={isShortlisted ? 'heart' : 'heart-outline'}
              size={20}
              color={isShortlisted ? '#DC2626' : ds.color.maroon}
            />
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.shortlistBtnText,
                isShortlisted && styles.shortlistedActiveBtnText,
              ]}
            >
              {isShortlisted
                ? t('profileDetail.shortlisted')
                : t('profileDetail.shortlist')}
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.interestActionBtn, isInterestSent && styles.interestSentBtn]}
            onPress={handleSendInterest}
            disabled={interestLoading || isInterestSent}
            accessibilityLabel="Send Interest"
          >
            <LinearGradient
              colors={
                isInterestSent
                  ? ['#166534', '#15803D']
                  : ['#7A1528', '#9B1D36']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientActionBtn}
            >
              <Ionicons
                name={isInterestSent ? 'checkmark-circle' : 'paper-plane'}
                size={18}
                color="#FFFFFF"
              />
              <Text maxFontSizeMultiplier={1.2} style={styles.interestBtnText}>
                {isInterestSent
                  ? t('profileDetail.interestSent')
                  : t('profileDetail.sendInterest')}
              </Text>
            </LinearGradient>
          </PressableScale>
        </View>
      )}

      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onUpgrade={() => {
          setShowPaywallModal(false);
          navigation.navigate('Membership');
        }}
        targetName={profile?.displayName || name}
      />
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
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: ds.space.sm,
  },
  navTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
  },
  navSubtitleText: {
    fontSize: 11,
    color: ds.color.textMuted,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  reportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingContainer: {
    padding: ds.space.md,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ds.space.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ds.color.text,
    marginTop: ds.space.md,
  },
  errorSub: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: ds.space.lg,
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
  scrollContent: {
    padding: ds.space.md,
  },
  galleryCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.md,
    position: 'relative',
    ...ds.shadow.soft,
  },
  photoSlide: {
    height: 380,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallbackHero: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackAvatarText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
  },
  fallbackSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 8,
  },
  blurredOverlayPill: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  blurredOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  photoCountPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    padding: ds.space.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  coreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameHeadline: {
    fontSize: 21,
    fontWeight: '800',
    color: ds.color.text,
    letterSpacing: -0.3,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  metaSubline: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: ds.space.md,
    paddingTop: ds.space.sm,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ds.color.text,
  },
  sectionHeadingRow: {
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
  bodyParagraph: {
    fontSize: 14,
    color: ds.color.textBody,
    lineHeight: 22,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: ds.space.md,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '600',
    color: ds.color.text,
  },
  kundliMatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: '#EBDCB9',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: ds.space.md,
    gap: 8,
  },
  kundliMatchPillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  protectedCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  protectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  protectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  protectedBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ds.color.surface,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.space.sm,
    ...ds.shadow.soft,
  },
  shortlistActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  shortlistedActiveBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  shortlistBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  shortlistedActiveBtnText: {
    color: '#DC2626',
  },
  interestActionBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  interestSentBtn: {
    opacity: 0.9,
  },
  gradientActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  interestBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paywallLockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ds.space.xl,
  },
  paywallCrownCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C9A24B',
    ...ds.shadow.lift,
  },
  paywallLockedTitle: {
    fontFamily: ds.font.headingBold,
    fontSize: 20,
    color: ds.color.deepMaroon,
    textAlign: 'center',
    marginBottom: 8,
  },
  paywallLockedSub: {
    fontFamily: ds.font.bodyRegular,
    fontSize: 13.5,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  paywallUnlockBtn: {
    width: '100%',
    maxWidth: 280,
  },
  paywallUnlockGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    ...ds.shadow.lift,
  },
  paywallUnlockBtnText: {
    fontFamily: ds.font.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
