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
import { colors, typography, spacing, borderRadius, fonts, shadows } from '../constants/theme';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const IdentityVerificationScreen: React.FC<any> = ({ navigation }) => {
  const [docType, setDocType] = useState<'aadhaar_card' | 'passport' | 'voter_id'>('aadhaar_card');
  const [docNumber, setDocNumber] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/verification/status`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentStatus(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!docNumber.trim()) {
      Alert.alert('Required Field', 'Please enter your document number.');
      return;
    }

    if (!consentGranted) {
      Alert.alert('Consent Required', 'You must agree to the identity verification consent clause to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/verification/identity`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType: docType,
          documentReferenceNumber: docNumber.trim(),
          documentStorageKey: `secure-vault/identity/${docType}_doc.pdf`,
          consentGranted: true,
          termsVersion: 'v1.0',
        }),
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert(
          'Verification Submitted! 🛡️',
          'Your identity proof has been securely recorded. Our trust & safety team will verify your document and issue your verified profile badge.',
          [{ text: 'OK', onPress: () => fetchStatus() }]
        );
      } else {
        Alert.alert('Error', json.error?.message || json.message || 'Submission failed.');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Verification Status Card */}
        {currentStatus && (
          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <Ionicons
                name={
                  currentStatus.identityVerificationStatus === 'verified'
                    ? 'shield-checkmark'
                    : currentStatus.identityVerificationStatus === 'pending'
                    ? 'hourglass-outline'
                    : 'shield-outline'
                }
                size={24}
                color={
                  currentStatus.identityVerificationStatus === 'verified'
                    ? colors.verifiedGreen
                    : colors.royalMaroon
                }
              />
              <Text style={styles.statusLabel}>
                Status:{' '}
                <Text style={{ fontWeight: '700', textTransform: 'uppercase' }}>
                  {currentStatus.identityVerificationStatus || 'NONE'}
                </Text>
              </Text>
            </View>
            {currentStatus.identityDocumentReferenceMasked && (
              <Text style={styles.maskedDoc}>
                Reference: {currentStatus.identityDocumentReferenceMasked}
              </Text>
            )}
          </View>
        )}

        {/* Informational Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.royalMaroon} />
          <Text style={styles.infoText}>
            Verified profiles receive up to 300% more interest accepts. We do not store raw Aadhaar copies on public servers; numbers are securely masked and stored in an encrypted vault.
          </Text>
        </View>

        {/* Document Type Selector */}
        <Text style={styles.sectionLabel}>Select Government Identity Document</Text>
        <View style={styles.typeRow}>
          {[
            { key: 'aadhaar_card', label: 'Aadhaar Card' },
            { key: 'passport', label: 'Passport' },
            { key: 'voter_id', label: 'Voter ID' },
          ].map((item) => {
            const isSelected = docType === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
                onPress={() => setDocType(item.key as any)}
                activeOpacity={0.75}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={13} color={colors.royalMaroon} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Document Number Input */}
        <Text style={styles.sectionLabel}>
          {docType === 'aadhaar_card' ? '12-Digit Aadhaar Number' : 'Document Number'}
        </Text>
        <TextInput
          style={styles.textInput}
          value={docNumber}
          onChangeText={setDocNumber}
          placeholder={docType === 'aadhaar_card' ? 'XXXX XXXX XXXX' : 'Enter document number'}
          keyboardType={docType === 'aadhaar_card' ? 'number-pad' : 'default'}
          maxLength={docType === 'aadhaar_card' ? 14 : 20}
        />

        {/* Consent Clause */}
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setConsentGranted(!consentGranted)}
        >
          <Ionicons
            name={consentGranted ? 'checkbox' : 'square-outline'}
            size={22}
            color={colors.royalMaroon}
          />
          <Text style={styles.consentText}>
            I voluntarily grant consent to ShaadiBanao to verify my identity credentials for genuine matrimonial account authentication in accordance with privacy safeguards.
          </Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, !consentGranted && { opacity: 0.6 }]}
          onPress={handleSubmitVerification}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Submit for Verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginBottom: 16,
    ...shadows.card,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginLeft: 10,
  },
  maskedDoc: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5ED',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 17,
    flex: 1,
    marginLeft: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 6,
    marginTop: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E8E2D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnActive: {
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
    backgroundColor: '#FAF3F5',
  },
  typeBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginBottom: 14,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 10,
  },
  consentText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 17,
    flex: 1,
    marginLeft: 8,
  },
  submitBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...shadows.card,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
});
