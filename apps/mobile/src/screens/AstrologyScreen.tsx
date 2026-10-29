import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RASHI_LIST, NAKSHATRA_LIST, KundliMatchingResult } from '@bandhansetu/shared';
import { ds, PressableScale, Skeleton } from '../design';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const AstrologyScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'kundli' | 'matching'>(
    route?.params?.initialTab || 'kundli'
  );

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route?.params?.initialTab);
    }
  }, [route?.params?.initialTab]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [kundli, setKundli] = useState<any>(null);

  // Matchmaking State
  const [boyRashi, setBoyRashi] = useState<string>(RASHI_LIST[0]);
  const [boyNakshatra, setBoyNakshatra] = useState<string>(NAKSHATRA_LIST[0]);
  const [girlRashi, setGirlRashi] = useState<string>(RASHI_LIST[4]);
  const [girlNakshatra, setGirlNakshatra] = useState<string>(NAKSHATRA_LIST[9]);
  const [boyManglik, setBoyManglik] = useState(false);
  const [girlManglik, setGirlManglik] = useState(false);
  const [matchingResult, setMatchingResult] = useState<KundliMatchingResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchMyKundli();
  }, []);

  const fetchMyKundli = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/astrology/kundli/me`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setKundli(json.data);
      }
    } catch {
      // offline / mock fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCalculateMatch = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`${API_BASE}/astrology/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boyRashi,
          boyNakshatra,
          girlRashi,
          girlNakshatra,
          boyManglik,
          girlManglik,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMatchingResult(json.data);
      } else {
        Alert.alert('Notice', json.error?.message || 'Could not calculate compatibility');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and retry.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={styles.screenHeading}
            >
              {t('astrologyScreen.headerTitle')}
            </Text>
            <Text
              maxFontSizeMultiplier={1.2}
              style={styles.screenSubheading}
            >
              {t('astrologyScreen.headerSubtitle')}
            </Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.segmentedContainer}>
          <PressableScale
            style={[styles.segmentTab, activeTab === 'kundli' && styles.segmentTabActive]}
            onPress={() => setActiveTab('kundli')}
          >
            <Ionicons
              name="planet-outline"
              size={15}
              color={activeTab === 'kundli' ? ds.color.maroon : ds.color.textMuted}
            />
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.segmentLabel,
                activeTab === 'kundli' && styles.segmentLabelActive,
              ]}
            >
              {t('astrologyScreen.tabMyKundli')}
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.segmentTab, activeTab === 'matching' && styles.segmentTabActive]}
            onPress={() => setActiveTab('matching')}
          >
            <Ionicons
              name="sparkles-outline"
              size={15}
              color={activeTab === 'matching' ? ds.color.maroon : ds.color.textMuted}
            />
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.segmentLabel,
                activeTab === 'matching' && styles.segmentLabelActive,
              ]}
            >
              {t('astrologyScreen.tabKundliMilan')}
            </Text>
          </PressableScale>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMyKundli(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
      >
        {activeTab === 'kundli' ? (
          <View>
            {loading && !refreshing ? (
              <View style={styles.skeletonContainer}>
                <Skeleton width="100%" height={260} radius={20} style={{ marginBottom: 14 }} />
                <Skeleton width="100%" height={120} radius={20} />
              </View>
            ) : kundli ? (
              <>
                {/* Birth Chart Card */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.chartTitleRow}>
                      <Ionicons name="planet" size={18} color={ds.color.maroon} />
                      <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle}>
                        {t('astrologyScreen.birthChartTitle')}
                      </Text>
                    </View>
                    <View style={styles.visibilityTag}>
                      <Text maxFontSizeMultiplier={1.2} style={styles.visibilityTagText}>
                        {(kundli.visibility || 'Matches Only').replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.dobLabel')}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaVal}>
                      {new Date(kundli.dateOfBirth).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.timeLabel')}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaVal}>
                      {kundli.timeOfBirth}{' '}
                      {kundli.isApproximateTime ? '(Approx)' : '(Exact)'}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.placeLabel')}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaVal}>
                      {kundli.birthPlace?.name || 'Delhi NCR'}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.rashiLabel')}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.metaVal, { fontWeight: '700', color: ds.color.maroon }]}
                    >
                      {kundli.rashi}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.nakshatraLabel')}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaVal}>
                      {kundli.nakshatra} (Charan {kundli.charan || 1})
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.metaLabel}>
                      {t('astrologyScreen.manglikLabel')}
                    </Text>
                    <View
                      style={[
                        styles.manglikPill,
                        kundli.manglikStatus === 'manglik'
                          ? styles.manglikPillAlert
                          : styles.manglikPillSuccess,
                      ]}
                    >
                      <Text
                        maxFontSizeMultiplier={1.2}
                        style={[
                          styles.manglikPillText,
                          kundli.manglikStatus === 'manglik'
                            ? styles.manglikTextAlert
                            : styles.manglikTextSuccess,
                        ]}
                      >
                        {(kundli.manglikStatus || 'non_manglik').replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <PressableScale
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('KundliForm')}
                  >
                    <Ionicons name="create-outline" size={15} color={ds.color.maroon} />
                    <Text maxFontSizeMultiplier={1.2} style={styles.editBtnText}>
                      {t('astrologyScreen.editKundliBtn')}
                    </Text>
                  </PressableScale>
                </View>

                {/* Consult Pandit Guidance Card */}
                <View style={styles.guidanceCard}>
                  <View style={styles.guidanceHeader}>
                    <Ionicons name="sparkles" size={18} color="#92400E" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.guidanceTitle}>
                      {t('astrologyScreen.consultPanditTitle')}
                    </Text>
                  </View>
                  <Text maxFontSizeMultiplier={1.2} style={styles.guidanceBody}>
                    {t('astrologyScreen.consultPanditBody')}
                  </Text>
                  <PressableScale
                    style={styles.consultPanditBtn}
                    onPress={() => navigation.navigate('PanditServices')}
                  >
                    <Text maxFontSizeMultiplier={1.2} style={styles.consultPanditBtnText}>
                      {t('astrologyScreen.bookPanditConsult')}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </PressableScale>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={['#FFF6E8', '#FFEECF']}
                  style={styles.emptyIconCircle}
                >
                  <Ionicons name="planet-outline" size={36} color={ds.color.maroon} />
                </LinearGradient>
                <Text maxFontSizeMultiplier={1.2} style={styles.emptyTitle}>
                  {t('astrologyScreen.noKundliTitle')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.emptySubtitle}>
                  {t('astrologyScreen.noKundliSub')}
                </Text>
                <PressableScale
                  style={styles.createKundliBtn}
                  onPress={() => navigation.navigate('KundliForm')}
                >
                  <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                  <Text maxFontSizeMultiplier={1.2} style={styles.createKundliBtnText}>
                    {t('astrologyScreen.createKundliBtn')}
                  </Text>
                </PressableScale>
              </View>
            )}
          </View>
        ) : (
          <View>
            {/* Groom Details Card */}
            <View style={styles.card}>
              <View style={styles.partyHeaderRow}>
                <Ionicons name="male" size={16} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.partyHeading}>
                  {t('astrologyScreen.boyDetails')}
                </Text>
              </View>

              <Text maxFontSizeMultiplier={1.2} style={styles.selectLabel}>
                Rashi (Moon Sign)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {RASHI_LIST.slice(0, 8).map((r) => (
                  <PressableScale
                    key={r}
                    style={[styles.smallChip, boyRashi === r && styles.smallChipActive]}
                    onPress={() => setBoyRashi(r)}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.smallChipText, boyRashi === r && styles.smallChipTextActive]}
                    >
                      {r}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>

              <Text maxFontSizeMultiplier={1.2} style={[styles.selectLabel, { marginTop: 10 }]}>
                Nakshatra
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {NAKSHATRA_LIST.slice(0, 8).map((n) => (
                  <PressableScale
                    key={n}
                    style={[styles.smallChip, boyNakshatra === n && styles.smallChipActive]}
                    onPress={() => setBoyNakshatra(n)}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.smallChipText, boyNakshatra === n && styles.smallChipTextActive]}
                    >
                      {n}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>

            {/* Bride Details Card */}
            <View style={styles.card}>
              <View style={styles.partyHeaderRow}>
                <Ionicons name="female" size={16} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.partyHeading}>
                  {t('astrologyScreen.girlDetails')}
                </Text>
              </View>

              <Text maxFontSizeMultiplier={1.2} style={styles.selectLabel}>
                Rashi (Moon Sign)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {RASHI_LIST.slice(0, 8).map((r) => (
                  <PressableScale
                    key={r}
                    style={[styles.smallChip, girlRashi === r && styles.smallChipActive]}
                    onPress={() => setGirlRashi(r)}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.smallChipText, girlRashi === r && styles.smallChipTextActive]}
                    >
                      {r}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>

              <Text maxFontSizeMultiplier={1.2} style={[styles.selectLabel, { marginTop: 10 }]}>
                Nakshatra
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {NAKSHATRA_LIST.slice(0, 8).map((n) => (
                  <PressableScale
                    key={n}
                    style={[styles.smallChip, girlNakshatra === n && styles.smallChipActive]}
                    onPress={() => setGirlNakshatra(n)}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.smallChipText, girlNakshatra === n && styles.smallChipTextActive]}
                    >
                      {n}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>

            {/* Calculate Button */}
            <PressableScale
              style={[styles.calculateBtn, calculating && styles.calculateBtnDisabled]}
              onPress={handleCalculateMatch}
              disabled={calculating}
            >
              <LinearGradient
                colors={['#7A1528', '#9B1D36']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.calcGradient}
              >
                {calculating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.calcBtnText}>
                      {t('astrologyScreen.calculateMatchBtn')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>

            {/* Results Display */}
            {matchingResult && (
              <View style={[styles.card, { marginTop: ds.space.md }]}>
                <View style={styles.scoreRow}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.scoreHeadline}>
                    {t('astrologyScreen.scoreTitle', { score: matchingResult.totalScore })}
                  </Text>
                  <View
                    style={[
                      styles.verdictChip,
                      matchingResult.totalScore >= 18
                        ? styles.verdictChipGood
                        : styles.verdictChipLow,
                    ]}
                  >
                    <Text maxFontSizeMultiplier={1.2} style={styles.verdictChipText}>
                      {matchingResult.compatibilityVerdict || (matchingResult.totalScore >= 18 ? 'Compatible Match' : 'Remedies Needed')}
                    </Text>
                  </View>
                </View>

                {matchingResult.manglikAnalysis?.summary ? (
                  <View style={styles.manglikSummaryBox}>
                    <Ionicons name="shield-outline" size={14} color="#92400E" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.manglikSummaryText}>
                      {matchingResult.manglikAnalysis.summary}
                    </Text>
                  </View>
                ) : null}

                {/* Ashta Koota Breakdown */}
                <Text maxFontSizeMultiplier={1.2} style={styles.breakdownHeader}>
                  {t('astrologyScreen.breakdownTitle')}
                </Text>
                {matchingResult.breakdown?.map((k, idx) => (
                  <View key={k.kootaName || idx} style={styles.kootaRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.kootaName}>
                      {k.kootaName} ({k.sanskritName})
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.kootaScore}>
                      {k.obtainedPoints} / {k.maxPoints}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
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
  headerBlock: {
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  headerTopRow: {
    marginBottom: ds.space.md,
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: ds.color.surface,
    ...ds.shadow.soft,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
  segmentLabelActive: {
    color: ds.color.maroon,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: ds.space.md,
  },
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: ds.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
    marginBottom: ds.space.sm,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.text,
  },
  visibilityTag: {
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  visibilityTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: ds.color.maroon,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFE4',
  },
  metaLabel: {
    fontSize: 13,
    color: ds.color.textMuted,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  manglikPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  manglikPillSuccess: {
    backgroundColor: '#DCFCE7',
  },
  manglikPillAlert: {
    backgroundColor: '#FEE2E2',
  },
  manglikPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  manglikTextSuccess: {
    color: '#166534',
  },
  manglikTextAlert: {
    color: '#DC2626',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderRadius: 12,
    paddingVertical: 9,
    marginTop: ds.space.md,
    gap: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  guidanceCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  guidanceBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
    marginBottom: ds.space.md,
  },
  consultPanditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 12,
    paddingVertical: 9,
    gap: 6,
  },
  consultPanditBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  createKundliBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 11,
    paddingHorizontal: ds.space.lg,
    borderRadius: 14,
    gap: 6,
  },
  createKundliBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  partyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  partyHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  selectLabel: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 4,
  },
  smallChip: {
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  smallChipText: {
    fontSize: 12,
    color: ds.color.text,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calculateBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  calculateBtnDisabled: {
    opacity: 0.7,
  },
  calcGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  calcBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: ds.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
    marginBottom: ds.space.sm,
  },
  scoreHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: ds.color.maroon,
  },
  verdictChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verdictChipGood: {
    backgroundColor: '#DCFCE7',
  },
  verdictChipLow: {
    backgroundColor: '#FEF3C7',
  },
  verdictChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  breakdownHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 8,
  },
  manglikSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 10,
    gap: 6,
    marginBottom: 10,
  },
  manglikSummaryText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  kootaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kootaName: {
    fontSize: 13,
    color: ds.color.textMuted,
  },
  kootaScore: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.text,
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
});
