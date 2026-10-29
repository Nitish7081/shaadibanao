import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale } from '../design';
import { setAppLanguage } from '../i18n';
import { PRIMARY_LANGUAGES, OTHER_LANGUAGES, LanguageOption } from '../i18n/languages';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelection'>;

export const LanguageSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const fromSettings = route.params?.fromSettings === true;
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language || 'en');
  const [showOther, setShowOther] = useState<boolean>(
    OTHER_LANGUAGES.some((l) => l.code === (i18n.language || 'en'))
  );

  const finish = () => {
    if (fromSettings && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  };

  const choose = async (code: string) => {
    setSelectedLanguage(code);
    await setAppLanguage(code);
  };

  const handleSkip = async () => {
    await setAppLanguage('en');
    finish();
  };

  const renderCard = (lang: LanguageOption) => {
    const isSelected = selectedLanguage === lang.code;
    return (
      <PressableScale
        key={lang.code}
        onPress={() => choose(lang.code)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${lang.native} ${lang.label}`}
        style={[styles.langCard, isSelected && styles.langCardSelected]}
      >
        <View style={styles.cardContent}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.nativeText, isSelected && styles.nativeTextSelected]}
          >
            {lang.native}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.labelText, isSelected && styles.labelTextSelected]}
          >
            {lang.label}
          </Text>
        </View>

        {isSelected ? (
          <View style={styles.checkCircleSelected}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.checkCircleEmpty} />
        )}
      </PressableScale>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Header */}
      <View style={styles.topNav}>
        {fromSettings ? (
          <PressableScale
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
          </PressableScale>
        ) : (
          <View style={{ width: 38 }} />
        )}

        <Text maxFontSizeMultiplier={1.2} style={styles.navTitle}>
          BandhanSetu
        </Text>

        {!fromSettings ? (
          <PressableScale
            onPress={handleSkip}
            style={styles.skipBtn}
            accessibilityLabel="Skip"
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.skipBtnText}>
              {t('language.skip')}
            </Text>
          </PressableScale>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text maxFontSizeMultiplier={1.2} style={styles.screenHeading}>
            {t('language.title')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.screenSubheading}>
            {t('language.subtitle')}
          </Text>
        </View>

        {/* Primary Language Cards */}
        <View style={styles.cardsGrid}>
          {PRIMARY_LANGUAGES.map(renderCard)}

          {/* Toggle other Indian languages */}
          <PressableScale
            onPress={() => setShowOther((v) => !v)}
            style={[styles.langCard, styles.toggleCard, showOther && styles.langCardSelected]}
          >
            <View style={styles.cardContent}>
              <Text maxFontSizeMultiplier={1.2} style={styles.nativeText}>
                {t('language.other')}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.labelText}>
                {t('language.otherHint')}
              </Text>
            </View>

            <Ionicons
              name={showOther ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={ds.color.maroon}
            />
          </PressableScale>

          {showOther && OTHER_LANGUAGES.map(renderCard)}
        </View>

        {showOther && selectedLanguage !== 'en' && selectedLanguage !== 'hi' && (
          <Text maxFontSizeMultiplier={1.2} style={styles.partialNote}>
            {t('language.partialNote')}
          </Text>
        )}

        {/* Continue Button */}
        <PressableScale
          style={styles.continueBtn}
          onPress={finish}
        >
          <LinearGradient
            colors={['#7A1528', '#9B1D36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.continueBtnText}>
              {t('common.continue')}
            </Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </LinearGradient>
        </PressableScale>
      </ScrollView>
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
    fontWeight: '800',
    color: ds.color.maroon,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
  scrollContent: {
    padding: ds.space.md,
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: ds.space.md,
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  cardsGrid: {
    gap: 10,
    marginBottom: ds.space.lg,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ds.color.border,
    paddingHorizontal: ds.space.lg,
    paddingVertical: 14,
    ...ds.shadow.soft,
  },
  langCardSelected: {
    borderColor: ds.color.maroon,
    backgroundColor: '#FFFBF5',
  },
  toggleCard: {
    backgroundColor: ds.color.surfaceWarm,
  },
  cardContent: {
    flex: 1,
  },
  nativeText: {
    fontSize: 17,
    fontWeight: '700',
    color: ds.color.text,
  },
  nativeTextSelected: {
    color: ds.color.maroon,
    fontWeight: '800',
  },
  labelText: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  labelTextSelected: {
    color: ds.color.maroon,
    fontWeight: '600',
  },
  checkCircleSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ds.color.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ds.color.border,
  },
  partialNote: {
    fontSize: 12,
    color: ds.color.textMuted,
    textAlign: 'center',
    marginBottom: ds.space.md,
  },
  continueBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: ds.space.sm,
    ...ds.shadow.soft,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
