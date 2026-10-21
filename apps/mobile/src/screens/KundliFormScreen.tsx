import React, { useState } from 'react';
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
import { RASHI_LIST, NAKSHATRA_LIST } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const KundliFormScreen: React.FC<any> = ({ navigation }) => {
  const [dateOfBirth, setDateOfBirth] = useState('1998-05-15');
  const [timeOfBirth, setTimeOfBirth] = useState('14:30');
  const [isApproximate, setIsApproximate] = useState(false);
  const [cityName, setCityName] = useState('Delhi');
  const [stateName, setStateName] = useState('Delhi NCR');
  const [rashi, setRashi] = useState<string>(RASHI_LIST[0]);
  const [nakshatra, setNakshatra] = useState<string>(NAKSHATRA_LIST[0]);
  const [charan, setCharan] = useState('1');
  const [manglikStatus, setManglikStatus] = useState<'non_manglik' | 'manglik' | 'anshik_manglik' | 'dont_know'>('dont_know');
  const [visibility, setVisibility] = useState<'matches_only' | 'private' | 'shared_with_pandit'>('matches_only');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dateOfBirth || !timeOfBirth || !cityName.trim()) {
      Alert.alert('Required Fields', 'Please enter date, time, and birth place.');
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Vedic Kundli Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Birth Information</Text>

        <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.textInput}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="e.g. 1998-05-15"
        />

        <Text style={styles.label}>Time of Birth (24-Hour HH:MM)</Text>
        <TextInput
          style={styles.textInput}
          value={timeOfBirth}
          onChangeText={setTimeOfBirth}
          placeholder="e.g. 14:30"
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsApproximate(!isApproximate)}
        >
          <Ionicons
            name={isApproximate ? 'checkbox' : 'square-outline'}
            size={20}
            color={colors.royalMaroon}
          />
          <Text style={styles.checkboxLabel}>Birth time is approximate (not exact)</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Birth City</Text>
        <TextInput
          style={styles.textInput}
          value={cityName}
          onChangeText={setCityName}
          placeholder="e.g. Lucknow, Varanasi, Delhi"
        />

        <Text style={styles.label}>Birth State / Region</Text>
        <TextInput
          style={styles.textInput}
          value={stateName}
          onChangeText={setStateName}
          placeholder="e.g. Uttar Pradesh"
        />

        <Text style={styles.sectionTitle}>Astrological Planetary Signs</Text>

        <Text style={styles.label}>Moon Sign (Rashi)</Text>
        <View style={styles.selectorBox}>
          <Text style={styles.selectorText}>{rashi}</Text>
        </View>

        <Text style={styles.label}>Birth Nakshatra</Text>
        <View style={styles.selectorBox}>
          <Text style={styles.selectorText}>{nakshatra}</Text>
        </View>

        <Text style={styles.label}>Nakshatra Charan (Pada 1 to 4)</Text>
        <TextInput
          style={styles.textInput}
          value={charan}
          onChangeText={setCharan}
          keyboardType="number-pad"
          maxLength={1}
        />

        <Text style={styles.label}>Manglik Status</Text>
        <View style={styles.optionsRow}>
          {[
            { key: 'non_manglik', label: 'Non-Manglik' },
            { key: 'manglik', label: 'Manglik' },
            { key: 'anshik_manglik', label: 'Anshik' },
            { key: 'dont_know', label: 'Not Sure' },
          ].map((m) => {
            const isSelected = manglikStatus === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                onPress={() => setManglikStatus(m.key as any)}
                activeOpacity={0.75}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={13} color={colors.royalMaroon} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Privacy & Visibility</Text>
        <View style={styles.optionsRow}>
          {[
            { key: 'matches_only', label: 'Matches Only' },
            { key: 'shared_with_pandit', label: 'Pandit Only' },
            { key: 'private', label: 'Private' },
          ].map((v) => {
            const isSelected = visibility === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                onPress={() => setVisibility(v.key as any)}
                activeOpacity={0.75}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={13} color={colors.royalMaroon} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save Kundli Horoscope</Text>
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginTop: 10,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginBottom: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  checkboxLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    marginLeft: 8,
  },
  selectorBox: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  selectorText: {
    fontSize: 13,
    fontFamily: fonts.headingSemiBold,
    color: colors.charcoal,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E8E2D8',
  },
  pillBtnActive: {
    backgroundColor: '#FFF0F4',
    borderColor: colors.royalMaroon,
    borderWidth: 1.5,
  },
  pillBtnText: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    fontWeight: '500',
  },
  pillBtnTextActive: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...shadows.card,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
});
