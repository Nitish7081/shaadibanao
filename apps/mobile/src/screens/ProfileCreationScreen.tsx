import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PHOTO_PRIVACY, PhotoPrivacy } from '@bandhansetu/shared';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileCreation'>;

export const ProfileCreationScreen: React.FC<Props> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 8;

  // Step 1 State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [heightCm, setHeightCm] = useState('162');

  // Step 6 State (Photo privacy)
  const [photoPrivacy, setPhotoPrivacy] = useState<PhotoPrivacy>('everyone');

  const stepTitles = [
    'Basics & Identity',
    'Religion & Mother Tongue',
    'Location & Living',
    'Family Details',
    'Education & Profession',
    'Photos & Privacy Settings',
    'About Myself',
    'Partner Preferences',
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      Alert.alert(
        'Profile Saved',
        'Your profile has been created! (Backend persistence will be linked in Milestone 4).'
      );
      navigation.navigate('MainTabs');
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

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}% Complete</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Profile Management: Milestone 4"
          subtext="Wizard UI and client validation active. Full database storage with photo signed URLs will be enabled in Milestone 4."
        />

        <View style={styles.card}>
          {currentStep === 1 && (
            <>
              <Text style={styles.stepHeading}>Basic Personal Details</Text>
              <Text style={styles.stepSub}>
                In accordance with our privacy rules, only your first name and last initial will be
                visible to other members.
              </Text>

              <Input
                label="First name"
                placeholder="e.g. Priya"
                value={firstName}
                onChangeText={setFirstName}
              />

              <Input
                label="Last name"
                placeholder="e.g. Sharma"
                value={lastName}
                onChangeText={setLastName}
                helperText="Last name remains confidential until mutual consent"
              />

              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  onPress={() => setGender('female')}
                  style={[styles.genderChip, gender === 'female' && styles.genderChipSelected]}
                >
                  <Text style={[styles.genderText, gender === 'female' && styles.genderTextSelected]}>
                    Female (Bride)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGender('male')}
                  style={[styles.genderChip, gender === 'male' && styles.genderChipSelected]}
                >
                  <Text style={[styles.genderText, gender === 'male' && styles.genderTextSelected]}>
                    Male (Groom)
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Height (in cm)"
                placeholder="165"
                keyboardType="numeric"
                value={heightCm}
                onChangeText={setHeightCm}
                helperText="e.g. 165 cm = 5'5&quot;"
              />
            </>
          )}

          {currentStep === 2 && (
            <>
              <Text style={styles.stepHeading}>Religion & Language</Text>
              <Input label="Religion" placeholder="e.g. Hindu / Jain / Sikh" />
              <Input label="Mother Tongue" placeholder="e.g. Hindi / Marathi / Bengali" />
              <Input
                label="Community / Caste (Optional)"
                placeholder="e.g. Brahmin / Agarwal"
                helperText="Optional field. Display is completely under your control."
              />
            </>
          )}

          {currentStep === 3 && (
            <>
              <Text style={styles.stepHeading}>Location & Residence</Text>
              <Input label="Country" placeholder="India" />
              <Input label="State" placeholder="Delhi" />
              <Input
                label="City / Region"
                placeholder="Delhi NCR"
                helperText="Street address is never collected or displayed"
              />
            </>
          )}

          {currentStep === 4 && (
            <>
              <Text style={styles.stepHeading}>Family Background</Text>
              <Input label="Family Values" placeholder="Traditional / Moderate / Liberal" />
              <Input label="Family Type" placeholder="Joint / Nuclear" />
              <Input label="Father's Occupation" placeholder="e.g. Retired Govt Officer / Business" />
            </>
          )}

          {currentStep === 5 && (
            <>
              <Text style={styles.stepHeading}>Education & Career</Text>
              <Input label="Highest Degree" placeholder="e.g. MBA / B.Tech / MBBS" />
              <Input label="Employed In" placeholder="Private Company / Public Sector / Business" />
              <Input label="Occupation / Title" placeholder="e.g. Product Manager" />
              <Input
                label="Annual Income Band"
                placeholder="e.g. ₹15L - ₹25L"
                helperText="Specific salary is never displayed; only general income range"
              />
            </>
          )}

          {currentStep === 6 && (
            <>
              <Text style={styles.stepHeading}>Photos & Visibility Rules</Text>
              <Text style={styles.stepSub}>
                Upload at least one clear face photo. Group photos and text overlays are prohibited.
              </Text>

              {/* Photo Upload Slots Grid */}
              <View style={styles.photoGrid}>
                <View style={[styles.photoSlot, styles.photoSlotMain]}>
                  <Text style={styles.photoSlotLabel}>Main Photo</Text>
                  <Text style={styles.photoAddIcon}>+ Upload</Text>
                </View>
                <View style={styles.photoSlot}>
                  <Text style={styles.photoAddIcon}>+ Add</Text>
                </View>
                <View style={styles.photoSlot}>
                  <Text style={styles.photoAddIcon}>+ Add</Text>
                </View>
              </View>

              {/* Photo Privacy Options (Blueprint S-05) */}
              <Text style={styles.privacyHeading}>Who can see my photos?</Text>
              {PHOTO_PRIVACY.map((option) => {
                const isSelected = photoPrivacy === option;
                const labels: Record<PhotoPrivacy, { title: string; desc: string }> = {
                  everyone: {
                    title: 'Everyone on BandhanSetu',
                    desc: 'Visible to all authenticated members',
                  },
                  after_interest_accepted: {
                    title: 'After I accept an interest',
                    desc: 'Visible only after mutual consent',
                  },
                  blurred: {
                    title: 'Blurred for everyone',
                    desc: 'Unblurred only upon special request and approval',
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
                    <View style={styles.radioTextContainer}>
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
                label="Self Description"
                placeholder="Write a warm, family-friendly overview about your lifestyle, interests, and what you value in a life partner..."
                multiline
                numberOfLines={5}
                style={{ height: 110, textAlignVertical: 'top' }}
              />
            </>
          )}

          {currentStep === 8 && (
            <>
              <Text style={styles.stepHeading}>Partner Preferences</Text>
              <Input label="Preferred Age Range" placeholder="24 to 29 years" />
              <Input label="Preferred Height Range" placeholder="5'2&quot; to 5'8&quot;" />
              <Input label="Preferred Education" placeholder="Postgraduate / Graduate" />
              <Input label="Preferred Cities" placeholder="Delhi NCR, Mumbai, Bangalore" />
            </>
          )}

          {/* Navigation Controls */}
          <View style={styles.buttonRow}>
            {currentStep > 1 && (
              <Button
                title="Back"
                onPress={handlePrev}
                variant="secondary"
                style={styles.halfBtn}
              />
            )}
            <Button
              title={currentStep === totalSteps ? 'Finish & Save' : 'Next Step →'}
              onPress={handleNext}
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
    paddingBottom: spacing['3xl'],
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
    marginBottom: spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  genderChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.2,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
  },
  genderChipSelected: {
    borderColor: colors.royalMaroon,
    backgroundColor: colors.royalMaroon,
  },
  genderText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  genderTextSelected: {
    color: '#FFFFFF',
  },
  photoGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  photoSlot: {
    flex: 1,
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotMain: {
    borderColor: colors.softGold,
    backgroundColor: '#FFFDF9',
  },
  photoSlotLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.softGold,
    marginBottom: 4,
  },
  photoAddIcon: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.royalMaroon,
  },
  privacyHeading: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.sm,
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
  radioTextContainer: {
    flex: 1,
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
