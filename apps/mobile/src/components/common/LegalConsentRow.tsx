import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@bandhansetu/shared';
import { ds, PressableScale } from '../../design';
import { LEGAL_URLS, openExternalLegalUrl } from '../../config/legalUrls';

interface LegalConsentRowProps {
  checked: boolean;
  onToggle: () => void;
  hasError?: boolean;
  errorText?: string;
}

export const LegalConsentRow: React.FC<LegalConsentRowProps> = ({
  checked,
  onToggle,
  hasError = false,
  errorText,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, hasError && !checked && styles.rowError]}>
        <PressableScale
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="Agree to ShaadiBanao Privacy Policy and Terms and Conditions"
          style={styles.checkboxHitArea}
        >
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={22}
            color={hasError && !checked ? '#C92A2A' : ds.color.maroon}
          />
        </PressableScale>

        <View style={styles.textBlock}>
          <Text maxFontSizeMultiplier={1.2} style={styles.consentText}>
            I confirm that I am 18+ years old and explicitly agree to the ShaadiBanao{' '}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() => openExternalLegalUrl(LEGAL_URLS.privacyPolicy, 'Privacy Policy')}
            >
              Privacy Policy
            </Text>{' '}
            and{' '}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() =>
                openExternalLegalUrl(LEGAL_URLS.termsAndConditions, 'Terms & Conditions')
              }
            >
              Terms & Conditions
            </Text>
            .
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.versionMeta}>
            Policy v{CURRENT_PRIVACY_POLICY_VERSION} • Terms v{CURRENT_TERMS_VERSION} (Required)
          </Text>
        </View>
      </View>

      {hasError && !checked ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.errorMessage}>
          {errorText ||
            'Please review and check the Privacy Policy & Terms box above before creating your account.'}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    marginBottom: ds.space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderRadius: 14,
    padding: 12,
  },
  rowError: {
    borderColor: '#C92A2A',
    backgroundColor: '#FFF5F5',
  },
  checkboxHitArea: {
    paddingTop: 1,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  consentText: {
    fontSize: 12.5,
    color: ds.color.textBody,
    lineHeight: 19,
  },
  legalLink: {
    color: ds.color.maroon,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  versionMeta: {
    fontSize: 10.5,
    color: ds.color.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 11.5,
    color: '#C92A2A',
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 4,
  },
});
