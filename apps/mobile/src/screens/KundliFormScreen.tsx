import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RASHI_LIST, NAKSHATRA_LIST } from '@bandhansetu/shared';
import { DatePickerField } from '../components/common/DatePickerField';
import { TimePickerField } from '../components/common/TimePickerField';
import { getDobDateLimits, isValidDob } from '../utils/dateTimeHelpers';
import { ds, PressableScale } from '../design';
import { API_BASE, getAuthHeader } from '../services/authSession';

export const KundliFormScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const dobLimits = getDobDateLimits();
  const [dateOfBirth, setDateOfBirth] = useState('1998-05-15');
  const [timeOfBirth, setTimeOfBirth] = useState('14:30');
  const [isApproximate, setIsApproximate] = useState(false);
  const [cityName, setCityName] = useState('Delhi');
  const [stateName, setStateName] = useState('Delhi NCR');
  const [rashi, setRashi] = useState<string>(RASHI_LIST[0]);
  const [nakshatra, setNakshatra] = useState<string>(NAKSHATRA_LIST[0]);
  const [charan, setCharan] = useState('1');
  const [manglikStatus, setManglikStatus] = useState<
    'non_manglik' | 'manglik' | 'anshik_manglik' | 'dont_know'
  >('dont_know');
  const [visibility, setVisibility] = useState<
    'matches_only' | 'private' | 'shared_with_pandit'
  >('matches_only');
  const [submitting, setSubmitting] = useState(false);

  const manglikOptions = [
    { key: 'non_manglik', label: 'Non-Manglik' },
    { key: 'manglik', label: 'Manglik' },
    { key: 'anshik_manglik', label: 'Anshik (Partial)' },
    { key: 'dont_know', label: "Don't Know" },
  ];

  const visibilityOptions = [
    { key: 'matches_only', label: 'Accepted Matches Only' },
    { key: 'shared_with_pandit', label: 'Matches & Consulting Pandits' },
    { key: 'private', label: 'Strictly Private' },
  ];

  const handleSubmit = async () => {
    if (!dateOfBirth || !timeOfBirth || !cityName.trim()) {
      Alert.alert('Required Fields', 'Please enter date, time, and birth place.');
      return;
    }
    const dobCheck = isValidDob(dateOfBirth);
    if (!dobCheck.isValid) {
      Alert.alert(
        'Invalid Date of Birth',
        dobCheck.error === 'underage'
          ? 'You must be at least 18 years old.'
          : 'Date of birth cannot be in the future.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/astrology/kundli/me`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateOfBirth,
          timeOfBirth,
          isApproximateTime: isApproximate,
          birthPlace: {
            name: cityName.trim(),
            state: stateName.trim(),
            country: 'India',
          },
          rashi,
          nakshatra,
          charan: parseInt(charan, 10) || 1,
          manglikStatus,
          visibility,
        }),
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert(
          'Kundli Saved! 🔮',
          'Your Vedic birth chart has been updated and will be used for authentic Ashta Koota matchmaking.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Notice', json.error?.message || 'Could not save Kundli.');
      }
    } catch {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Bar */}
      <View style={styles.topNav}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>
        <Text
          maxFontSizeMultiplier={1.2}
          style={styles.navTitle}
        >
          Create Vedic Kundli
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Birth Information Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="calendar-outline" size={17} color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle}>
              Birth Information
            </Text>
          </View>

          <DatePickerField
            label="Date of Birth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            minDate={dobLimits.minDate}
            maxDate={dobLimits.maxDate}
            defaultDate={dobLimits.defaultInitialDate}
            required
          />

          <TimePickerField
            label="Time of Birth"
            value={timeOfBirth}
            onChange={setTimeOfBirth}
            required
          />

          <PressableScale
            style={styles.checkboxRow}
            onPress={() => setIsApproximate(!isApproximate)}
          >
            <Ionicons
              name={isApproximate ? 'checkbox' : 'square-outline'}
              size={19}
              color={ds.color.maroon}
            />
            <Text maxFontSizeMultiplier={1.2} style={styles.checkboxLabel}>
              Birth time is approximate (not exact)
            </Text>
          </PressableScale>

          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            Birth City
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              value={cityName}
              onChangeText={setCityName}
              placeholder="e.g. Lucknow, Varanasi, Delhi"
              placeholderTextColor={ds.color.textMuted}
            />
          </View>

          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            Birth State / Region
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              value={stateName}
              onChangeText={setStateName}
              placeholder="e.g. Uttar Pradesh"
              placeholderTextColor={ds.color.textMuted}
            />
          </View>
        </View>

        {/* Astrological Parameters */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="planet-outline" size={17} color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle}>
              Astrological Parameters
            </Text>
          </View>

          <Text maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>
            Moon Sign (Rashi)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {RASHI_LIST.map((r) => (
              <PressableScale
                key={r}
                style={[styles.chipItem, rashi === r && styles.chipItemActive]}
                onPress={() => setRashi(r)}
              >
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[styles.chipText, rashi === r && styles.chipTextActive]}
                >
                  {r}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          <Text maxFontSizeMultiplier={1.2} style={[styles.fieldLabel, { marginTop: 10 }]}>
            Nakshatra
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {NAKSHATRA_LIST.map((n) => (
              <PressableScale
                key={n}
                style={[styles.chipItem, nakshatra === n && styles.chipItemActive]}
                onPress={() => setNakshatra(n)}
              >
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[styles.chipText, nakshatra === n && styles.chipTextActive]}
                >
                  {n}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          <Text maxFontSizeMultiplier={1.2} style={[styles.fieldLabel, { marginTop: 10 }]}>
            Manglik Status
          </Text>
          <View style={styles.wrapGrid}>
            {manglikOptions.map((opt) => (
              <PressableScale
                key={opt.key}
                style={[
                  styles.optionPill,
                  manglikStatus === opt.key && styles.optionPillActive,
                ]}
                onPress={() => setManglikStatus(opt.key as any)}
              >
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[
                    styles.optionPillText,
                    manglikStatus === opt.key && styles.optionPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* Privacy & Visibility */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="lock-closed-outline" size={17} color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle}>
              Kundli Visibility
            </Text>
          </View>

          {visibilityOptions.map((v) => (
            <PressableScale
              key={v.key}
              style={[
                styles.visibilityRow,
                visibility === v.key && styles.visibilityRowActive,
              ]}
              onPress={() => setVisibility(v.key as any)}
            >
              <Ionicons
                name={visibility === v.key ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={visibility === v.key ? ds.color.maroon : ds.color.textMuted}
              />
              <Text
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.visibilityText,
                  visibility === v.key && styles.visibilityTextActive,
                ]}
              >
                {v.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        {/* Save Button */}
        <PressableScale
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient
            colors={['#7A1528', '#9B1D36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.saveBtnText}>
                  Save Vedic Kundli
                </Text>
              </>
            )}
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
    fontWeight: '700',
    color: ds.color.text,
  },
  scrollContent: {
    padding: ds.space.md,
  },
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: ds.space.sm,
    paddingBottom: ds.space.xs,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  checkboxLabel: {
    fontSize: 13,
    color: ds.color.textBody,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.text,
    marginTop: 8,
    marginBottom: 4,
  },
  inputWrap: {
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textInput: {
    fontSize: 14,
    color: ds.color.text,
  },
  chipScroll: {
    paddingVertical: 4,
  },
  chipItem: {
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  chipItemActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  chipText: {
    fontSize: 12,
    color: ds.color.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  optionPill: {
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  optionPillActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: ds.color.text,
  },
  optionPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
  },
  visibilityRowActive: {
    backgroundColor: ds.color.surfaceWarm,
  },
  visibilityText: {
    fontSize: 13,
    color: ds.color.textMuted,
  },
  visibilityTextActive: {
    color: ds.color.maroon,
    fontWeight: '700',
  },
  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: ds.space.xs,
    ...ds.shadow.soft,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
