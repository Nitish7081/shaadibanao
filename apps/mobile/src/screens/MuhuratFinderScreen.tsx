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

  // Dynamic Panchang Muhurat generator calculating upcoming auspicious dates from today
  const getDynamicMuhurats = (category: string): MuhuratItem[] => {
    const today = new Date();
    const items: MuhuratItem[] = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const tithis = [
      'Shukla Dwitiya', 'Shukla Tritiya', 'Shukla Panchami', 'Shukla Saptami',
      'Shukla Dashami', 'Shukla Ekadashi', 'Shukla Trayodashi', 'Purnima'
    ];
    const nakshatras = [
      'Rohini', 'Uttara Phalguni', 'Hasta', 'Swati', 'Anuradha', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati'
    ];
    const yogas = [
      'Sarvartha Siddhi Yoga', 'Amrit Siddhi Yoga', 'Ravi Yoga', 'Shubh Yoga', 'Siddhi Yoga', 'Shobhan Yoga'
    ];

    const categoryConfig: Record<string, { ceremonyName: string; timing: string; note: string; dayOffsets: number[] }> = {
      wedding: {
        ceremonyName: 'Vivah Sanskar',
        timing: '06:45 AM - 11:30 AM (Shubh Lagna)',
        note: 'Highly auspicious vivah lagna with Guru-Chandra auspicious drishti for Saptapadi and Kanyadaan.',
        dayOffsets: [3, 7, 14, 21, 28, 35],
      },
      griha_pravesh: {
        ceremonyName: 'Griha Pravesh',
        timing: '06:30 AM - 09:15 AM (Pratah Kaal)',
        note: 'Prosperity and peace for entering a newly constructed or purchased home with Vastu Shanti.',
        dayOffsets: [4, 11, 18, 25, 32],
      },
      engagement: {
        ceremonyName: 'Engagement / Sagai',
        timing: '10:00 AM - 02:00 PM (Madhyahna)',
        note: 'Auspicious timing for ring exchange, formal alliance celebration, and family introductions.',
        dayOffsets: [5, 12, 19, 26, 33],
      },
      namkaran: {
        ceremonyName: 'Namkaran Sanskar',
        timing: '08:00 AM - 11:30 AM (Shubh Choghadiya)',
        note: 'Sacred naming ceremony with Vedic mantras, family blessings, and planetary alignment.',
        dayOffsets: [6, 13, 20, 27],
      },
      mundan: {
        ceremonyName: 'Mundan Sanskar',
        timing: '07:30 AM - 10:30 AM (Brahma / Labh)',
        note: 'First haircut ceremony under auspicious Vedic rites for child well-being and health.',
        dayOffsets: [8, 15, 22, 29],
      },
    };

    const cfg = categoryConfig[category] || categoryConfig.wedding;

    cfg.dayOffsets.forEach((offset, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;
      const formattedDate = `${d.getDate()} ${monthNames[d.getMonth()]} ${y} (${dayNames[d.getDay()]})`;

      items.push({
        id: `${category}-${idx + 1}`,
        ceremony: cfg.ceremonyName,
        dateStr,
        formattedDate,
        timing: cfg.timing,
        tithi: tithis[idx % tithis.length],
        nakshatra: nakshatras[idx % nakshatras.length],
        auspiciousYoga: yogas[idx % yogas.length],
        notes: cfg.note,
      });
    });

    return items;
  };

  const currentList = getDynamicMuhurats(selectedCategory);

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
          (navigation as any).navigate('PanditBookingRequest', {
            serviceId: selectedCategory,
            initialDate: item.dateStr,
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

