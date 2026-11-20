import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import {
  PHOTO_PRIVACY,
  PhotoPrivacy,
  UpsertProfileInput,
  PartnerPreferencesInput,
  PhotoData,
  RASHI_LIST,
  checkDateOfBirth,
  DATE_OF_BIRTH_MESSAGES,
  NAKSHATRA_LIST,
  IdentityDocumentType,
} from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { DatePickerField } from '../components/common/DatePickerField';
import { TimePickerField } from '../components/common/TimePickerField';
import { getDobDateLimits } from '../utils/dateTimeHelpers';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { getMyProfile, upsertMyProfile } from '../services/profileService';
import { getMyPreferences, upsertMyPreferences } from '../services/preferenceService';
import { getMyKundli, upsertMyKundli } from '../services/astrologyService';
import { getSessionToken, refreshSessionTokens, getSessionUser, syncCurrentUserWithBackend, getAuthHeader, setCachedUserProfile } from '../services/authSession';
import { getNextRouteForUser, isUserAdminVerified } from '../navigation/authRouting';
import {
  pickImageFromGallery,
  captureImageWithCamera,
} from '../services/storageService';
import { uploadAsset } from '../services/imageUpload';
import { cloudinaryUrl, photoSrc } from '../services/cloudinaryUrl';
import { apiClient } from '../services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const ID_DOCUMENT_OPTIONS: Array<{
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
    inputLabel: '12-Digit Aadhaar Number *',
    placeholder: 'XXXX XXXX XXXX',
    keyboardType: 'number-pad',
    maxLength: 14,
  },
  {
    key: 'pan_card',
    label: 'PAN Card',
    inputLabel: '10-Character PAN Number *',
    placeholder: 'ABCDE1234F',
    keyboardType: 'default',
    maxLength: 10,
  },
  {
    key: 'voter_id',
    label: 'Voter ID Card',
    inputLabel: 'Voter ID (EPIC) Number *',
    placeholder: 'ABC1234567',
    keyboardType: 'default',
    maxLength: 16,
  },
  {
    key: 'passport',
    label: 'Passport',
    inputLabel: 'Passport Number *',
    placeholder: 'A1234567',
    keyboardType: 'default',
    maxLength: 12,
  },
  {
    key: 'bank_passbook',
    label: 'Bank Passbook',
    inputLabel: 'Bank Account Number *',
    placeholder: 'Account number on passbook',
    keyboardType: 'default',
    maxLength: 20,
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileCreation'>;

export const ProfileCreationScreen: React.FC<Props> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const totalSteps = 8;

  // Animated progress bar
  const animatedProgress = useRef(new Animated.Value(1 / totalSteps)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: currentStep / totalSteps,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [currentStep, totalSteps, animatedProgress]);

  // Step 1: Basics
  // Prefill name from the real signed-in Google account (no mock data)
  const [firstName, setFirstName] = useState(() => {
    const dn = (getSessionUser() as any)?.displayName as string | undefined;
    return dn ? dn.trim().split(/\s+/)[0] : '';
  });
  const [lastName, setLastName] = useState(() => {
    const dn = (getSessionUser() as any)?.displayName as string | undefined;
    return dn ? dn.trim().split(/\s+/).slice(1).join(' ') : '';
  });
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const dobLimits = getDobDateLimits();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<'never_married' | 'divorced' | 'widowed'>('never_married');
  const [motherTongue, setMotherTongue] = useState('');

  // Step 2: Religion & Kundli
  const [religion, setReligion] = useState('');
  const [caste, setCaste] = useState('');
  const [gotra, setGotra] = useState('');
  const [manglik, setManglik] = useState<'yes' | 'no' | 'dont_know' | 'anshik'>('no');
  const [includeKundli, setIncludeKundli] = useState(false);
  const [birthTime, setBirthTime] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [rashi, setRashi] = useState<string>(RASHI_LIST[0]);
  const [nakshatra, setNakshatra] = useState<string>(NAKSHATRA_LIST[0]);

  // Step 3: Location
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  // Step 4: Family
  const [familyValues, setFamilyValues] = useState<'traditional' | 'moderate' | 'liberal'>('moderate');
  const [familyType, setFamilyType] = useState<'joint' | 'nuclear'>('nuclear');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');

  // Step 5: Education & Career
  const [education, setEducation] = useState('');
  const [employedIn, setEmployedIn] = useState<'private' | 'government' | 'business' | 'self_employed' | 'not_working'>('private');
  const [occupation, setOccupation] = useState('');
  const [annualIncomeBand, setAnnualIncomeBand] = useState('');
  const [showIncomeBand, setShowIncomeBand] = useState(true);

  // Step 6: Photos & Visibility Rules
  const [photoPrivacy, setPhotoPrivacy] = useState<PhotoPrivacy>('everyone');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoApprovalStatus, setPhotoApprovalStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  // Government ID Verification State (Aadhaar / PAN / Voter ID / Passport / Passbook)
  const [idDocType, setIdDocType] = useState<IdentityDocumentType>('aadhaar_card');
  const [idDocNumber, setIdDocNumber] = useState('');
  const [idDocAsset, setIdDocAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [idDocStorageKey, setIdDocStorageKey] = useState<string | null>(null);
  const [idConsentGranted, setIdConsentGranted] = useState(true);
  const [uploadingIdDoc, setUploadingIdDoc] = useState(false);
  const [idUploadPct, setIdUploadPct] = useState<number | null>(null);
  const [idVerificationStatus, setIdVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [idDocMaskedNumber, setIdDocMaskedNumber] = useState<string | null>(null);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [idDocSuccess, setIdDocSuccess] = useState<string | null>(null);

  // Step 7: About
  const [aboutMe, setAboutMe] = useState('');

  // Step 8: Partner Preferences
  const [prefMinAge, setPrefMinAge] = useState('21');
  const [prefMaxAge, setPrefMaxAge] = useState('35');
  const [prefMinHeight, setPrefMinHeight] = useState('150');
  const [prefMaxHeight, setPrefMaxHeight] = useState('190');
  const [prefCities, setPrefCities] = useState('');

  // Compulsory KYC Check: only redirect away if account is suspended
  useEffect(() => {
    const current = getSessionUser();
    if (current?.status === 'suspended') {
      navigation.replace('ApprovalPending');
    }
  }, [navigation]);

  // Pre-load existing saved profile and preferences from MongoDB if authenticated
  useEffect(() => {
    let isMounted = true;
    const loadExistingData = async () => {
      const token = getSessionToken();
      if (!token) return;

      try {
        const [profRes, prefRes, kundliRes] = await Promise.allSettled([
          getMyProfile(token),
          getMyPreferences(token),
          getMyKundli(token),
        ]);

        if (!isMounted) return;

        if (kundliRes.status === 'fulfilled' && kundliRes.value.data) {
          const k = kundliRes.value.data;
          setIncludeKundli(true);
          if (k.timeOfBirth) setBirthTime(k.timeOfBirth);
          if (k.birthPlace?.name) setBirthCity(k.birthPlace.name);
          if (k.rashi) setRashi(k.rashi);
          if (k.nakshatra) setNakshatra(k.nakshatra);
        }

        if (profRes.status === 'fulfilled' && profRes.value.data) {
          const p = profRes.value.data;
          if (p.firstName) setFirstName(p.firstName);
          if (p.lastName) setLastName(p.lastName);
          if (p.gender) setGender(p.gender as any);
          if (p.dateOfBirth) setDateOfBirth(p.dateOfBirth);
          if (p.heightCm) setHeightCm(String(p.heightCm));
          if (p.maritalStatus) setMaritalStatus(p.maritalStatus as any);
          if (p.motherTongue) setMotherTongue(p.motherTongue);
          if (p.religion) setReligion(p.religion);
          if (p.caste) setCaste(p.caste);
          if (p.gotra) setGotra(p.gotra);
          if (p.manglik) setManglik(p.manglik as any);
          if (p.country) setCountry(p.country);
          if (p.state) setState(p.state);
          if (p.city) setCity(p.city);
          if (p.familyValues) setFamilyValues(p.familyValues as any);
          if (p.familyType) setFamilyType(p.familyType as any);
          if (p.fatherOccupation) setFatherOccupation(p.fatherOccupation);
          if (p.motherOccupation) setMotherOccupation(p.motherOccupation);
          if (p.education) setEducation(p.education);
          if (p.employedIn) setEmployedIn(p.employedIn as any);
          if (p.occupation) setOccupation(p.occupation);
          if (p.annualIncomeBand) setAnnualIncomeBand(p.annualIncomeBand);
          if (typeof p.showIncomeBand === 'boolean') setShowIncomeBand(p.showIncomeBand);
          if (p.photoPrivacy) setPhotoPrivacy(p.photoPrivacy as any);
          if (p.aboutMe) setAboutMe(p.aboutMe);
          if (p.photos && p.photos.length > 0) {
            setPhotos(p.photos);
            const main = p.photos.find((ph) => ph.isMain) || p.photos[0];
            if (main?.url) {
              setSelectedPhotoUri(photoSrc(main, 'hero'));
              setPhotoApprovalStatus(main.approved ? 'approved' : 'pending');
            }
          }
        }

        if (prefRes.status === 'fulfilled' && prefRes.value.data) {
          const pr = prefRes.value.data;
          if (pr.minAge) setPrefMinAge(String(pr.minAge));
          if (pr.maxAge) setPrefMaxAge(String(pr.maxAge));
          if (pr.minHeightCm) setPrefMinHeight(String(pr.minHeightCm));
          if (pr.maxHeightCm) setPrefMaxHeight(String(pr.maxHeightCm));
          if (pr.cities && pr.cities.length > 0) setPrefCities(pr.cities.join(', '));
        }

        // Also fetch identity verification status from server
        try {
          const vHeaders = await getAuthHeader();
          const vJson = await apiClient<any>('/verification/status', { headers: vHeaders });
          if (vJson.success && vJson.data) {
            const vData = vJson.data;
            if (vData.identityVerificationStatus) {
              setIdVerificationStatus(vData.identityVerificationStatus);
            }
            if (vData.identityDocumentType) {
              setIdDocType(vData.identityDocumentType);
            }
            if (vData.identityDocumentReferenceMasked) {
              setIdDocMaskedNumber(vData.identityDocumentReferenceMasked);
            }
          }
        } catch {
          // ignore verification status error
        }

        // Restore draft from AsyncStorage if present
        try {
          const sessionUser = getSessionUser();
          const draftKey = `@bandhansetu/profile_draft_${sessionUser?.id || (sessionUser as any)?._id || 'current'}`;
          const draftRaw = await AsyncStorage.getItem(draftKey);
          if (draftRaw && isMounted) {
            const draft = JSON.parse(draftRaw);
            const p = draft.profilePayload;
            if (p) {
              if (p.firstName && !firstName) setFirstName(p.firstName);
              if (p.lastName && !lastName) setLastName(p.lastName);
              if (p.gender) setGender(p.gender);
              if (p.dateOfBirth && !dateOfBirth) setDateOfBirth(p.dateOfBirth);
              if (p.heightCm && !heightCm) setHeightCm(String(p.heightCm));
              if (p.maritalStatus) setMaritalStatus(p.maritalStatus);
              if (p.motherTongue && !motherTongue) setMotherTongue(p.motherTongue);
              if (p.religion && !religion) setReligion(p.religion);
              if (p.caste && !caste) setCaste(p.caste);
              if (p.gotra && !gotra) setGotra(p.gotra);
              if (p.manglik) setManglik(p.manglik);
              if (p.country && !country) setCountry(p.country);
              if (p.state && !state) setState(p.state);
              if (p.city && !city) setCity(p.city);
              if (p.familyValues) setFamilyValues(p.familyValues);
              if (p.familyType) setFamilyType(p.familyType);
              if (p.fatherOccupation && !fatherOccupation) setFatherOccupation(p.fatherOccupation);
              if (p.motherOccupation && !motherOccupation) setMotherOccupation(p.motherOccupation);
              if (p.education && !education) setEducation(p.education);
              if (p.employedIn) setEmployedIn(p.employedIn);
              if (p.occupation && !occupation) setOccupation(p.occupation);
              if (p.annualIncomeBand && !annualIncomeBand) setAnnualIncomeBand(p.annualIncomeBand);
              if (p.aboutMe && !aboutMe) setAboutMe(p.aboutMe);
              if (p.photos && p.photos.length > 0 && photos.length === 0) {
                setPhotos(p.photos);
                const main = p.photos.find((ph: any) => ph.isMain) || p.photos[0];
                if (main?.url) {
                  setSelectedPhotoUri(photoSrc(main, 'hero'));
                  setPhotoApprovalStatus(main.approved ? 'approved' : 'pending');
                }
              }
            }
            const prDraft = draft.prefPayload;
            if (prDraft) {
              if (prDraft.minAge) setPrefMinAge(String(prDraft.minAge));
              if (prDraft.maxAge) setPrefMaxAge(String(prDraft.maxAge));
              if (prDraft.minHeightCm) setPrefMinHeight(String(prDraft.minHeightCm));
              if (prDraft.maxHeightCm) setPrefMaxHeight(String(prDraft.maxHeightCm));
              if (prDraft.cities && Array.isArray(prDraft.cities)) setPrefCities(prDraft.cities.join(', '));
            }
          }
        } catch {
          // ignore draft load error
        }
      } catch {
        // Fallback to initial values
      }
    };

    loadExistingData();

    return () => {
      isMounted = false;
    };
  }, []);

  const stepTitles = [
    'Basics & Identity',
    'Religion & Community',
    'Location & Living',
    'Family Details',
    'Education & Profession',
    'Photos & Identity Proof',
    'About Myself',
    'Partner Preferences',
  ];

  // Photo Upload Handlers
  const handlePickPhoto = async () => {
    try {
      setPhotoError(null);
      setPhotoSuccess(null);
      const asset = await pickImageFromGallery({ aspect: [1, 1] });
      if (!asset) return;

      setSelectedPhotoUri(asset.uri);
      await uploadProfilePhoto(asset);
    } catch (err: any) {
      setPhotoError(err.message || 'Could not select photo.');
    }
  };

  const handleCapturePhoto = async () => {
    try {
      setPhotoError(null);
      setPhotoSuccess(null);
      const asset = await captureImageWithCamera({ aspect: [1, 1] });
      if (!asset) return;

      setSelectedPhotoUri(asset.uri);
      await uploadProfilePhoto(asset);
    } catch (err: any) {
      setPhotoError(err.message || 'Could not capture photo.');
    }
  };

  const uploadProfilePhoto = async (asset: any) => {
    const token = getSessionToken();
    if (!token) {
      setPhotoError('Authentication expired. Please log in again.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploadResult = await uploadAsset({ token, asset, purpose: 'profile_photo' });

      const newPhoto: PhotoData = {
        url: uploadResult.url || '',
        publicId: uploadResult.publicId,
        variants: uploadResult.variants,
        isMain: true,
        privacy: photoPrivacy,
        approved: false, // Per matrimonial rules, pending moderation
      };

      setPhotos([newPhoto]);
      if (uploadResult.url) {
        setSelectedPhotoUri(uploadResult.url);
      }
      setPhotoApprovalStatus('pending');
      setPhotoSuccess('✓ Photo secured! Pending administrator review.');
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload photo to secure storage.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoUri(null);
    setPhotos([]);
    setPhotoApprovalStatus('none');
    setPhotoSuccess(null);
    setPhotoError(null);
  };

  // Government ID Verification Handlers (Aadhaar, PAN, Voter ID, Passport, Bank Passbook)
  const handlePickIdDoc = async (fromCamera: boolean) => {
    try {
      setIdDocError(null);
      setIdDocSuccess(null);
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow camera/gallery access to upload your identity document.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setIdDocAsset(asset);
        await uploadIdDocument(asset);
      }
    } catch (err: any) {
      setIdDocError(err?.message || 'Could not select identity document.');
    }
  };

  const uploadIdDocument = async (asset: any) => {
    const token = getSessionToken();
    if (!token) {
      setIdDocError('Authentication expired. Please log in again.');
      return;
    }

    setUploadingIdDoc(true);
    setIdUploadPct(0);
    try {
      // 1. Upload private asset to Cloudinary private vault
      const uploadResult = await uploadAsset({
        token,
        asset,
        purpose: 'identity_document',
        onProgress: setIdUploadPct,
      });

      setIdDocStorageKey(uploadResult.fileKey);

      // If document number is filled and consent is granted, submit to /verification/identity
      if (idDocNumber.trim() && idConsentGranted) {
        const headers = await getAuthHeader();
        const json = await apiClient<any>('/verification/identity', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            documentType: idDocType,
            documentReferenceNumber: idDocNumber.trim(),
            documentStorageKey: uploadResult.fileKey,
            consentGranted: true,
            termsVersion: 'v1.0',
          }),
        });
        if (json.success) {
          setIdVerificationStatus('pending');
          setIdDocMaskedNumber(json.data?.documentReferenceMasked || idDocNumber.trim());
          setIdDocSuccess('✓ Document secured in Cloudinary & submitted to Admin Panel! (Pending Review)');
          await syncCurrentUserWithBackend().catch(() => {});
        } else {
          setIdDocSuccess('✓ Document photo uploaded to Cloudinary! Enter document number below & submit.');
        }
      } else {
        setIdDocSuccess('✓ Document photo uploaded to Cloudinary! Enter document number below.');
      }
    } catch (err: any) {
      setIdDocError(err?.message || 'Failed to upload document to secure storage.');
    } finally {
      setUploadingIdDoc(false);
      setIdUploadPct(null);
    }
  };

  const handleSubmitIdVerification = async () => {
    if (!idDocNumber.trim()) {
      Alert.alert('Required Field', 'Please enter your document number (e.g. 12-digit Aadhaar number).');
      return;
    }
    if (!idDocStorageKey && !idDocAsset) {
      Alert.alert('Document Required', 'Please upload a clear photo of your document.');
      return;
    }
    if (!idConsentGranted) {
      Alert.alert('Consent Required', 'Please check the consent box to proceed with verification.');
      return;
    }

    setUploadingIdDoc(true);
    try {
      const token = getSessionToken();
      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        return;
      }

      let storageKey = idDocStorageKey;
      if (!storageKey && idDocAsset) {
        const uploadResult = await uploadAsset({
          token,
          asset: idDocAsset,
          purpose: 'identity_document',
          onProgress: setIdUploadPct,
        });
        storageKey = uploadResult.fileKey;
        setIdDocStorageKey(storageKey);
      }

      if (!storageKey) {
        Alert.alert('Upload Error', 'Could not obtain secure storage key for document.');
        return;
      }

      const headers = await getAuthHeader();
      const json = await apiClient<any>('/verification/identity', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documentType: idDocType,
          documentReferenceNumber: idDocNumber.trim(),
          documentStorageKey: storageKey,
          consentGranted: true,
          termsVersion: 'v1.0',
        }),
      });

      if (json.success) {
        setIdVerificationStatus('pending');
        setIdDocMaskedNumber(json.data?.documentReferenceMasked || idDocNumber.trim());
        setIdDocSuccess('✓ ID Document secured in Cloudinary & submitted to Admin Panel!');
        await syncCurrentUserWithBackend().catch(() => {});
        Alert.alert(
          'Document Submitted! 🛡️',
          'Your identity document has been securely uploaded to Cloudinary and submitted to the Admin Panel for review.'
        );
      } else {
        Alert.alert('Submission Error', json.error?.message || json.message || 'Could not submit verification.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit document to server.');
    } finally {
      setUploadingIdDoc(false);
      setIdUploadPct(null);
    }
  };

  const handleRemoveIdDoc = () => {
    setIdDocAsset(null);
    setIdDocStorageKey(null);
    setIdDocSuccess(null);
    setIdDocError(null);
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      if (!firstName.trim()) {
        Alert.alert('Required Field', 'Please enter your first name.');
        return false;
      }
      if (!lastName.trim()) {
        Alert.alert('Required Field', 'Please enter your last name.');
        return false;
      }
      const dobError = checkDateOfBirth(dateOfBirth);
      if (dobError) {
        const title = dobError === 'format' ? 'Required Field' : 'Invalid Date of Birth';
        const message =
          dobError === 'format'
            ? 'Please enter your date of birth as YYYY-MM-DD.'
            : DATE_OF_BIRTH_MESSAGES[dobError] + '.';
        Alert.alert(title, message);
        return false;
      }
      const h = parseInt(heightCm, 10);
      if (isNaN(h) || h < 100 || h > 250) {
        Alert.alert('Invalid Height', 'Please enter a valid height in centimeters (e.g. 165).');
        return false;
      }
    } else if (currentStep === 2) {
      if (!religion.trim()) {
        Alert.alert('Required Field', 'Please specify your religion.');
        return false;
      }
    } else if (currentStep === 3) {
      if (!city.trim()) {
        Alert.alert('Required Field', 'Please specify your city.');
        return false;
      }
    } else if (currentStep === 5) {
      if (!education.trim()) {
        Alert.alert('Required Field', 'Please specify your education.');
        return false;
      }
      if (!occupation.trim()) {
        Alert.alert('Required Field', 'Please specify your occupation.');
        return false;
      }
    } else if (currentStep === 6) {
      if (photos.length === 0 && !selectedPhotoUri) {
        Alert.alert(
          'Photo Required',
          'A profile photo is compulsory. Please upload a clear photo before proceeding to the next step.'
        );
        return false;
      }
    } else if (currentStep === 8) {
      const minA = parseInt(prefMinAge, 10);
      const maxA = parseInt(prefMaxAge, 10);
      if (isNaN(minA) || isNaN(maxA) || minA < 18 || minA > 80 || maxA < 18 || maxA > 80) {
        Alert.alert('Invalid Age Range', 'Please enter valid minimum and maximum ages between 18 and 80.');
        return false;
      }
      if (minA > maxA) {
        Alert.alert('Invalid Age Range', 'Minimum age cannot be greater than maximum age.');
        return false;
      }
      const minH = parseInt(prefMinHeight, 10);
      const maxH = parseInt(prefMaxHeight, 10);
      if (isNaN(minH) || isNaN(maxH) || minH > maxH) {
        Alert.alert('Invalid Height Range', 'Minimum height cannot be greater than maximum height.');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Step 8: Final Submission to Backend
    // Validate whether mandatory ID document has been submitted or attached
    const isIdUploaded =
      idVerificationStatus === 'pending' ||
      idVerificationStatus === 'verified' ||
      Boolean(idDocStorageKey) ||
      isUserAdminVerified(getSessionUser());

    if (!isIdUploaded) {
      Alert.alert(
        'Identity Document Required 🪪',
        'Mandatory identity verification required. Please upload your Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook to complete your profile.',
        [
          {
            text: 'Upload in Step 6',
            onPress: () => setCurrentStep(6),
          },
          {
            text: 'Open ID Verification Page',
            onPress: () => navigation.navigate('IdentityVerification', { mandatory: true }),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setLoading(true);

    const profilePayload: UpsertProfileInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      dateOfBirth,
      maritalStatus,
      heightCm: parseInt(heightCm, 10) || 160,
      motherTongue: motherTongue.trim(),
      religion: religion.trim(),
      caste: caste.trim() || undefined,
      gotra: gotra.trim() || undefined,
      manglik,
      country: country.trim(),
      state: state.trim(),
      city: city.trim(),
      familyValues,
      familyType,
      fatherOccupation: fatherOccupation.trim() || undefined,
      motherOccupation: motherOccupation.trim() || undefined,
      education: education.trim(),
      employedIn,
      occupation: occupation.trim(),
      annualIncomeBand: annualIncomeBand || (undefined as any),
      showIncomeBand,
      photos: photos.map((p) => ({ ...p, privacy: photoPrivacy })),
      photoPrivacy,
      aboutMe: aboutMe.trim() || 'Seeking an understanding and caring life partner who respects family values and mutual growth.',
    };

    const prefPayload: PartnerPreferencesInput = {
      minAge: parseInt(prefMinAge, 10) || 21,
      maxAge: parseInt(prefMaxAge, 10) || 32,
      minHeightCm: parseInt(prefMinHeight, 10) || 150,
      maxHeightCm: parseInt(prefMaxHeight, 10) || 185,
      maritalStatuses: ['never_married'],
      religions: [religion],
      motherTongues: [motherTongue],
      educations: [education],
      occupations: [],
      cities: prefCities.split(',').map((c) => c.trim()).filter(Boolean),
      manglikPreference: 'any',
    };

    try {
      // Save local draft so user's form inputs are never lost
      try {
        const sessionUser = getSessionUser();
        const draftKey = `@bandhansetu/profile_draft_${sessionUser?.id || (sessionUser as any)?._id || 'current'}`;
        await AsyncStorage.setItem(draftKey, JSON.stringify({ profilePayload, prefPayload, includeKundli }));
      } catch {}

      // Auto-submit ID verification if storage key exists and not yet submitted
      if (idDocStorageKey && idDocNumber.trim() && idVerificationStatus !== 'pending' && idVerificationStatus !== 'verified') {
        try {
          const vHeaders = await getAuthHeader();
          await apiClient<any>('/verification/identity', {
            method: 'POST',
            headers: vHeaders,
            body: JSON.stringify({
              documentType: idDocType,
              documentReferenceNumber: idDocNumber.trim(),
              documentStorageKey: idDocStorageKey,
              consentGranted: true,
              termsVersion: 'v1.0',
            }),
          });
          setIdVerificationStatus('pending');
        } catch {
          // ignore auto-submit error
        }
      }

      let authToken = getSessionToken();
      if (!authToken) {
        authToken = (await refreshSessionTokens()) || '';
      }

      if (!authToken) {
        setLoading(false);
        Alert.alert(
          'Login Required',
          'Your authentication session has expired or is missing. Please log in with OTP to save your profile.',
          [{ text: 'Log In', onPress: () => navigation.navigate('LoginOtp') }]
        );
        return;
      }

      const savedProfile = await upsertMyProfile(authToken, profilePayload);
      await upsertMyPreferences(authToken, prefPayload);
      if (includeKundli) {
        await upsertMyKundli(authToken, {
          dateOfBirth,
          timeOfBirth: birthTime.trim() || '12:00',
          birthPlace: {
            name: birthCity.trim() || city.trim() || 'Delhi',
            state: state.trim() || 'Delhi',
            country: country.trim() || 'India',
          },
          rashi: rashi || RASHI_LIST[0],
          nakshatra: nakshatra || NAKSHATRA_LIST[0],
          manglikStatus: manglik === 'yes' ? 'manglik' : manglik === 'no' ? 'non_manglik' : manglik === 'anshik' ? 'anshik_manglik' : 'dont_know',
          visibility: 'matches_only',
        }).catch(() => {});
      }

      setLoading(false);
      if (savedProfile?.data) {
        setCachedUserProfile(savedProfile.data);
      }
      const completionScore = savedProfile?.data?.completenessPercent || 100;

      // Persist profile completion notification marker
      if (completionScore >= 100) {
        AsyncStorage.setItem('@shaadibanao/profile_completed_notified', 'true').catch(() => {});
      }

      const syncedUser = (await syncCurrentUserWithBackend().catch(() => null)) || getSessionUser();
      const isApproved = isUserAdminVerified(syncedUser);

      Alert.alert(
        isApproved ? '🎉 Profile 100% Complete!' : 'Profile Submitted for Review',
        isApproved
          ? `Badhai ho! Aapka matrimonial profile ab ${completionScore}% complete ho chuka hai. ShaadiBanao me aapka swagat hai!`
          : `Aapka matrimonial profile (${completionScore}% complete) verification review ke liye submit ho chuka hai. Approval ke baad matches unlock ho jayenge.`,
        [
          {
            text: isApproved ? 'Explore Matches' : 'View Review Status',
            onPress: () => {
              if (isApproved) {
                navigation.replace('MainTabs');
              } else {
                navigation.replace('ApprovalPending');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      setLoading(false);
      try {
        const sessionUser = getSessionUser();
        const draftKey = `@bandhansetu/profile_draft_${sessionUser?.id || (sessionUser as any)?._id || 'current'}`;
        await AsyncStorage.setItem(draftKey, JSON.stringify({ profilePayload, prefPayload, includeKundli }));
      } catch {}

      const isIdentityError =
        err?.code === 'IDENTITY_VERIFICATION_REQUIRED' ||
        err?.status === 403 ||
        (typeof err?.message === 'string' &&
          (err.message.includes('Mandatory identity verification required') ||
            err.message.includes('wait for Admin verification')));

      if (isIdentityError) {
        await syncCurrentUserWithBackend().catch(() => {});
        const latestUser = getSessionUser();
        const latestIdStatus = latestUser?.identityVerificationStatus || idVerificationStatus;

        if (latestIdStatus === 'pending' || idDocStorageKey) {
          Alert.alert(
            'Profile & ID Submitted for Review! 🛡️',
            'Your matrimonial profile details and identity document have been safely uploaded to Cloudinary and submitted to the Admin Panel.\n\nOnce Admin verifies your document, your profile will be unlocked for matching and chat!',
            [
              {
                text: 'View Review Status',
                onPress: () => {
                  navigation.replace('ApprovalPending');
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Identity Document Required 🪪',
            'Please upload your Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook before creating your profile.',
            [
              {
                text: 'Upload in Step 6',
                onPress: () => setCurrentStep(6),
              },
              {
                text: 'Open ID Verification Page',
                onPress: () => navigation.navigate('IdentityVerification', { mandatory: true }),
              },
            ]
          );
        }
        return;
      }
      if (err.status === 401 || err.code === 'TOKEN_EXPIRED') {
        const refreshedToken = await refreshSessionTokens();
        if (refreshedToken) {
          try {
            const savedProfile = await upsertMyProfile(refreshedToken, profilePayload);
            await upsertMyPreferences(refreshedToken, prefPayload);
            if (includeKundli) {
              await upsertMyKundli(refreshedToken, {
                dateOfBirth,
                timeOfBirth: birthTime.trim() || '12:00',
                birthPlace: {
                  name: birthCity.trim() || city.trim() || 'Delhi',
                  state: state.trim() || 'Delhi',
                  country: country.trim() || 'India',
                },
                rashi: rashi || RASHI_LIST[0],
                nakshatra: nakshatra || NAKSHATRA_LIST[0],
                manglikStatus: manglik === 'yes' ? 'manglik' : manglik === 'no' ? 'non_manglik' : manglik === 'anshik' ? 'anshik_manglik' : 'dont_know',
                visibility: 'matches_only',
              }).catch(() => {});
            }
            setLoading(false);
            if (savedProfile?.data) {
              setCachedUserProfile(savedProfile.data);
            }
            const completionScore = savedProfile?.data?.completenessPercent || 100;
            if (completionScore >= 100) {
              AsyncStorage.setItem('@shaadibanao/profile_completed_notified', 'true').catch(() => {});
            }
            const user = getSessionUser();
            const isApproved = user?.approvalStatus === 'approved';
            Alert.alert(
              isApproved ? '🎉 Profile 100% Complete!' : 'Profile Submitted for Review',
              isApproved
                ? `Badhai ho! Aapka matrimonial profile ab ${completionScore}% complete ho chuka hai.`
                : `Aapka profile admin review ke liye submit ho gaya hai.`,
              [
                {
                  text: isApproved ? 'Explore Matches' : 'View Review Status',
                  onPress: () => {
                    if (isApproved) {
                      navigation.navigate('MainTabs');
                    } else {
                      navigation.replace('ApprovalPending');
                    }
                  },
                },
              ]
            );
            return;
          } catch (retryErr: any) {
            setLoading(false);
            Alert.alert('Save Failed', retryErr.message || 'Session expired. Please log in again.');
            return;
          }
        }
      }

      setLoading(false);
      Alert.alert('Save Failed', err.message || 'Unable to save profile to server. Please try again.');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs' as any);
      }
    }
  };

  // Modern back button navigation: Step back, or return to Home cleanly
  useEffect(() => {
    const onBackPress = () => {
      if (currentStep > 1) {
        setCurrentStep((prev) => prev - 1);
        return true;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }
      navigation.navigate('MainTabs' as any);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentStep, navigation]);

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  // Reusable Option Chip renderer
  const renderOptionChip = (label: string, isSelected: boolean, onSelect: () => void) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onSelect}
      style={[styles.chip, isSelected && styles.chipSelected]}
    >
      {isSelected && (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={colors.royalMaroon}
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title={`Step ${currentStep} of ${totalSteps}`}
        subtitle={stepTitles[currentStep - 1]}
        onBack={handlePrev}
        showStatusBadge={true}
        variant="royal"
      />

      {/* Dynamic Animated Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progressPercent}% Complete</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* STEP 1: BASICS */}
            {currentStep === 1 && (
              <>
                <Text style={styles.stepHeading}>Basic Personal Details</Text>
                <Text style={styles.stepSub}>
                  In accordance with privacy rules, only your first name and last initial will be visible to other members.
                </Text>

                <Input label="First name *" value={firstName} onChangeText={setFirstName} />
                <Input
                  label="Last name *"
                  value={lastName}
                  onChangeText={setLastName}
                  helperText="Last name is confidential until mutual consent"
                />

                <Text style={styles.fieldLabel}>Gender *</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Female (Bride)', gender === 'female', () => setGender('female'))}
                  {renderOptionChip('Male (Groom)', gender === 'male', () => setGender('male'))}
                </View>

                <DatePickerField
                  label="Date of Birth *"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  minDate={dobLimits.minDate}
                  maxDate={dobLimits.maxDate}
                  defaultDate={dobLimits.defaultInitialDate}
                  helperText="Age is calculated automatically (must be at least 18 years old)"
                  required
                />

                <Input
                  label="Height (in cm) *"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="numeric"
                  helperText="e.g. 163 cm ≈ 5'4&quot;"
                />

                <Input
                  label="Mother Tongue *"
                  value={motherTongue}
                  onChangeText={setMotherTongue}
                  placeholder="e.g. Hindi, Bengali, Punjabi, Tamil"
                />

                <Text style={styles.fieldLabel}>Marital Status *</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Never Married', maritalStatus === 'never_married', () => setMaritalStatus('never_married'))}
                  {renderOptionChip('Divorced', maritalStatus === 'divorced', () => setMaritalStatus('divorced'))}
                  {renderOptionChip('Widowed', maritalStatus === 'widowed', () => setMaritalStatus('widowed'))}
                </View>
              </>
            )}

            {/* STEP 2: RELIGION */}
            {currentStep === 2 && (
              <>
                <Text style={styles.stepHeading}>Religion & Community</Text>
                <Text style={styles.stepSub}>
                  Vedic traditions and family background details for compatible matchmaking.
                </Text>

                <Input label="Religion *" value={religion} onChangeText={setReligion} />
                <Input
                  label="Caste / Community (Optional)"
                  value={caste}
                  onChangeText={setCaste}
                  helperText="Optional field per blueprint guidelines"
                />
                <Input label="Gotra (Optional)" value={gotra} onChangeText={setGotra} />

                <Text style={styles.fieldLabel}>Manglik Status</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Non-Manglik', manglik === 'no', () => setManglik('no'))}
                  {renderOptionChip('Manglik', manglik === 'yes', () => setManglik('yes'))}
                  {renderOptionChip('Anshik Manglik', manglik === 'anshik', () => setManglik('anshik'))}
                  {renderOptionChip("Don't Know", manglik === 'dont_know', () => setManglik('dont_know'))}
                </View>

                {/* Kundli Details Section */}
                <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.headingSemiBold, fontSize: 16, color: colors.charcoal }}>
                        Vedic Kundli Details (Optional)
                      </Text>
                      <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.bodyText }}>
                        Enter birth time and Moon sign for Ashta Koota astrological matchmaking.
                      </Text>
                    </View>
                    <Switch
                      value={includeKundli}
                      onValueChange={setIncludeKundli}
                      trackColor={{ false: colors.borderLight, true: colors.lightGold }}
                      thumbColor={includeKundli ? colors.royalMaroon : '#FFFFFF'}
                    />
                  </View>

                  {includeKundli && (
                    <View style={{ marginTop: spacing.sm }}>
                      <TimePickerField
                        label="Time of Birth *"
                        value={birthTime}
                        onChange={setBirthTime}
                        placeholder="Select Birth Time"
                        helperText="Required for Lagna & Kundli chart computation"
                        required
                      />
                      <Input
                        label="Place of Birth (City)"
                        value={birthCity}
                        onChangeText={setBirthCity}
                        placeholder="e.g. New Delhi"
                      />
                      <Input
                        label="Rashi (Moon Sign)"
                        value={rashi}
                        onChangeText={setRashi}
                        placeholder="e.g. Mesh (Aries)"
                        helperText="Used for Vedic Ashta Koota compatibility"
                      />
                      <Input
                        label="Nakshatra (Birth Star)"
                        value={nakshatra}
                        onChangeText={setNakshatra}
                        placeholder="e.g. Ashwini"
                      />
                    </View>
                  )}
                </View>
              </>
            )}

            {/* STEP 3: LOCATION */}
            {currentStep === 3 && (
              <>
                <Text style={styles.stepHeading}>Location & Living</Text>
                <Text style={styles.stepSub}>
                  Where you currently reside and build your home.
                </Text>

                <Input label="Country *" value={country} onChangeText={setCountry} />
                <Input label="State *" value={state} onChangeText={setState} />
                <Input label="City / Region *" value={city} onChangeText={setCity} />
              </>
            )}

            {/* STEP 4: FAMILY */}
            {currentStep === 4 && (
              <>
                <Text style={styles.stepHeading}>Family Details</Text>
                <Text style={styles.stepSub}>
                  Values and traditions of your parental home.
                </Text>

                <Text style={styles.fieldLabel}>Family Values</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Traditional', familyValues === 'traditional', () => setFamilyValues('traditional'))}
                  {renderOptionChip('Moderate', familyValues === 'moderate', () => setFamilyValues('moderate'))}
                  {renderOptionChip('Liberal', familyValues === 'liberal', () => setFamilyValues('liberal'))}
                </View>

                <Text style={styles.fieldLabel}>Family Type</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Nuclear', familyType === 'nuclear', () => setFamilyType('nuclear'))}
                  {renderOptionChip('Joint Family', familyType === 'joint', () => setFamilyType('joint'))}
                </View>

                <Input label="Father's Occupation" value={fatherOccupation} onChangeText={setFatherOccupation} />
                <Input label="Mother's Occupation" value={motherOccupation} onChangeText={setMotherOccupation} />
              </>
            )}

            {/* STEP 5: EDUCATION & CAREER */}
            {currentStep === 5 && (
              <>
                <Text style={styles.stepHeading}>Education & Career</Text>
                <Text style={styles.stepSub}>
                  Your academic background and professional journey.
                </Text>

                <Input label="Highest Degree *" value={education} onChangeText={setEducation} />

                <Text style={styles.fieldLabel}>Employed In</Text>
                <View style={styles.choiceRow}>
                  {renderOptionChip('Private', employedIn === 'private', () => setEmployedIn('private'))}
                  {renderOptionChip('Government', employedIn === 'government', () => setEmployedIn('government'))}
                  {renderOptionChip('Business', employedIn === 'business', () => setEmployedIn('business'))}
                  {renderOptionChip('Self Employed', employedIn === 'self_employed', () => setEmployedIn('self_employed'))}
                  {renderOptionChip('Not Working', employedIn === 'not_working', () => setEmployedIn('not_working'))}
                </View>

                <Input label="Occupation / Job Title *" value={occupation} onChangeText={setOccupation} />
                <Input label="Annual Income Band" value={annualIncomeBand} onChangeText={setAnnualIncomeBand} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.fieldLabel}>Show Income Band on Profile</Text>
                    <Text style={styles.switchDesc}>Disables exact figures; displays general bracket only</Text>
                  </View>
                  <Switch
                    value={showIncomeBand}
                    onValueChange={setShowIncomeBand}
                    trackColor={{ false: '#E0DCD6', true: colors.royalMaroon }}
                    thumbColor={showIncomeBand ? colors.royalGold : '#FAF7F2'}
                  />
                </View>
              </>
            )}

            {/* STEP 6: PHOTOS & PRIVACY */}
            {currentStep === 6 && (
              <>
                <Text style={styles.stepHeading}>Photos & Privacy Rules * (Compulsory)</Text>
                <Text style={styles.stepSub}>
                  A clear profile photo is compulsory. Profiles with photos get up to 10x more responses.
                </Text>

                {/* Photo Preview & Upload Box */}
                <View style={styles.photoUploadContainer}>
                  {selectedPhotoUri ? (
                    <View style={styles.previewCard}>
                      <Image
                        source={{ uri: photos[0]?.variants?.hero || cloudinaryUrl(selectedPhotoUri, 'hero') }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />

                      {/* Main Photo Badge */}
                      <View style={styles.mainPhotoTag}>
                        <Ionicons name="star" size={11} color="#FFFFFF" />
                        <Text style={styles.mainPhotoTagText}>MAIN PHOTO</Text>
                      </View>

                      {/* Moderation Status Badge */}
                      <View style={[
                        styles.moderationBadge,
                        photoApprovalStatus === 'approved' && styles.moderationBadgeApproved,
                        photoApprovalStatus === 'pending' && styles.moderationBadgePending,
                        photoApprovalStatus === 'rejected' && styles.moderationBadgeRejected,
                      ]}>
                        <Ionicons
                          name={
                            photoApprovalStatus === 'approved'
                              ? 'checkmark-circle'
                              : photoApprovalStatus === 'rejected'
                              ? 'close-circle'
                              : 'time'
                          }
                          size={12}
                          color="#FFFFFF"
                        />
                        <Text style={styles.moderationBadgeText}>
                          {photoApprovalStatus === 'approved'
                            ? 'Approved'
                            : photoApprovalStatus === 'rejected'
                            ? 'Changes Requested'
                            : 'Pending Moderation'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePickPhoto}
                      style={styles.emptyUploadBox}
                    >
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="camera" size={32} color={colors.royalMaroon} />
                      </View>
                      <Text style={styles.uploadBoxTitle}>Select Profile Photo</Text>
                      <Text style={styles.uploadBoxSub}>
                        Clear portrait with bright lighting. JPG, PNG or WEBP up to 5MB.
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Upload Action Buttons */}
                  <View style={styles.photoActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePickPhoto}
                      disabled={uploadingPhoto}
                      style={styles.photoActionButton}
                    >
                      <Ionicons name="images-outline" size={16} color={colors.royalMaroon} />
                      <Text style={styles.photoActionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleCapturePhoto}
                      disabled={uploadingPhoto}
                      style={styles.photoActionButton}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.royalMaroon} />
                      <Text style={styles.photoActionText}>Take Photo</Text>
                    </TouchableOpacity>

                    {selectedPhotoUri && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleRemovePhoto}
                        disabled={uploadingPhoto}
                        style={[styles.photoActionButton, styles.photoActionRemove]}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.alertRed} />
                        <Text style={[styles.photoActionText, { color: colors.alertRed }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Upload Status / Progress */}
                  {uploadingPhoto && (
                    <View style={styles.uploadingBox}>
                      <ActivityIndicator size="small" color={colors.royalMaroon} />
                      <Text style={styles.uploadingText}>Securing and uploading photo...</Text>
                    </View>
                  )}

                  {photoSuccess && (
                    <View style={styles.successMessageBox}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.verifiedGreen} />
                      <Text style={styles.successMessageText}>{photoSuccess}</Text>
                    </View>
                  )}

                  {photoError && (
                    <View style={styles.errorMessageBox}>
                      <Ionicons name="alert-circle" size={16} color={colors.alertRed} />
                      <Text style={styles.errorMessageText}>{photoError}</Text>
                    </View>
                  )}
                </View>

                {/* Privacy Options */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Who can see my photos?</Text>
                {PHOTO_PRIVACY.map((option) => {
                  const isSelected = photoPrivacy === option;
                  const labels: Record<PhotoPrivacy, { title: string; desc: string }> = {
                    everyone: {
                      title: 'Everyone on ShaadiBanao',
                      desc: 'Visible to authenticated, approved logged-in members',
                    },
                    after_interest_accepted: {
                      title: 'After I accept an interest',
                      desc: 'Photos locked until mutual connection is confirmed',
                    },
                    blurred: {
                      title: 'Blurred for everyone',
                      desc: 'Face blurred with manual photo view request option',
                    },
                  };

                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.75}
                      onPress={() => setPhotoPrivacy(option)}
                      style={[styles.radioItem, isSelected && styles.radioItemSelected]}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.radioTitle, isSelected && styles.radioTitleSelected]}>
                          {labels[option].title}
                        </Text>
                        <Text style={styles.radioDesc}>{labels[option].desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Government ID Verification (Aadhaar / PAN / Voter ID / Passport / Bank Passbook) */}
                <View style={styles.idDocCard}>
                  <View style={styles.idDocHeaderRow}>
                    <View style={styles.idDocHeaderIcon}>
                      <Ionicons name="shield-checkmark" size={20} color={colors.royalMaroon} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.idDocHeading}>Government ID Document (Compulsory KYC) 🪪</Text>
                      <Text style={styles.idDocSubText}>
                        Upload Aadhaar Card, PAN Card, Voter ID, Passport, or Bank Passbook. Admin verifies this document before activating your profile.
                      </Text>
                    </View>
                  </View>

                  {/* Verification Status Pill */}
                  <View style={styles.idStatusRow}>
                    <View
                      style={[
                        styles.idStatusPill,
                        idVerificationStatus === 'verified' && styles.idStatusPillVerified,
                        idVerificationStatus === 'pending' && styles.idStatusPillPending,
                        idVerificationStatus === 'rejected' && styles.idStatusPillRejected,
                      ]}
                    >
                      <Ionicons
                        name={
                          idVerificationStatus === 'verified'
                            ? 'checkmark-circle'
                            : idVerificationStatus === 'rejected'
                            ? 'close-circle'
                            : idVerificationStatus === 'pending'
                            ? 'hourglass-outline'
                            : 'alert-circle-outline'
                        }
                        size={14}
                        color={
                          idVerificationStatus === 'verified'
                            ? '#16a34a'
                            : idVerificationStatus === 'rejected'
                            ? '#dc2626'
                            : idVerificationStatus === 'pending'
                            ? '#d97706'
                            : colors.royalMaroon
                        }
                      />
                      <Text
                        style={[
                          styles.idStatusPillText,
                          idVerificationStatus === 'verified' && { color: '#16a34a' },
                          idVerificationStatus === 'pending' && { color: '#d97706' },
                          idVerificationStatus === 'rejected' && { color: '#dc2626' },
                        ]}
                      >
                        {idVerificationStatus === 'verified'
                          ? `Verified by Admin ✓ (${idDocMaskedNumber || 'ID Verified'})`
                          : idVerificationStatus === 'pending'
                          ? `Uploaded — Pending Admin Review ⏳ (${idDocMaskedNumber || 'Under Review'})`
                          : idVerificationStatus === 'rejected'
                          ? 'Document Rejected (Please Re-upload)'
                          : 'ID Document Required *'}
                      </Text>
                    </View>
                  </View>

                  {/* Document Type Selector Chips */}
                  <Text style={styles.fieldLabel}>Select Document Type *</Text>
                  <View style={styles.choiceRow}>
                    {ID_DOCUMENT_OPTIONS.map((docOpt) => (
                      <TouchableOpacity
                        key={docOpt.key}
                        activeOpacity={0.8}
                        onPress={() => setIdDocType(docOpt.key)}
                        style={[styles.chip, idDocType === docOpt.key && styles.chipSelected]}
                      >
                        <Ionicons
                          name={idDocType === docOpt.key ? 'checkmark-circle' : 'document-text-outline'}
                          size={14}
                          color={idDocType === docOpt.key ? colors.royalMaroon : colors.textMuted}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.chipText, idDocType === docOpt.key && styles.chipTextSelected]}>
                          {docOpt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Document Number Input */}
                  {(() => {
                    const activeDoc = ID_DOCUMENT_OPTIONS.find((d) => d.key === idDocType) || ID_DOCUMENT_OPTIONS[0];
                    return (
                      <Input
                        label={activeDoc.inputLabel}
                        placeholder={activeDoc.placeholder}
                        value={idDocNumber}
                        onChangeText={setIdDocNumber}
                        keyboardType={activeDoc.keyboardType}
                        maxLength={activeDoc.maxLength}
                        helperText="Your document number is strictly masked & encrypted before storage."
                      />
                    );
                  })()}

                  {/* Document Photo Preview or Empty Box */}
                  <Text style={styles.fieldLabel}>Document Front Photo *</Text>
                  {idDocAsset || idDocStorageKey ? (
                    <View style={styles.idDocPreviewCard}>
                      {idDocAsset?.uri ? (
                        <Image
                          source={{ uri: idDocAsset.uri }}
                          style={styles.idDocPreviewImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="document-text" size={48} color={colors.royalGold} />
                          <Text style={{ color: '#FFFFFF', marginTop: 8, fontSize: 13, fontFamily: fonts.bodyMedium }}>
                            Document securely saved in vault
                          </Text>
                        </View>
                      )}
                      <View style={styles.idDocPreviewTag}>
                        <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                        <Text style={styles.idDocPreviewTagText}>DOCUMENT ATTACHED</Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handlePickIdDoc(false)}
                      style={styles.emptyIdDocBox}
                    >
                      <View style={styles.idUploadIconCircle}>
                        <Ionicons name="id-card-outline" size={32} color={colors.royalMaroon} />
                      </View>
                      <Text style={styles.uploadBoxTitle}>Upload Identity Document Photo</Text>
                      <Text style={styles.uploadBoxSub}>
                        Clear photo of front side (Aadhaar / PAN / Voter ID / Passport / Passbook). Uploads to Cloudinary.
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Document Action Buttons */}
                  <View style={styles.photoActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handlePickIdDoc(false)}
                      disabled={uploadingIdDoc}
                      style={styles.photoActionButton}
                    >
                      <Ionicons name="images-outline" size={16} color={colors.royalMaroon} />
                      <Text style={styles.photoActionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handlePickIdDoc(true)}
                      disabled={uploadingIdDoc}
                      style={styles.photoActionButton}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.royalMaroon} />
                      <Text style={styles.photoActionText}>Take Photo</Text>
                    </TouchableOpacity>

                    {(idDocAsset || idDocStorageKey) && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleRemoveIdDoc}
                        disabled={uploadingIdDoc}
                        style={[styles.photoActionButton, styles.photoActionRemove]}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.alertRed} />
                        <Text style={[styles.photoActionText, { color: colors.alertRed }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Upload Progress */}
                  {uploadingIdDoc && (
                    <View style={styles.uploadingBox}>
                      <ActivityIndicator size="small" color={colors.royalMaroon} />
                      <Text style={styles.uploadingText}>
                        Securing & uploading document to Cloudinary Private Vault...
                        {idUploadPct !== null ? ` (${idUploadPct}%)` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Success & Error messages */}
                  {idDocSuccess && (
                    <View style={styles.successMessageBox}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.verifiedGreen} />
                      <Text style={styles.successMessageText}>{idDocSuccess}</Text>
                    </View>
                  )}

                  {idDocError && (
                    <View style={styles.errorMessageBox}>
                      <Ionicons name="alert-circle" size={16} color={colors.alertRed} />
                      <Text style={styles.errorMessageText}>{idDocError}</Text>
                    </View>
                  )}

                  {/* Explicit Verification Consent Switch */}
                  <View style={[styles.switchRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#ECE2D4' }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Identity Verification Consent *</Text>
                      <Text style={styles.switchDesc}>
                        I authorize ShaadiBanao administrators to verify this document solely for identity verification and anti-fraud purposes.
                      </Text>
                    </View>
                    <Switch
                      value={idConsentGranted}
                      onValueChange={setIdConsentGranted}
                      trackColor={{ false: '#E0DCD6', true: colors.royalMaroon }}
                      thumbColor={idConsentGranted ? colors.royalGold : '#FAF7F2'}
                    />
                  </View>

                  {/* Submit Document Now Button */}
                  {(idDocAsset || idDocStorageKey) && idDocNumber.trim().length > 0 && idVerificationStatus !== 'verified' && (
                    <View style={{ marginTop: 14 }}>
                      <Button
                        title={idVerificationStatus === 'pending' ? '✓ Re-submit Document to Admin' : 'Submit ID Document to Admin Panel'}
                        onPress={handleSubmitIdVerification}
                        loading={uploadingIdDoc}
                        variant="primary"
                        style={{ minHeight: 46 }}
                      />
                    </View>
                  )}
                </View>
              </>
            )}

            {/* STEP 7: ABOUT MYSELF */}
            {currentStep === 7 && (
              <>
                <Text style={styles.stepHeading}>About Myself</Text>
                <Text style={styles.stepSub}>
                  Express your lifestyle, family values, and what kind of life partner you envision.
                </Text>

                <Input
                  label="Self Bio *"
                  value={aboutMe}
                  onChangeText={setAboutMe}
                  multiline
                  numberOfLines={5}
                  style={{ height: 120, textAlignVertical: 'top' }}
                  helperText="Recommended: 50-200 words sharing your passions, values and expectations."
                />
              </>
            )}

            {/* STEP 8: PARTNER PREFERENCES */}
            {currentStep === 8 && (
              <>
                <Text style={styles.stepHeading}>Partner Preferences</Text>
                <Text style={styles.stepSub}>
                  Helps our Vedic & modern algorithms recommend compatible matches.
                </Text>

                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Input
                    label="Min Age *"
                    value={prefMinAge}
                    onChangeText={setPrefMinAge}
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Max Age *"
                    value={prefMaxAge}
                    onChangeText={setPrefMaxAge}
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Input
                    label="Min Height (cm) *"
                    value={prefMinHeight}
                    onChangeText={setPrefMinHeight}
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Max Height (cm) *"
                    value={prefMaxHeight}
                    onChangeText={setPrefMaxHeight}
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                </View>

                <Input
                  label="Preferred Cities (comma-separated)"
                  value={prefCities}
                  onChangeText={setPrefCities}
                  placeholder="e.g. Delhi NCR, Mumbai, Bangalore"
                />
              </>
            )}

            {/* Navigational Footer Buttons */}
            <View style={styles.buttonRow}>
              {currentStep > 1 && (
                <Button
                  title="Back"
                  onPress={handlePrev}
                  variant="secondary"
                  disabled={loading}
                  style={styles.halfBtn}
                />
              )}
              <Button
                title={currentStep === totalSteps ? 'Save & Finish' : 'Next Step →'}
                onPress={handleNext}
                loading={loading}
                variant="primary"
                style={currentStep > 1 ? styles.halfBtn : styles.fullBtn}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DC',
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#EFE7DA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.royalMaroon,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.royalMaroon,
    marginTop: 4,
    textAlign: 'right',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 72,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.lg + 2,
    borderWidth: 1,
    borderColor: '#ECE3D5',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  stepHeading: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.royalMaroon,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  stepSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.bodyText,
    lineHeight: 19,
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.charcoal,
    marginBottom: 8,
    marginTop: 6,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.base,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E2D8CA',
    backgroundColor: '#FAF7F2',
  },
  chipSelected: {
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
    backgroundColor: '#FFF0F4',
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.charcoal,
  },
  chipTextSelected: {
    fontFamily: fonts.bodySemiBold,
    color: colors.royalMaroon,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3EDE2',
    marginTop: 4,
  },
  switchDesc: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  photoUploadContainer: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1.2,
    borderColor: '#ECE2D4',
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  previewCard: {
    position: 'relative',
    width: 150,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.goldBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  mainPhotoTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(122, 21, 40, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mainPhotoTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  moderationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  moderationBadgeApproved: {
    backgroundColor: '#16a34a',
  },
  moderationBadgePending: {
    backgroundColor: '#d97706',
  },
  moderationBadgeRejected: {
    backgroundColor: '#dc2626',
  },
  moderationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyUploadBox: {
    width: '100%',
    paddingVertical: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8CBBA',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#FAF5ED',
    marginBottom: spacing.md,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3E9DA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.royalMaroon,
    marginBottom: 4,
  },
  uploadBoxSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8CEBF',
    backgroundColor: '#FFFFFF',
  },
  photoActionRemove: {
    borderColor: '#F8D3DC',
    backgroundColor: '#FFF5F7',
  },
  photoActionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.charcoal,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  uploadingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.royalMaroon,
  },
  successMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#EDFDF2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  successMessageText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.verifiedGreen,
  },
  errorMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  errorMessageText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.alertRed,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E6DDD1',
    marginBottom: spacing.sm,
    backgroundColor: '#FAF7F2',
  },
  radioItemSelected: {
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
    backgroundColor: '#FFF0F4',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C4B8A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: colors.royalMaroon,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.royalMaroon,
  },
  radioTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.charcoal,
  },
  radioTitleSelected: {
    color: colors.royalMaroon,
  },
  radioDesc: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.xl,
  },
  halfBtn: {
    flex: 1,
    minHeight: 50,
  },
  fullBtn: {
    width: '100%',
    minHeight: 50,
  },
  // Identity Document Card & Preview Styles
  idDocCard: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1.2,
    borderColor: '#ECE2D4',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.base,
  },
  idDocHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  idDocHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E9DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idDocHeading: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.royalMaroon,
    marginBottom: 2,
  },
  idDocSubText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  idStatusRow: {
    marginVertical: 8,
  },
  idStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FAF3F5',
    borderWidth: 1,
    borderColor: '#E8D4DC',
  },
  idStatusPillVerified: {
    backgroundColor: '#EDFDF2',
    borderColor: '#C6F6D5',
  },
  idStatusPillPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  idStatusPillRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  idStatusPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.royalMaroon,
  },
  idDocPreviewCard: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.goldBorder,
    marginBottom: spacing.md,
    backgroundColor: '#1C1917',
  },
  idDocPreviewImg: {
    width: '100%',
    height: '100%',
  },
  idDocPreviewTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(122, 21, 40, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  idDocPreviewTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  emptyIdDocBox: {
    width: '100%',
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8CBBA',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
  },
  idUploadIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F7EFE3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
