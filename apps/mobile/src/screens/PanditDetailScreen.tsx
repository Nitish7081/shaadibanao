import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ds, PressableScale } from '../design';
import { API_BASE } from '../services/authSession';
import { getInitials } from '../components/home/matchPhoto';

export const PanditDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { panditId, panditName } = route.params || {};
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [pandit, setPandit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPanditDetails();
  }, []);

  const fetchPanditDetails = async () => {
    try {
      const res = await fetch(`${API_BASE}/pandits/${panditId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPandit(json.data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
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
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#7A1528', '#A22842']}
              style={styles.avatarCircle}
            >
              <Text maxFontSizeMultiplier={1.2} style={styles.avatarText}>
                {initials || 'P'}
              </Text>
            </LinearGradient>

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
});
