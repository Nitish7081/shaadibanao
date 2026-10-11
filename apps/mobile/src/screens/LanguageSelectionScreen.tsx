import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { APP_LANGUAGES, AppLanguageCode } from '@bandhansetu/shared';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelection'>;

export const LanguageSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguageCode>('en');

  const handleContinue = () => {
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="BandhanSetu"
        subtitle="Where trust meets togetherness"
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose your language</Text>
          <Text style={styles.subtitle}>
            Select your preferred language. You can change this at any time in settings.
          </Text>
        </View>

        <View style={styles.grid}>
          {APP_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                activeOpacity={0.8}
                onPress={() => setSelectedLanguage(lang.code)}
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
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            variant="primary"
            style={styles.continueButton}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('Welcome')}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip for now (English)</Text>
          </TouchableOpacity>
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
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  header: {
    marginVertical: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  langCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  langCardSelected: {
    borderColor: colors.royalMaroon,
    backgroundColor: '#FAF2F4',
  },
  nativeText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.xxs,
  },
  nativeTextSelected: {
    color: colors.royalMaroon,
  },
  labelText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  labelTextSelected: {
    color: colors.royalMaroon,
    fontWeight: '600',
  },
  checkCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.md,
  },
  continueButton: {
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    fontSize: typography.fontSizes.sm,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
});
