/**
 * PanditBookingRequestScreen
 * A direct booking request form (no specific pandit required).
 * Accessed from ServiceGrid "Book a Pandit" button.
 * Supports prefill from account, optional pandit selection, date picker,
 * service type, city/state, guests, language, budget, notes.
 */
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import { getSessionToken, getSessionUser, API_BASE, getAuthHeader } from '../services/authSession';
import { getMyProfile } from '../services/profileService';
import { useTranslation } from 'react-i18next';
import { DatePickerField } from '../components/common/DatePickerField';
import { isValidBookingDate, getBookingDateLimits } from '../utils/dateTimeHelpers';

// Service type options
const SERVICE_TYPES = [
  { id: 'wedding', label: 'Vivah (Wedding)', hi: 'विवाह' },
  { id: 'griha_pravesh', label: 'Griha Pravesh', hi: 'गृह प्रवेश' },
  { id: 'satyanarayan_puja', label: 'Satyanarayan Katha', hi: 'सत्यनारायण कथा' },
  { id: 'puja_havan', label: 'Puja / Havan', hi: 'पूजा / हवन' },
  { id: 'kundli_jyotish', label: 'Kundli / Jyotish Consultation', hi: 'कुंडली / ज्योतिष' },
  { id: 'other', label: 'Other', hi: 'अन्य' },
];

const LANGUAGE_OPTIONS = ['Hindi', 'Sanskrit', 'English', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Tamil', 'Telugu', 'Kannada'];

const BUDGET_OPTIONS = ['Under ₹3,000', '₹3,000 – ₹7,000', '₹7,000 – ₹15,000', '₹15,000 – ₹30,000', '₹30,000+', 'Flexible'];

const TIME_SLOTS = [
  '06:00 AM – 09:00 AM',
  '08:00 AM – 11:00 AM',
  '10:00 AM – 01:00 PM',
  '02:00 PM – 05:00 PM',
  '05:00 PM – 08:00 PM',
  '06:00 PM – 09:00 PM',
];

export const PanditBookingRequestScreen: React.FC<any> = ({ navigation }) => {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const bookingLimits = getBookingDateLimits();

  // Pre-filled fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Booking details
  const [serviceType, setServiceType] = useState('wedding');
  const [otherService, setOtherService] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[2]);
  const [venueAddress, setVenueAddress] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [languagePref, setLanguagePref] = useState('Hindi');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person');
  const [kundliConsent, setKundliConsent] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const prefill = async () => {
      setLoadingProfile(true);
      try {
        const token = getSessionToken();
        const sessionUser = getSessionUser() as any;
        // Prefill from session first (fast)
        setFullName(sessionUser?.displayName || sessionUser?.name || '');
        setMobile(sessionUser?.mobile || sessionUser?.phone || '');

        // Then enhance with profile data
        if (token) {
          const profileRes = await getMyProfile(token);
          if (profileRes?.data) {
            const p = profileRes.data;
            if (p.firstName) {
              setFullName(`${p.firstName} ${p.lastName || ''}`.trim());
            }
            if ((p as any).mobile) setMobile((p as any).mobile);
            if (p.city) setCity(p.city);
            if (p.state) setState(p.state);
          }
        }
      } catch {
        // use session data only
      } finally {
        setLoadingProfile(false);
      }
    };
    prefill();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Please enter your full name.';
    if (!mobile.trim() || !/^\d{10,13}$/.test(mobile.replace(/[\s+\-()]/g, ''))) {
      newErrors.mobile = 'Please enter a valid mobile number.';
    }
    if (!city.trim()) newErrors.city = 'Please enter your city.';
    if (!serviceType) newErrors.serviceType = 'Please select a service type.';
    if (serviceType === 'other' && !otherService.trim()) {
      newErrors.otherService = 'Please describe the service you need.';
    }
    const dateCheck = isValidBookingDate(bookingDate);
    if (!dateCheck.isValid) {
      if (dateCheck.error === 'past') {
        newErrors.bookingDate = isHindi
          ? 'तारीख आज या भविष्य की होनी चाहिए।'
          : 'Booking date must be today or a future date.';
      } else if (dateCheck.error === 'beyond_one_year') {
        newErrors.bookingDate = isHindi
          ? 'बुकिंग की तारीख 1 वर्ष के भीतर होनी चाहिए।'
          : 'Booking date must be within 1 year.';
      } else {
        newErrors.bookingDate = isHindi
          ? 'कृपया अनुष्ठान की तारीख चुनें।'
          : 'Please select a preferred ceremony date.';
      }
    }
    if (mode === 'in_person' && !venueAddress.trim()) {
      newErrors.venueAddress = 'Please enter the ceremony venue or address.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const token = getSessionToken();
    if (!token) {
      Alert.alert('Login Required', 'Please log in to submit a booking request.');
      return;
    }

    const finalService = serviceType === 'other' ? otherService.trim() : serviceType;

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // no panditId = "any available pandit"
          serviceId: finalService,
          bookingDate: bookingDate.trim(),
          timeSlot,
          mode,
          venueAddress: mode === 'in_person' ? venueAddress.trim() : undefined,
          city: city.trim(),
          state: state.trim() || undefined,
          guestCount: guestCount ? parseInt(guestCount, 10) : undefined,
          languagePref,
          budgetRangeInr: budget || undefined,
          kundliSharedConsent: kundliConsent,
          specialRequests: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        Alert.alert(
          isHindi ? 'अनुरोध भेज दिया गया! 🙏' : 'Request Sent! 🙏',
          isHindi
            ? `आपका बुकिंग अनुरोध (${json.data.bookingReference}) सफलतापूर्वक दर्ज हो गया है। हमारी टीम जल्द ही एक योग्य पंडित जी से आपको जोड़ेगी।`
            : `Your booking request (${json.data.bookingReference}) has been received. Our team will connect you with an available Pandit Ji shortly.`,
          [
            {
              text: isHindi ? 'मेरी बुकिंग देखें' : 'View My Bookings',
              onPress: () => navigation.replace('MyBookings'),
            },
          ]
        );
      } else {
        Alert.alert(
          isHindi ? 'कुछ गलत हुआ' : 'Booking Notice',
          json.error?.message || json.message || (isHindi ? 'कृपया फिर से कोशिश करें।' : 'Unable to submit. Please try again.')
        );
      }
    } catch {
      Alert.alert(
        isHindi ? 'नेटवर्क त्रुटि' : 'Network Error',
        isHindi ? 'कृपया अपना इंटरनेट कनेक्शन जांचें।' : 'Please check your internet connection.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const Field: React.FC<{ label: string; error?: string; required?: boolean; children: React.ReactNode }> = ({
    label,
    error,
    required,
    children,
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  if (loadingProfile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.royalMaroon} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isHindi ? 'पंडित बुकिंग अनुरोध' : 'Book a Pandit'}</Text>
          <Text style={styles.headerSub}>{isHindi ? 'Vedic पूजा, विवाह व अनुष्ठान' : 'Vedic Puja, Wedding & Rituals'}</Text>
        </View>
        {/* Browse pandits shortcut */}
        <TouchableOpacity onPress={() => navigation.navigate('PanditServices')} style={styles.browseBtn}>
          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
          <Text style={styles.browseBtnText}>{isHindi ? 'सूची' : 'Browse'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.royalMaroon} />
            <Text style={styles.infoText}>
              {isHindi
                ? 'हम आपके लिए उपयुक्त पंडित जी ढूंढेंगे, या आप नीचे "Browse" से खुद भी चुन सकते हैं।'
                : 'We will find an available Pandit Ji for you. Or tap "Browse" to pick one yourself.'}
            </Text>
          </View>

          {/* ── Personal Details ── */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="person-outline" size={14} /> {isHindi ? 'आपकी जानकारी' : 'Your Details'}
          </Text>

          <Field label={isHindi ? 'पूरा नाम' : 'Full Name'} error={errors.fullName} required>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={fullName}
              onChangeText={setFullName}
              placeholder={isHindi ? 'जैसे: राहुल शर्मा' : 'e.g. Rahul Sharma'}
              returnKeyType="next"
            />
          </Field>

          <Field label={isHindi ? 'मोबाइल नंबर' : 'Mobile Number'} error={errors.mobile} required>
            <TextInput
              style={[styles.input, errors.mobile && styles.inputError]}
              value={mobile}
              onChangeText={setMobile}
              placeholder="+91 XXXXX XXXXX"
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </Field>

          <View style={styles.row}>
            <Field label={isHindi ? 'शहर' : 'City'} error={errors.city} required>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                value={city}
                onChangeText={setCity}
                placeholder={isHindi ? 'जैसे: दिल्ली' : 'e.g. Delhi'}
              />
            </Field>
            <View style={{ width: spacing.sm }} />
            <Field label={isHindi ? 'राज्य' : 'State'}>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder={isHindi ? 'जैसे: UP' : 'e.g. UP'}
              />
            </Field>
          </View>

          {/* ── Service Type ── */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="flame-outline" size={14} /> {isHindi ? 'सेवा का प्रकार' : 'Service Type'}
          </Text>
          {errors.serviceType ? <Text style={styles.errorText}>{errors.serviceType}</Text> : null}
          <View style={styles.chipRow}>
            {SERVICE_TYPES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, serviceType === s.id && styles.chipSelected]}
                onPress={() => setServiceType(s.id)}
              >
                <Text style={[styles.chipText, serviceType === s.id && styles.chipTextSelected]} numberOfLines={1}>
                  {isHindi ? s.hi : s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {serviceType === 'other' && (
            <Field label={isHindi ? 'सेवा का विवरण दें' : 'Describe the service'} error={errors.otherService} required>
              <TextInput
                style={[styles.input, errors.otherService && styles.inputError]}
                value={otherService}
                onChangeText={setOtherService}
                placeholder={isHindi ? 'जैसे: नवग्रह शांति पूजा' : 'e.g. Navgraha Shanti Puja'}
              />
            </Field>
          )}

          {/* ── Date & Time ── */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={14} /> {isHindi ? 'तिथि और समय' : 'Date & Time'}
          </Text>

          <DatePickerField
            label={isHindi ? 'पसंदीदा तिथि' : 'Preferred Ceremony Date'}
            value={bookingDate}
            onChange={(d) => {
              setBookingDate(d);
              if (errors.bookingDate) {
                setErrors((prev) => ({ ...prev, bookingDate: '' }));
              }
            }}
            minDate={bookingLimits.minDate}
            maxDate={bookingLimits.maxDate}
            error={errors.bookingDate}
            required
            placeholder={isHindi ? 'तारीख चुनें (उदा. 12 नवं 2026)' : 'Select Date (e.g. 12 Nov 2026)'}
          />

          <Field label={isHindi ? 'पसंदीदा समय' : 'Preferred Time Slot'}>
            <View style={styles.chipRow}>
              {TIME_SLOTS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, timeSlot === t && styles.chipSelected]}
                  onPress={() => setTimeSlot(t)}
                >
                  <Text style={[styles.chipText, timeSlot === t && styles.chipTextSelected]} numberOfLines={1}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* ── Attendance Mode ── */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={14} /> {isHindi ? 'पूजा कहाँ होगी?' : 'Attendance Mode'}
          </Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeCard, mode === 'in_person' && styles.modeCardActive]}
              onPress={() => setMode('in_person')}
            >
              <Ionicons name="home-outline" size={20} color={mode === 'in_person' ? colors.royalMaroon : colors.textSecondary} />
              <Text style={[styles.modeText, mode === 'in_person' && styles.modeTextActive]}>
                {isHindi ? 'घर / स्थान पर' : 'In Person'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeCard, mode === 'online' && styles.modeCardActive]}
              onPress={() => setMode('online')}
            >
              <Ionicons name="videocam-outline" size={20} color={mode === 'online' ? colors.royalMaroon : colors.textSecondary} />
              <Text style={[styles.modeText, mode === 'online' && styles.modeTextActive]}>
                {isHindi ? 'ऑनलाइन वीडियो' : 'Online Video'}
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'in_person' && (
            <Field
              label={isHindi ? 'पूजा स्थल का पता' : 'Venue / Address'}
              error={errors.venueAddress}
              required
            >
              <TextInput
                style={[styles.inputMulti, errors.venueAddress && styles.inputError]}
                value={venueAddress}
                onChangeText={setVenueAddress}
                placeholder={isHindi ? 'पूरा पता लिखें…' : 'Full address where Puja will be conducted…'}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>
          )}

          {/* ── Additional Details ── */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="options-outline" size={14} /> {isHindi ? 'अतिरिक्त जानकारी' : 'Additional Details'}
          </Text>

          <Field label={isHindi ? 'अतिथियों की संख्या (वैकल्पिक)' : 'Number of Guests (optional)'}>
            <TextInput
              style={styles.input}
              value={guestCount}
              onChangeText={setGuestCount}
              placeholder="e.g. 50"
              keyboardType="numeric"
            />
          </Field>

          <Field label={isHindi ? 'पंडित की भाषा प्राथमिकता' : 'Pandit Language Preference'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.chipRow}>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.chip, languagePref === lang && styles.chipSelected]}
                    onPress={() => setLanguagePref(lang)}
                  >
                    <Text style={[styles.chipText, languagePref === lang && styles.chipTextSelected]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Field>

          <Field label={isHindi ? 'बजट (वैकल्पिक)' : 'Budget Range (optional)'}>
            <View style={styles.chipRow}>
              {BUDGET_OPTIONS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, budget === b && styles.chipSelected]}
                  onPress={() => setBudget(budget === b ? '' : b)}
                >
                  <Text style={[styles.chipText, budget === b && styles.chipTextSelected]} numberOfLines={1}>
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label={isHindi ? 'विशेष अनुरोध / नोट (वैकल्पिक)' : 'Special Notes (optional)'}>
            <TextInput
              style={[styles.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder={isHindi ? 'जैसे: गोत्र काश्यप, विशेष सामग्री की सूची…' : 'e.g. Gotra Kashyap, special Samagri list required…'}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Field>

          {/* Kundli Consent */}
          <TouchableOpacity style={styles.consentRow} onPress={() => setKundliConsent(!kundliConsent)}>
            <Ionicons
              name={kundliConsent ? 'checkbox' : 'square-outline'}
              size={22}
              color={colors.royalMaroon}
            />
            <Text style={styles.consentText}>
              {isHindi
                ? 'पंडित जी को मेरी कुंडली जन्म विवरण देखने की अनुमति दें (मुहूर्त के लिए)।'
                : 'Allow Pandit Ji to view my Kundli birth details for Muhurat and Sankalpa.'}
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>
                  {isHindi ? 'बुकिंग अनुरोध भेजें' : 'Send Booking Request'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            {isHindi
              ? '🙏 हमारी टीम 24 घंटे के अंदर आपसे संपर्क करेगी।'
              : '🙏 Our team will confirm your booking within 24 hours.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F4EE' },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  headerSub: { fontSize: 12, fontFamily: fonts.bodyRegular, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  browseBtnText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodySemiBold },
  content: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF5E8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.royalMaroon,
    gap: 8,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: fonts.bodyRegular, color: colors.charcoal, lineHeight: 18 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.headingSemiBold,
    color: colors.royalMaroon,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.charcoal, marginBottom: 6 },
  required: { color: colors.alertRed },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
  },
  inputMulti: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    minHeight: 80,
  },
  inputError: { borderColor: colors.alertRed },
  errorText: { fontSize: 11, fontFamily: fonts.bodyRegular, color: colors.alertRed, marginTop: 4 },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: borderRadius.md,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.royalMaroon, borderColor: colors.royalMaroon },
  chipText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.charcoal },
  chipTextSelected: { color: '#FFFFFF' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  modeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  modeCardActive: { borderColor: colors.royalMaroon, backgroundColor: '#FFF3F5' },
  modeText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textSecondary, textAlign: 'center' },
  modeTextActive: { color: colors.royalMaroon },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 16,
    backgroundColor: '#FFF8EE',
    borderRadius: borderRadius.md,
    padding: 12,
    gap: 10,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 15,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    elevation: 4,
    shadowColor: colors.royalMaroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.headingBold },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginTop: 16,
    lineHeight: 18,
  },
});
