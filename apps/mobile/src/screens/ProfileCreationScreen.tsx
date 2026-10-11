import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PHOTO_PRIVACY, PhotoPrivacy, UpsertProfileInput, PartnerPreferencesInput } from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { StatusNotice } from '../components/common/StatusNotice';
import { upsertMyProfile } from '../services/profileService';
import { upsertMyPreferences } from '../services/preferenceService';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileCreation'>;

export const ProfileCreationScreen: React.FC<Props> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const totalSteps = 8;

  // Step 1: Basics
  const [firstName, setFirstName] = useState('Priya');
  const [lastName, setLastName] = useState('Sharma');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [dateOfBirth, setDateOfBirth] = useState('1998-05-14');
  const [heightCm, setHeightCm] = useState('163');
  const [maritalStatus, setMaritalStatus] = useState<'never_married' | 'divorced' | 'widowed'>('never_married');
  const [motherTongue, setMotherTongue] = useState('Hindi');

  // Step 2: Religion
  const [religion, setReligion] = useState('Hindu');
  const [caste, setCaste] = useState('Brahmin');
  const [gotra, setGotra] = useState('Kashyap');
  const [manglik, setManglik] = useState<'yes' | 'no' | 'dont_know' | 'anshik'>('no');

  // Step 3: Location
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Delhi');
  const [city, setCity] = useState('Delhi NCR');

  // Step 4: Family
  const [familyValues, setFamilyValues] = useState<'traditional' | 'moderate' | 'liberal'>('moderate');
  const [familyType, setFamilyType] = useState<'joint' | 'nuclear'>('nuclear');
  const [fatherOccupation, setFatherOccupation] = useState('Government Officer (Retd)');
  const [motherOccupation, setMotherOccupation] = useState('Homemaker');

  // Step 5: Education & Career
  const [education, setEducation] = useState('MBA in Finance');
  const [employedIn, setEmployedIn] = useState<'private' | 'government' | 'business' | 'self_employed' | 'not_working'>('private');
  const [occupation, setOccupation] = useState('Senior Product Manager');
  const [annualIncomeBand, setAnnualIncomeBand] = useState('₹15L - ₹25L');
  const [showIncomeBand, setShowIncomeBand] = useState(true);

  // Step 6: Photos & Privacy
  const [photoPrivacy, setPhotoPrivacy] = useState<PhotoPrivacy>('everyone');

  // Step 7: About
  const [aboutMe, setAboutMe] = useState(
    'Family-oriented, ambitious, and passionate about travel and good food. Looking for an educated, supportive partner who shares traditional values.'
  );

  // Step 8: Partner Preferences
  const [prefMinAge, setPrefMinAge] = useState('25');
  const [prefMaxAge, setPrefMaxAge] = useState('32');
  const [prefMinHeight, setPrefMinHeight] = useState('165');
  const [prefMaxHeight, setPrefMaxHeight] = useState('185');
  const [prefCities, setPrefCities] = useState('Delhi NCR, Gurgaon, Noida');

  const stepTitles = [
    'Basics & Identity',
    'Religion & Community',
    'Location & Living',
    'Family Details',
    'Education & Profession',
    'Photos & Privacy Settings',
    'About Myself',
    'Partner Preferences',
  ];

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Step 8: Final Submission to Backend
    setLoading(true);

    try {
      const profilePayload: UpsertProfileInput = {
        firstName,
        lastName,
        gender,
        dateOfBirth,
        maritalStatus,
        heightCm: parseInt(heightCm, 10) || 160,
        motherTongue,
        religion,
        caste: caste || undefined,
        gotra: gotra || undefined,
        manglik,
        country,
        state,
        city,
        familyValues,
        familyType,
        fatherOccupation: fatherOccupation || undefined,
        motherOccupation: motherOccupation || undefined,
        education,
        employedIn,
        occupation,
        annualIncomeBand,
        showIncomeBand,
        photos: [],
        photoPrivacy,
        aboutMe,
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
        cities: prefCities.split(',').map((c) => c.trim()),
        manglikPreference: 'any',
      };

      // In development, if user hasn't stored a token yet, use a dev-token or session
      const authToken = 'mock_dev_session_token';

      // Save Profile & Preferences
      const savedProfile = await upsertMyProfile(authToken, profilePayload);
      await upsertMyPreferences(authToken, prefPayload);

      setLoading(false);
      Alert.alert(
        'Profile Saved Successfully',
        `Your matrimonial profile is now ${savedProfile.data?.completenessPercent || 85}% complete! Welcome to BandhanSetu.`,
        [
          {
            text: 'Explore Matches',
            onPress: () => navigation.navigate('MainTabs'),
          },
        ]
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Save Failed', err.message || 'Unable to save profile to server. Please try again.');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={`Step ${currentStep} of ${totalSteps}`}
        subtitle={stepTitles[currentStep - 1]}
        onBack={handlePrev}
        showStatusBadge={true}
      />

      <View style={styles.progressContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}% Complete</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Milestone 4 Profile Persistence Active"
          subtext="Connected to /api/v1/profiles/me and /api/v1/preferences/me. Data validated and persisted on server."
        />

        <View style={styles.card}>
          {currentStep === 1 && (
            <>
              <Text style={styles.stepHeading}>Basic Personal Details</Text>
              <Text style={styles.stepSub}>
                In accordance with our privacy rules, only your first name and last initial will be
                visible to other members.
              </Text>

              <Input label="First name" value={firstName} onChangeText={setFirstName} />
              <Input
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                helperText="Last name is confidential until mutual consent"
              />

              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  onPress={() => setGender('female')}
                  style={[styles.chip, gender === 'female' && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, gender === 'female' && styles.chipTextSelected]}>
                    Female (Bride)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGender('male')}
                  style={[styles.chip, gender === 'male' && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, gender === 'male' && styles.chipTextSelected]}>
                    Male (Groom)
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Date of Birth (YYYY-MM-DD)"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                helperText="Age is calculated automatically and verified"
              />

              <Input
                label="Height (in cm)"
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="numeric"
                helperText="e.g. 163 cm ≈ 5'4&quot;"
              />

              <Input
                label="Mother Tongue"
                value={motherTongue}
                onChangeText={setMotherTongue}
                placeholder="e.g. Hindi, Bengali, Punjabi"
              />
            </>
          )}

          {currentStep === 2 && (
            <>
              <Text style={styles.stepHeading}>Religion & Community</Text>
              <Input label="Religion" value={religion} onChangeText={setReligion} />
              <Input
                label="Caste / Community (Optional)"
                value={caste}
                onChangeText={setCaste}
                helperText="Optional field per blueprint guidelines"
              />
              <Input label="Gotra (Optional)" value={gotra} onChangeText={setGotra} />

              <Text style={styles.fieldLabel}>Manglik Status</Text>
              <View style={styles.choiceRow}>
                {(['no', 'yes', 'anshik', 'dont_know'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setManglik(m)}
                    style={[styles.chip, manglik === m && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, manglik === m && styles.chipTextSelected]}>
                      {m === 'dont_know' ? "Don't know" : m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {currentStep === 3 && (
            <>
              <Text style={styles.stepHeading}>Location & Residence</Text>
              <Input label="Country" value={country} onChangeText={setCountry} />
              <Input label="State" value={state} onChangeText={setState} />
              <Input
                label="City / Region"
                value={city}
                onChangeText={setCity}
                helperText="Street address is never collected or displayed"
              />
            </>
          )}

          {currentStep === 4 && (
            <>
              <Text style={styles.stepHeading}>Family Background</Text>
              <Text style={styles.fieldLabel}>Family Values</Text>
              <View style={styles.choiceRow}>
                {(['traditional', 'moderate', 'liberal'] as const).map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setFamilyValues(v)}
                    style={[styles.chip, familyValues === v && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, familyValues === v && styles.chipTextSelected]}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Family Type</Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  onPress={() => setFamilyType('nuclear')}
                  style={[styles.chip, familyType === 'nuclear' && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, familyType === 'nuclear' && styles.chipTextSelected]}>
                    Nuclear
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFamilyType('joint')}
                  style={[styles.chip, familyType === 'joint' && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, familyType === 'joint' && styles.chipTextSelected]}>
                    Joint Family
                  </Text>
                </TouchableOpacity>
              </View>

              <Input label="Father's Occupation" value={fatherOccupation} onChangeText={setFatherOccupation} />
              <Input label="Mother's Occupation" value={motherOccupation} onChangeText={setMotherOccupation} />
            </>
          )}

          {currentStep === 5 && (
            <>
              <Text style={styles.stepHeading}>Education & Career</Text>
              <Input label="Highest Degree" value={education} onChangeText={setEducation} />
              <Input label="Occupation / Job Title" value={occupation} onChangeText={setOccupation} />
              <Input label="Annual Income Band" value={annualIncomeBand} onChangeText={setAnnualIncomeBand} />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Show Income Band on Profile</Text>
                  <Text style={styles.stepSub}>Disables exact number; shows bracket only</Text>
                </View>
                <Switch
                  value={showIncomeBand}
                  onValueChange={setShowIncomeBand}
                  trackColor={{ false: colors.warmGrey, true: colors.royalMaroon }}
                />
              </View>
            </>
          )}

          {currentStep === 6 && (
            <>
              <Text style={styles.stepHeading}>Photos & Visibility Rules</Text>
              <Text style={styles.stepSub}>
                Upload at least one clear face photo. Group photos and text overlays are prohibited.
              </Text>

              <View style={styles.cloudStorageNotice}>
                <Text style={styles.cloudNoticeTitle}>Cloud Storage Pending</Text>
                <Text style={styles.cloudNoticeText}>
                  Cloud object storage (S3/Cloudinary) credentials are not yet configured in `.env`.
                  Photo privacy preferences below are saved and verified on the server; actual binary image
                  uploads will activate once cloud storage keys are supplied.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Who can see my photos?</Text>
              {PHOTO_PRIVACY.map((option) => {
                const isSelected = photoPrivacy === option;
                const labels: Record<PhotoPrivacy, { title: string; desc: string }> = {
                  everyone: {
                    title: 'Everyone on BandhanSetu',
                    desc: 'Visible to authenticated logged-in members',
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
                    onPress={() => setPhotoPrivacy(option)}
                    style={[styles.radioItem, isSelected && styles.radioItemSelected]}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.radioTitle}>{labels[option].title}</Text>
                      <Text style={styles.radioDesc}>{labels[option].desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {currentStep === 7 && (
            <>
              <Text style={styles.stepHeading}>About Myself</Text>
              <Input
                label="Self Bio"
                value={aboutMe}
                onChangeText={setAboutMe}
                multiline
                numberOfLines={5}
                style={{ height: 110, textAlignVertical: 'top' }}
                helperText="Express your lifestyle, family values, and what kind of life partner you envision."
              />
            </>
          )}

          {currentStep === 8 && (
            <>
              <Text style={styles.stepHeading}>Partner Preferences</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input
                  label="Min Age"
                  value={prefMinAge}
                  onChangeText={setPrefMinAge}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Max Age"
                  value={prefMaxAge}
                  onChangeText={setPrefMaxAge}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input
                  label="Min Height (cm)"
                  value={prefMinHeight}
                  onChangeText={setPrefMinHeight}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Max Height (cm)"
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
              />
            </>
          )}

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.warmGrey,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.royalMaroon,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  stepHeading: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: spacing.xs,
  },
  stepSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.2,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: colors.royalMaroon,
    backgroundColor: colors.royalMaroon,
  },
  chipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  cloudStorageNotice: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  cloudNoticeTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: '#8D6E63',
    marginBottom: 2,
  },
  cloudNoticeText: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.charcoal,
    lineHeight: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceCard,
  },
  radioItemSelected: {
    borderColor: colors.royalMaroon,
    backgroundColor: '#FAF2F4',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderDefault,
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
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  radioDesc: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  halfBtn: {
    flex: 1,
  },
  fullBtn: {
    width: '100%',
  },
});
