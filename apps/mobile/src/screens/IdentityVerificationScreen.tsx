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
  Image,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IdentityDocumentType } from '@bandhansetu/shared';
import { colors, typography, spacing, borderRadius, fonts, shadows } from '../constants/theme';
import { apiClient } from '../services/apiClient';
import {
  getAuthHeader,
  getSessionToken,
  getSessionUser,
  performLogout,
  syncCurrentUserWithBackend,
} from '../services/authSession';
import { isUserAdminVerified } from '../navigation/authRouting';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsset } from '../services/imageUpload';

const DOCUMENT_OPTIONS: Array<{
  key: IdentityDocumentType;
  label: string;
  inputLabel: string;
  placeholder: string;
  keyboardType: 'number-pad' | 'default';
  maxLength: number;
}> = [
  {
    key: 'aadhaar_card',
    label: 'Aadhaar Card',
    inputLabel: '12-Digit Aadhaar Number',
    placeholder: 'XXXX XXXX XXXX',
    keyboardType: 'number-pad',
    maxLength: 14,
  },
  {
    key: 'pan_card',
    label: 'PAN Card',
    inputLabel: '10-Character PAN Number',
    placeholder: 'e.g. ABCDE1234F',
    keyboardType: 'default',
    maxLength: 12,
  },
  {
    key: 'voter_id',
    label: 'Voter ID Card',
    inputLabel: 'Voter ID (EPIC) Number',
    placeholder: 'e.g. ABC1234567',
    keyboardType: 'default',
    maxLength: 20,
  },
  {
    key: 'passport',
    label: 'Passport',
    inputLabel: 'Passport Number',
    placeholder: 'e.g. A1234567',
    keyboardType: 'default',
    maxLength: 20,
  },
  {
    key: 'bank_passbook',
    label: 'Bank Passbook',
    inputLabel: 'Bank Account / Passbook Number',
    placeholder: 'Enter account number on passbook',
    keyboardType: 'default',
    maxLength: 24,
  },
];

export const IdentityVerificationScreen: React.FC<any> = ({ navigation, route }) => {
  const sessionUser = getSessionUser();
  const isMandatory = Boolean(route?.params?.mandatory) || !isUserAdminVerified(sessionUser);

  const [docType, setDocType] = useState<IdentityDocumentType>('aadhaar_card');
  const [docNumber, setDocNumber] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  // Selected document photo (local only until submit; uploaded privately to Cloudinary)
  const [docAsset, setDocAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const selectedDocConfig = DOCUMENT_OPTIONS.find((d) => d.key === docType) || DOCUMENT_OPTIONS[0];

  // Prevent skipping mandatory KYC via Android hardware back button
  useEffect(() => {
    if (!isMandatory) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStatus?.identityVerificationStatus === 'pending') {
        navigation.replace('ApprovalPending');
        return true;
      }
      Alert.alert(
        'ID Verification Mandatory',
        'Uploading one of Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook is compulsory before creating your profile. Do you want to Sign Out instead?',
        [
          { text: 'Stay & Upload', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await performLogout();
              navigation.replace('LoginOtp');
            },
          },
        ]
      );
      return true;
    });
    return () => sub.remove();
  }, [isMandatory, currentStatus?.identityVerificationStatus, navigation]);

  const handleSignOut = async () => {
    await performLogout();
    navigation.replace('LoginOtp');
  };

  const pickDocument = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow access to select your document photo.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!result.canceled && result.assets?.[0]) setDocAsset(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Could not select the document photo.');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const headers = await getAuthHeader();
      const json = await apiClient<any>('/verification/status', { headers });
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

    if (!docAsset) {
      Alert.alert('Document Required', 'Please upload a clear photo of your document.');
      return;
    }

    setSubmitting(true);
    try {
      const token = getSessionToken();
      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        return;
      }
      // Private upload (Cloudinary "authenticated"); only an opaque key comes back, never a URL.
      setUploadPct(0);
      const uploaded = await uploadAsset({
        token,
        asset: docAsset,
        purpose: 'identity_document',
        onProgress: setUploadPct,
      });

      const headers = await getAuthHeader();
      const json = await apiClient<any>('/verification/identity', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documentType: docType,
          documentReferenceNumber: docNumber.trim(),
          documentStorageKey: uploaded.fileKey,
          consentGranted: true,
          termsVersion: 'v1.0',
        }),
      });

      if (json.success) {
        setDocAsset(null);
        setDocNumber('');
        await syncCurrentUserWithBackend().catch(() => {});
        Alert.alert(
          'ID Document Uploaded! 🛡️',
          `Your ${selectedDocConfig.label} has been securely submitted to the Admin Panel.\n\nOnce verified by Admin, your profile creation will unlock automatically.`,
          [
            {
              text: isMandatory ? 'Check Verification Status' : 'OK',
              onPress: () => {
                if (isMandatory) {
                  navigation.replace('ApprovalPending');
                } else {
                  fetchStatus();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', json.error?.message || json.message || 'Submission failed.');
      }
    } catch (e: any) {
      Alert.alert(
        e?.name === 'UploadError' ? 'Upload Problem' : 'Submission Error',
        e?.message || 'Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
      setUploadPct(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {!isMandatory ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="shield-checkmark" size={24} color="#FFD700" style={{ padding: 4 }} />
        )}
        <Text style={[styles.headerTitle, { flex: 1 }]}>
          {isMandatory ? 'Step 1: Mandatory ID Proof' : 'Identity Verification'}
        </Text>
        {isMandatory && (
          <TouchableOpacity onPress={handleSignOut} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#FFE4B5', fontSize: 12, fontWeight: '700' }}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Mandatory Registration Gate Notice */}
        {isMandatory && (
          <View style={[styles.infoBox, { backgroundColor: '#FFF4E5', borderColor: '#F59E0B' }]}>
            <Ionicons name="alert-circle" size={22} color="#B45309" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 }}>
                Compulsory Document Upload Before Profile Creation
              </Text>
              <Text style={[styles.infoText, { marginLeft: 0, color: '#78350F' }]}>
                To keep ShaadiBanao 100% genuine, every new member must upload a clear photo of ANY ONE document: Aadhaar Card, PAN Card, Voter ID Card, Passport, or Bank Passbook. Once Admin verifies your ID, your profile creation form will unlock automatically.
              </Text>
            </View>
          </View>
        )}

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
            {isMandatory && currentStatus.identityVerificationStatus === 'pending' && (
              <TouchableOpacity
                style={[styles.submitBtn, { marginTop: 12, backgroundColor: '#1E293B', minHeight: 42, paddingVertical: 10 }]}
                onPress={() => navigation.replace('ApprovalPending')}
              >
                <Text style={styles.submitBtnText}>⏳ View Admin Verification Status</Text>
              </TouchableOpacity>
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

        {/* Document Type Selector (All 5 Supported Documents) */}
        <Text style={styles.sectionLabel}>Select Identity Proof Document</Text>
        <View style={styles.typeWrapRow}>
          {DOCUMENT_OPTIONS.map((item) => {
            const isSelected = docType === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.docTypeChip, isSelected && styles.typeBtnActive]}
                onPress={() => setDocType(item.key)}
                activeOpacity={0.75}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.royalMaroon} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Document Number Input */}
        <Text style={styles.sectionLabel}>{selectedDocConfig.inputLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={docNumber}
          onChangeText={setDocNumber}
          placeholder={selectedDocConfig.placeholder}
          keyboardType={selectedDocConfig.keyboardType}
          autoCapitalize="characters"
          maxLength={selectedDocConfig.maxLength}
        />

        {/* Document Photo (private upload) */}
        <Text style={styles.sectionLabel}>Upload Clear Photo of {selectedDocConfig.label}</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={styles.typeBtn} onPress={() => pickDocument(false)} activeOpacity={0.75}>
            <Ionicons name="images-outline" size={14} color={colors.royalMaroon} style={{ marginRight: 4 }} />
            <Text style={styles.typeBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.typeBtn} onPress={() => pickDocument(true)} activeOpacity={0.75}>
            <Ionicons name="camera-outline" size={14} color={colors.royalMaroon} style={{ marginRight: 4 }} />
            <Text style={styles.typeBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>
        {docAsset && (
          <View style={styles.docPreviewBox}>
            <Image source={{ uri: docAsset.uri }} style={styles.docPreviewImg} resizeMode="cover" />
            <Text style={styles.maskedDoc}>
              ✓ {selectedDocConfig.label} photo selected (encrypted private vault — visible only to Admin verification team)
            </Text>
          </View>
        )}
        {uploadPct !== null && <Text style={styles.maskedDoc}>Uploading securely... {uploadPct}%</Text>}

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
  typeWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  docTypeChip: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E8E2D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPreviewBox: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8E2D8',
  },
  docPreviewImg: {
    width: '100%',
    height: 170,
    borderRadius: 8,
    backgroundColor: '#F3ECE2',
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
