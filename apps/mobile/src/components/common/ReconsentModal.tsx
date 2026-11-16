import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
  UserSummary,
} from '@bandhansetu/shared';
import { ds, PressableScale } from '../../design';
import { LEGAL_URLS, openExternalLegalUrl } from '../../config/legalUrls';
import {
  getSessionToken,
  getSessionUser,
  onUserUpdated,
  performLogout,
  setSessionAuth,
  getRefreshToken,
} from '../../services/authSession';
import { recordPolicyConsent } from '../../services/authService';
import { navigateToLogin } from '../../navigation/navigationRef';

export const ReconsentModal: React.FC = () => {
  const [user, setUser] = useState<UserSummary | null>(() => getSessionUser());
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onUserUpdated((updated) => {
      setUser(updated);
      if (!updated?.requiresReconsent) {
        setAgreed(false);
      }
    });
    return unsubscribe;
  }, []);

  const visible = Boolean(user && user.requiresReconsent === true && getSessionToken());
  if (!visible) return null;

  const targetPrivacyVersion =
    user?.currentPrivacyPolicyVersion || CURRENT_PRIVACY_POLICY_VERSION;
  const targetTermsVersion = user?.currentTermsVersion || CURRENT_TERMS_VERSION;

  const handleAcceptUpdatedPolicy = async () => {
    if (!agreed) {
      Alert.alert(
        'Consent Required',
        'Please check the agreement box after reviewing the updated Privacy Policy and Terms & Conditions.'
      );
      return;
    }

    const token = getSessionToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await recordPolicyConsent(token, {
        consentToTerms: true,
        privacyPolicyVersion: targetPrivacyVersion,
        termsVersion: targetTermsVersion,
        source: 'mobile_reconsent',
      });
      if (res.data?.user) {
        setSessionAuth(token, res.data.user.id, res.data.user, getRefreshToken());
      }
      setAgreed(false);
    } catch (err: any) {
      Alert.alert(
        'Unable to Save Consent',
        err?.message || 'Please check your internet connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineAndSignOut = async () => {
    await performLogout();
    navigateToLogin();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={16} color={ds.color.maroon} />
            <Text style={styles.badgeText}>POLICY UPDATE</Text>
          </View>

          <Text style={styles.title}>Updated Privacy Policy & Terms</Text>
          <Text style={styles.body}>
            We have updated the ShaadiBanao Privacy Policy (v{targetPrivacyVersion}) and Terms &
            Conditions (v{targetTermsVersion}) to clarify how your matrimonial profile, photos,
            authentication, and account deletion rights work. Please review and confirm your
            consent to continue.
          </Text>

          <View style={styles.linksRow}>
            <PressableScale
              style={styles.linkPill}
              onPress={() => openExternalLegalUrl(LEGAL_URLS.privacyPolicy, 'Privacy Policy')}
            >
              <Ionicons name="document-text-outline" size={15} color={ds.color.maroon} />
              <Text style={styles.linkPillText}>Read Privacy Policy</Text>
            </PressableScale>

            <PressableScale
              style={styles.linkPill}
              onPress={() =>
                openExternalLegalUrl(LEGAL_URLS.termsAndConditions, 'Terms & Conditions')
              }
            >
              <Ionicons name="reader-outline" size={15} color={ds.color.maroon} />
              <Text style={styles.linkPillText}>Read Terms</Text>
            </PressableScale>
          </View>

          <PressableScale
            style={styles.checkboxRow}
            onPress={() => setAgreed(!agreed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <Ionicons
              name={agreed ? 'checkbox' : 'square-outline'}
              size={22}
              color={ds.color.maroon}
            />
            <Text style={styles.checkboxLabel}>
              I have reviewed and agree to the updated ShaadiBanao Privacy Policy (v
              {targetPrivacyVersion}) and Terms & Conditions (v{targetTermsVersion}).
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.acceptBtn, (!agreed || submitting) && styles.acceptBtnDisabled]}
            onPress={handleAcceptUpdatedPolicy}
            disabled={submitting}
          >
            <LinearGradient
              colors={['#7A1528', '#9B1D36']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.acceptText}>Accept & Continue</Text>
                </>
              )}
            </LinearGradient>
          </PressableScale>

          <PressableScale style={styles.signOutLink} onPress={handleDeclineAndSignOut}>
            <Text style={styles.signOutText}>Decline & Sign Out</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 24, 23, 0.68)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: ds.color.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    color: ds.color.textBody,
    marginBottom: 14,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  linkPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: ds.color.textBody,
  },
  acceptBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  acceptBtnDisabled: {
    opacity: 0.75,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  signOutLink: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
});
