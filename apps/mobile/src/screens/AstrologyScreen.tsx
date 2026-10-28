import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { RASHI_LIST, NAKSHATRA_LIST, KundliMatchingResult } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const AstrologyScreen: React.FC<any> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState<'kundli' | 'matching'>(
    route?.params?.initialTab || 'kundli'
  );

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route?.params?.initialTab);
    }
  }, [route?.params?.initialTab]);

  const [loading, setLoading] = useState(false);
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

  const fetchMyKundli = async () => {
    setLoading(true);
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
        Alert.alert('Error', json.error?.message || 'Could not calculate compatibility');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vedic Astrology & Kundli</Text>
        <Text style={styles.headerSubtitle}>Authentic 36 Guna Milan & Vedic Guidance</Text>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'kundli' && styles.tabButtonActive]}
            onPress={() => setActiveTab('kundli')}
          >
            <Text style={[styles.tabText, activeTab === 'kundli' && styles.tabTextActive]}>My Kundli</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'matching' && styles.tabButtonActive]}
            onPress={() => setActiveTab('matching')}
          >
            <Text style={[styles.tabText, activeTab === 'matching' && styles.tabTextActive]}>Kundli Milan (36 Gunas)</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'kundli' ? (
          <View>
            {loading ? (
              <ActivityIndicator size="large" color={colors.royalMaroon} style={{ marginTop: 40 }} />
            ) : kundli ? (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Vedic Birth Chart</Text>
                  <View style={styles.badgeTag}>
                    <Text style={styles.badgeTagText}>{kundli.visibility?.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date of Birth:</Text>
                  <Text style={styles.metaVal}>{new Date(kundli.dateOfBirth).toLocaleDateString('en-IN')}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Birth Time:</Text>
                  <Text style={styles.metaVal}>{kundli.timeOfBirth} {kundli.isApproximateTime ? '(Approx)' : '(Exact)'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Birth Place:</Text>
                  <Text style={styles.metaVal}>{kundli.birthPlace?.name || 'Delhi NCR'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Moon Sign (Rashi):</Text>
                  <Text style={[styles.metaVal, { fontWeight: '700', color: colors.royalMaroon }]}>{kundli.rashi}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Nakshatra:</Text>
                  <Text style={styles.metaVal}>{kundli.nakshatra} (Charan {kundli.charan || 1})</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Manglik Status:</Text>
                  <Text style={[styles.metaVal, { color: kundli.manglikStatus === 'manglik' ? colors.alertRed : colors.verifiedGreen }]}>
                    {kundli.manglikStatus?.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="planet-outline" size={54} color={colors.softGold} />
                <Text style={styles.emptyTitle}>Kundli Profile Not Created</Text>
                <Text style={styles.emptyDesc}>Enter your exact birth time, place, and rashi to generate your Vedic horoscope and unlock authentic matchmaking.</Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('KundliForm')}
                >
                  <Text style={styles.primaryBtnText}>+ Create Kundli Profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Pandit Consultation Card */}
            <View style={[styles.card, { marginTop: 16, backgroundColor: '#FAF6ED', borderColor: colors.softGold }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="sparkles" size={20} color={colors.softGold} />
                <Text style={[styles.cardTitle, { marginLeft: 8, color: colors.royalMaroon }]}>Talk to Verified Vedic Pandit</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.charcoal, lineHeight: 19, marginBottom: 12 }}>
                Get an auspicious date (Shubh Muhurat), Kundli dosha remedies, or complete marriage matchmaking guidance from certified Pandits.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.royalMaroon }]}
                onPress={() => navigation.navigate('PanditServices')}
              >
                <Text style={styles.primaryBtnText}>Book Pandit Consultation →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {/* Matchmaking Form */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ashta Koota Match Calculator</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
                Computes authentic Vedic points (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi) out of 36.
              </Text>

              {/* Groom's details */}
              <Text style={styles.sectionHeader}>Groom's Vedic Details</Text>
              <Text style={styles.inputLabel}>Moon Sign (Rashi)</Text>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorVal}>{boyRashi}</Text>
              </View>

              <Text style={styles.inputLabel}>Nakshatra</Text>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorVal}>{boyNakshatra}</Text>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setBoyManglik(!boyManglik)}
              >
                <Ionicons
                  name={boyManglik ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.royalMaroon}
                />
                <Text style={styles.checkboxLabel}>Groom has Manglik influence</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Bride's details */}
              <Text style={styles.sectionHeader}>Bride's Vedic Details</Text>
              <Text style={styles.inputLabel}>Moon Sign (Rashi)</Text>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorVal}>{girlRashi}</Text>
              </View>

              <Text style={styles.inputLabel}>Nakshatra</Text>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorVal}>{girlNakshatra}</Text>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setGirlManglik(!girlManglik)}
              >
                <Ionicons
                  name={girlManglik ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.royalMaroon}
                />
                <Text style={styles.checkboxLabel}>Bride has Manglik influence</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 16 }]}
                onPress={handleCalculateMatch}
                disabled={calculating}
              >
                {calculating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Calculate 36 Gunas Compatibility</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Results Section */}
            {matchingResult && (
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.scoreHeader}>
                  <View>
                    <Text style={styles.scoreText}>
                      {matchingResult.totalScore} / 36
                    </Text>
                    <Text style={styles.scoreSub}>Total Gunas Matched</Text>
                  </View>
                  <View style={[
                    styles.verdictBadge,
                    matchingResult.totalScore >= 18 ? styles.verdictGreen : styles.verdictAmber
                  ]}>
                    <Text style={styles.verdictText}>{matchingResult.compatibilityVerdict}</Text>
                  </View>
                </View>

                {/* Manglik Analysis */}
                <View style={styles.manglikBox}>
                  <Text style={styles.manglikTitle}>Manglik Compatibility</Text>
                  <Text style={styles.manglikDesc}>{matchingResult.manglikAnalysis.summary}</Text>
                </View>

                {/* 8 Kootas Breakdown */}
                <Text style={[styles.sectionHeader, { marginTop: 14 }]}>Ashta Koota Scorecard</Text>
                {matchingResult.breakdown.map((item, idx) => (
                  <View key={idx} style={styles.kootaRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kootaName}>
                        {item.kootaName} ({item.sanskritName})
                      </Text>
                      <Text style={styles.kootaDesc}>{item.description}</Text>
                    </View>
                    <Text style={styles.kootaScore}>
                      {item.obtainedPoints} / {item.maxPoints}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.lightGold,
    marginTop: 2,
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextActive: {
    color: colors.royalMaroon,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
  },
  badgeTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.verifiedGreen,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F6F0',
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaVal: {
    fontSize: 13,
    color: colors.charcoal,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginTop: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 4,
  },
  selectorRow: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  selectorVal: {
    fontSize: 13,
    color: colors.charcoal,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 12,
    color: colors.charcoal,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E2D8',
    marginVertical: 10,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D8',
    paddingBottom: 12,
  },
  scoreText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.royalMaroon,
  },
  scoreSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  verdictBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verdictGreen: {
    backgroundColor: '#E8F5E9',
  },
  verdictAmber: {
    backgroundColor: '#FFF8E1',
  },
  verdictText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
  },
  manglikBox: {
    backgroundColor: '#FAF6ED',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.softGold,
  },
  manglikTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 2,
  },
  manglikDesc: {
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 16,
  },
  kootaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2EB',
  },
  kootaName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoal,
  },
  kootaDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  kootaScore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginLeft: 12,
  },
});
