import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale } from '../design';

type Props = NativeStackScreenProps<RootStackParamList, 'MuhuratFinder'>;

interface MuhuratItem {
  id: string;
  ceremony: string;
  dateStr: string;
  formattedDate: string;
  timing: string;
  tithi: string;
  nakshatra: string;
  auspiciousYoga: string;
  notes: string;
}

export const MuhuratFinderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [selectedCategory, setSelectedCategory] = useState<string>(
    route.params?.ceremonyType || 'wedding'
  );
  const [refreshing, setRefreshing] = useState(false);

  const categories = [
    { key: 'wedding', label: t('muhuratFinder.vivah'), icon: 'heart' as const },
    { key: 'griha_pravesh', label: t('muhuratFinder.grihaPravesh'), icon: 'home' as const },
    { key: 'engagement', label: t('muhuratFinder.engagement'), icon: 'sparkles' as const },
    { key: 'namkaran', label: t('muhuratFinder.namkaran'), icon: 'gift' as const },
    { key: 'mundan', label: t('muhuratFinder.mundan'), icon: 'cut' as const },
  ];

  const muhuratData: Record<string, MuhuratItem[]> = {
    wedding: [
      {
        id: 'w-1',
        ceremony: 'Vivah Sanskar',
        dateStr: '2026-11-18',
        formattedDate: '18 Nov 2026 (Wednesday)',
        timing: '06:45 AM - 11:30 AM',
        tithi: 'Kartik Shukla Dashami',
        nakshatra: 'Uttara Phalguni',
        auspiciousYoga: 'Sarvartha Siddhi Yoga',
        notes: 'Highly auspicious vivah lagna with Guru-Chandra auspicious drishti.',
      },
      {
        id: 'w-2',
        ceremony: 'Vivah Sanskar',
        dateStr: '2026-11-22',
        formattedDate: '22 Nov 2026 (Sunday)',
        timing: '07:15 PM - 11:45 PM (Godhuli)',
        tithi: 'Kartik Shukla Trayodashi',
        nakshatra: 'Rohini',
        auspiciousYoga: 'Amrit Siddhi Yoga',
        notes: 'Auspicious evening Godhuli lagna ideal for Saptapadi and Kanyadaan.',
      },
      {
        id: 'w-3',
        ceremony: 'Vivah Sanskar',
        dateStr: '2026-12-05',
        formattedDate: '05 Dec 2026 (Saturday)',
        timing: '08:30 AM - 01:15 PM',
        tithi: 'Margashirsha Krishna Ekadashi',
        nakshatra: 'Hasta',
        auspiciousYoga: 'Shubh Yoga',
        notes: 'Dosha-free daytime lagna suitable for both North & South Indian rites.',
      },
      {
        id: 'w-4',
        ceremony: 'Vivah Sanskar',
        dateStr: '2026-12-14',
        formattedDate: '14 Dec 2026 (Monday)',
        timing: '05:30 PM - 09:45 PM',
        tithi: 'Margashirsha Shukla Panchami',
        nakshatra: 'Anuradha',
        auspiciousYoga: 'Ravi Yoga',
        notes: 'Sacred Vivah Panchami muhurat symbolizing divine blessings.',
      },
    ],
    griha_pravesh: [
      {
        id: 'g-1',
        ceremony: 'Griha Pravesh',
        dateStr: '2026-11-12',
        formattedDate: '12 Nov 2026 (Thursday)',
        timing: '06:30 AM - 09:15 AM',
        tithi: 'Kartik Shukla Dwitiya',
        nakshatra: 'Anuradha',
        auspiciousYoga: 'Sarvartha Siddhi Yoga',
        notes: 'Prosperity and peace for entering a newly constructed home.',
      },
      {
        id: 'g-2',
        ceremony: 'Griha Pravesh',
        dateStr: '2026-12-02',
        formattedDate: '02 Dec 2026 (Wednesday)',
        timing: '07:00 AM - 10:45 AM',
        tithi: 'Margashirsha Krishna Ashtami',
        nakshatra: 'Uttara Bhadrapada',
        auspiciousYoga: 'Amrit Yoga',
        notes: 'Vastu Shanti and Vastu puja muhurat for new residence.',
      },
    ],
    engagement: [
      {
        id: 'e-1',
        ceremony: 'Engagement / Sagai',
        dateStr: '2026-11-15',
        formattedDate: '15 Nov 2026 (Sunday)',
        timing: '10:00 AM - 02:00 PM',
        tithi: 'Kartik Shukla Saptami',
        nakshatra: 'Shravana',
        auspiciousYoga: 'Siddhi Yoga',
        notes: 'Auspicious timing for ring exchange and formal family introductions.',
      },
      {
        id: 'e-2',
        ceremony: 'Engagement / Sagai',
        dateStr: '2026-11-29',
        formattedDate: '29 Nov 2026 (Sunday)',
        timing: '11:15 AM - 03:30 PM',
        tithi: 'Kartik Purnima',
        nakshatra: 'Krittika',
        auspiciousYoga: 'Tripurari Purnima Yoga',
        notes: 'Highly pious day for formal alliance celebration and blessings.',
      },
    ],
    namkaran: [
      {
        id: 'n-1',
        ceremony: 'Namkaran Sanskar',
        dateStr: '2026-11-20',
        formattedDate: '20 Nov 2026 (Friday)',
        timing: '08:00 AM - 11:30 AM',
        tithi: 'Kartik Shukla Ekadashi',
        nakshatra: 'Revati',
        auspiciousYoga: 'Shobhan Yoga',
        notes: 'Sacred naming rites with Vedic mantras and family blessings.',
      },
    ],
    mundan: [
      {
        id: 'm-1',
        ceremony: 'Mundan Sanskar',
        dateStr: '2026-12-10',
        formattedDate: '10 Dec 2026 (Thursday)',
        timing: '07:30 AM - 10:30 AM',
        tithi: 'Margashirsha Shukla Pratipada',
        nakshatra: 'Mula',
        auspiciousYoga: 'Vriddhi Yoga',
        notes: 'First haircut ceremony under Vedic Vedic rites for child well-being.',
      },
    ],
  };

  const currentList = muhuratData[selectedCategory] || muhuratData.wedding;

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.topNavRow}>
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
            {t('muhuratFinder.headerTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('muhuratFinder.headerSubtitle')}
          </Text>
        </View>
      </View>

      {/* Category Pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(c) => c.key}
        contentContainerStyle={styles.categoryScroll}
        renderItem={({ item }) => {
          const isSelected = selectedCategory === item.key;
          return (
            <PressableScale
              style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : ds.color.maroon}
              />
              <Text
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.categoryPillText,
                  isSelected && styles.categoryPillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </PressableScale>
          );
        }}
      />

      {/* Sample Vedic Data Notice Banner */}
      <View style={styles.sampleDataBanner}>
        <Ionicons name="information-circle" size={16} color="#B45309" />
        <Text maxFontSizeMultiplier={1.2} style={styles.sampleDataBannerText}>
          Sample Vedic Data (For Reference Only) • Consult Pandit for Kundli-specific dates
        </Text>
      </View>
    </View>
  );

  const renderMuhuratCard = ({ item }: { item: MuhuratItem }) => (
    <View style={styles.muhuratCard}>
      {/* Top Banner: Date & Auspicious Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.calendarDateBox}>
          <Ionicons name="calendar" size={16} color={ds.color.maroon} />
          <Text maxFontSizeMultiplier={1.2} style={styles.dateText}>
            {item.formattedDate}
          </Text>
        </View>

        <View style={styles.shubhBadge}>
          <Ionicons name="sparkles" size={12} color="#854D0E" />
          <Text maxFontSizeMultiplier={1.2} style={styles.shubhBadgeText}>
            {t('muhuratFinder.shubhMuhurat')}
          </Text>
        </View>
      </View>

      {/* Timing and Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailBox}>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailLabel}>
            {t('muhuratFinder.auspiciousTiming')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailValue}>
            {item.timing}
          </Text>
        </View>

        <View style={styles.detailBox}>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailLabel}>
            {t('muhuratFinder.nakshatra')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailValue}>
            {item.nakshatra}
          </Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailBox}>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailLabel}>
            {t('muhuratFinder.tithi')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailValue}>
            {item.tithi}
          </Text>
        </View>

        <View style={styles.detailBox}>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailLabel}>
            Vedic Yoga
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.detailValue}>
            {item.auspiciousYoga}
          </Text>
        </View>
      </View>

      {item.notes ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.notesText}>
          {item.notes}
        </Text>
      ) : null}

      {/* Direct Book Pandit Action */}
      <PressableScale
        style={styles.bookActionBtn}
        onPress={() =>
          navigation.navigate('PanditServices', {
            ceremonyType: selectedCategory,
          })
        }
      >
        <LinearGradient
          colors={['#7A1528', '#9B1D36']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bookBtnGradient}
        >
          <Ionicons name="calendar" size={15} color="#FFFFFF" />
          <Text maxFontSizeMultiplier={1.2} style={styles.bookActionBtnText}>
            {t('muhuratFinder.bookPanditForDate')}
          </Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.consultCard}>
      <View style={styles.consultHeader}>
        <Ionicons name="planet" size={20} color={ds.color.maroon} />
        <Text maxFontSizeMultiplier={1.2} style={styles.consultTitle}>
          {t('muhuratFinder.consultPanditTitle')}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.consultBody}>
        {t('muhuratFinder.consultPanditBody')}
      </Text>
      <PressableScale
        style={styles.consultActionBtn}
        onPress={() => navigation.navigate('PanditServices')}
      >
        <Text maxFontSizeMultiplier={1.2} style={styles.consultActionBtnText}>
          {t('muhuratFinder.consultAstrologerBtn')}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={ds.color.maroon} />
      </PressableScale>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={renderMuhuratCard}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
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
  topNavRow: {
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
    marginTop: 2,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.border,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  muhuratCard: {
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
  calendarDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.text,
  },
  shubhBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  shubhBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: ds.space.md,
    marginTop: 6,
  },
  detailBox: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  notesText: {
    fontSize: 12,
    color: ds.color.maroon,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 17,
  },
  bookActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: ds.space.md,
  },
  bookBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  bookActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  consultCard: {
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBDCB9',
    padding: ds.space.lg,
    marginTop: ds.space.sm,
    marginBottom: ds.space.md,
  },
  consultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  consultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  consultBody: {
    fontSize: 13,
    color: ds.color.textBody,
    lineHeight: 20,
    marginBottom: ds.space.md,
  },
  consultActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  consultActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  sampleDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 8,
  },
  sampleDataBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
});

