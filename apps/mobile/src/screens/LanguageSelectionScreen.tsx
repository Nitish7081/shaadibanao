import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, fonts, shadows } from '../constants/theme';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { setAppLanguage } from '../i18n';
import { PRIMARY_LANGUAGES, OTHER_LANGUAGES, LanguageOption } from '../i18n/languages';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelection'>;

export const LanguageSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const fromSettings = route.params?.fromSettings === true;
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language || 'en');
  const [showOther, setShowOther] = useState<boolean>(
    OTHER_LANGUAGES.some((l) => l.code === (i18n.language || 'en')),
  );

  const finish = () => {
    if (fromSettings && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  };

  // Apply immediately so the whole screen switches language on tap.
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
      <TouchableOpacity
        key={lang.code}
        activeOpacity={0.75}
        onPress={() => choose(lang.code)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${lang.native} ${lang.label}`}
        style={[styles.langCard, isSelected && styles.langCardSelected]}
      >
        <Text style={[styles.nativeText, isSelected && styles.nativeTextSelected]}>
          {lang.native}
        </Text>
        <Text style={[styles.labelText, isSelected && styles.labelTextSelected]}>
          {lang.label}
        </Text>
        {isSelected && (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="ShaadiBanao"
        subtitle={t('splash.tagline')}
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
        </View>

        <View style={styles.grid}>
          {PRIMARY_LANGUAGES.map(renderCard)}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowOther((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOther }}
            style={[styles.langCard, styles.otherCard, showOther && styles.langCardSelected]}
          >
            <Text style={[styles.nativeText, showOther && styles.nativeTextSelected]}>
              {t('language.other')}
            </Text>
            <Ionicons
              name={showOther ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.royalMaroon}
            />
            <Text style={styles.labelText}>{t('language.otherHint')}</Text>
          </TouchableOpacity>
          {showOther && OTHER_LANGUAGES.map(renderCard)}
        </View>

        {showOther && selectedLanguage !== 'en' && selectedLanguage !== 'hi' && (
          <Text style={styles.subtitle}>{t('language.partialNote')}</Text>
        )}

        <View style={styles.footer}>
          <Button
            title={t('common.continue')}
            onPress={finish}
            variant="primary"
            style={styles.continueButton}
          />
          {!fromSettings && (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>{t('language.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  header: {
    marginVertical: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: spacing.xs,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  langCard: {
    width: '48%',
    minHeight: 88,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.subtle,
  },
  otherCard: {
    width: '100%',
  },
  langCardSelected: {
    borderColor: colors.royalMaroon,
    borderWidth: 1.8,
    backgroundColor: '#FAF2F4',
  },
  nativeText: {
    fontSize: 18,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: 2,
    lineHeight: 26,
    textAlign: 'center',
  },
  nativeTextSelected: {
    color: colors.royalMaroon,
  },
  labelText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  labelTextSelected: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },
  checkCircle: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  continueButton: {
    width: '100%',
    minHeight: 50,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
});

