import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, borderRadius, spacing } from '../constants/theme';
import { getSessionToken, getSessionUser, API_BASE } from '../services/authSession';

const OFFICIAL_PHONE = '8076168502';
const OFFICIAL_EMAIL = 'shaadibanao.urbanpower@gmail.com';
const OFFICIAL_WHATSAPP = '8076168502'; // Official configured WhatsApp number

export const HelpSupportScreen: React.FC<any> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const user = getSessionUser();
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.mobile || '');
  const [category, setCategory] = useState('general_support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    { id: 'general_support', en: 'General Support', hi: 'सामान्य सहायता' },
    { id: 'booking_help', en: 'Pandit & Ceremony Booking', hi: 'पंडित और पूजा बुकिंग' },
    { id: 'account_access', en: 'Account & Verification', hi: 'खाता और सत्यापन' },
    { id: 'membership_billing', en: 'Membership & Payments', hi: 'सदस्यता और भुगतान' },
    { id: 'astrology', en: 'Kundli & Astrology Help', hi: 'कुंडली और ज्योतिष' },
    { id: 'grievance_officer', en: 'Grievance Officer', hi: 'शिकायत निवारण अधिकारी' },
  ];

  const handleCall = async () => {
    const url = `tel:${OFFICIAL_PHONE}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          isHindi ? 'फ़ोन नंबर' : 'Phone Number',
          `${isHindi ? 'कृपया इस नंबर पर कॉल करें:' : 'Please call:'} ${OFFICIAL_PHONE}`
        );
      }
    } catch {
      Alert.alert(
        isHindi ? 'फ़ोन नंबर' : 'Phone Number',
        `${isHindi ? 'कृपया इस नंबर पर कॉल करें:' : 'Please dial:'} ${OFFICIAL_PHONE}`
      );
    }
  };

  const handleEmail = async () => {
    const subjectParam = encodeURIComponent('ShaadiBanao Support Inquiry');
    const bodyParam = encodeURIComponent(
      `Hello ShaadiBanao Support,\n\nName: ${name || 'Devotee'}\nPhone: ${phone || 'N/A'}\n\nQuery:\n`
    );
    const url = `mailto:${OFFICIAL_EMAIL}?subject=${subjectParam}&body=${bodyParam}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        isHindi ? 'ईमेल पता' : 'Email Address',
        `${isHindi ? 'कृपया हमें ईमेल करें:' : 'Please email us at:'}\n${OFFICIAL_EMAIL}`
      );
    }
  };

  const handleWhatsApp = async () => {
    const textParam = encodeURIComponent(
      isHindi
        ? `नमस्ते शादीबनाओ सहायता टीम, मुझे सहायता की आवश्यकता है। (नाम: ${name || 'उपयोगकर्ता'}, फ़ोन: ${phone || ''})`
        : `Hello ShaadiBanao Support, I need assistance regarding the app. (Name: ${name || 'User'}, Phone: ${phone || ''})`
    );
    // Try native whatsapp intent first, then web wa.me fallback
    const appUrl = `whatsapp://send?phone=91${OFFICIAL_WHATSAPP}&text=${textParam}`;
    const webUrl = `https://wa.me/91${OFFICIAL_WHATSAPP}?text=${textParam}`;

    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        Alert.alert(
          'WhatsApp Support',
          `${isHindi ? 'कृपया व्हाट्सएप पर संपर्क करें:' : 'Please message us on WhatsApp:'} +91 ${OFFICIAL_WHATSAPP}`
        );
      }
    }
  };

  const handleSubmitInquiry = async () => {
    if (!name.trim()) {
      Alert.alert(isHindi ? 'त्रुटि' : 'Error', isHindi ? 'कृपया अपना नाम दर्ज करें।' : 'Please enter your name.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      Alert.alert(
        isHindi ? 'त्रुटि' : 'Error',
        isHindi ? 'कृपया संपर्क हेतु फ़ोन नंबर या ईमेल दर्ज करें।' : 'Please enter your phone number or email.'
      );
      return;
    }
    if (!message.trim()) {
      Alert.alert(
        isHindi ? 'त्रुटि' : 'Error',
        isHindi ? 'कृपया अपना संदेश या समस्या लिखें।' : 'Please enter your message.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const resolvedEmail = email.trim() || `${phone.replace(/\D/g, '')}@shaadibanao.devotee`;
      const resolvedSubject = subject.trim() || `Inquiry: ${category}`;

      const res = await fetch(`${API_BASE}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: resolvedEmail,
          phone: phone.trim(),
          category: category === 'booking_help' ? 'general_support' : category,
          subject: resolvedSubject,
          message: message.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert(
          isHindi ? 'अनुरोध प्राप्त हुआ! 🙏' : 'Inquiry Received! 🙏',
          isHindi
            ? `आपकी सहायता टिकट संख्या (${json.data?.ticketId || 'SB-HELP'}) दर्ज हो गई है। हमारी टीम जल्द आपसे संपर्क करेगी।`
            : `Your support ticket (${json.data?.ticketId || 'SB-HELP'}) has been created. Our team will get back to you shortly.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setMessage('');
        setSubject('');
      } else {
        Alert.alert(
          isHindi ? 'सूचना' : 'Notice',
          json.message || (isHindi ? 'अनुरोध भेजने में असमर्थ। कृपया पुनः प्रयास करें।' : 'Unable to submit inquiry.')
        );
      }
    } catch {
      Alert.alert(
        isHindi ? 'नेटवर्क त्रुटि' : 'Network Error',
        isHindi ? 'कृपया इंटरनेट कनेक्शन जांचें।' : 'Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isHindi ? 'सहायता एवं संपर्क' : 'Help & Support'}</Text>
          <Text style={styles.headerSub}>
            {isHindi ? 'हम आपकी सेवा के लिए सदैव तत्पर हैं' : 'Dedicated Matrimonial & Ceremony Support'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Contact Action Banner Cards */}
        <Text style={styles.sectionHeading}>
          {isHindi ? 'सीधा संपर्क करें' : 'Direct Assistance'}
        </Text>

        <View style={styles.actionGrid}>
          {/* Call Card */}
          <TouchableOpacity style={styles.contactCard} onPress={handleCall} activeOpacity={0.85}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="call" size={24} color="#2E7D32" />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardTitle}>{isHindi ? 'कॉल करें' : 'Call Support'}</Text>
              <Text style={styles.cardInfo}>+91 {OFFICIAL_PHONE}</Text>
              <Text style={styles.cardSub}>
                {isHindi ? 'सोमवार - शनिवार, 9 AM - 8 PM' : 'Mon - Sat, 9 AM - 8 PM IST'}
              </Text>
            </View>
            <View style={[styles.actionPill, { backgroundColor: '#2E7D32' }]}>
              <Text style={styles.actionPillText}>{isHindi ? 'कॉल करें' : 'Call Now'}</Text>
            </View>
          </TouchableOpacity>

          {/* WhatsApp Card */}
          <TouchableOpacity style={styles.contactCard} onPress={handleWhatsApp} activeOpacity={0.85}>
            <View style={[styles.iconCircle, { backgroundColor: '#E0F2F1' }]}>
              <Ionicons name="logo-whatsapp" size={26} color="#00897B" />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardTitle}>{isHindi ? 'व्हाट्सएप चैट' : 'WhatsApp Support'}</Text>
              <Text style={styles.cardInfo}>+91 {OFFICIAL_WHATSAPP}</Text>
              <Text style={styles.cardSub}>
                {isHindi ? 'त्वरित सहायता और चैट' : 'Instant Chat & Quick Query'}
              </Text>
            </View>
            <View style={[styles.actionPill, { backgroundColor: '#00897B' }]}>
              <Text style={styles.actionPillText}>{isHindi ? 'चैट करें' : 'Chat'}</Text>
            </View>
          </TouchableOpacity>

          {/* Email Card */}
          <TouchableOpacity style={styles.contactCard} onPress={handleEmail} activeOpacity={0.85}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="mail" size={24} color="#E65100" />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardTitle}>{isHindi ? 'ईमेल भेजें' : 'Email Us'}</Text>
              <Text style={styles.cardInfo}>{OFFICIAL_EMAIL}</Text>
              <Text style={styles.cardSub}>
                {isHindi ? '24 घंटे के अंदर उत्तर' : 'Response within 24 hours'}
              </Text>
            </View>
            <View style={[styles.actionPill, { backgroundColor: '#E65100' }]}>
              <Text style={styles.actionPillText}>{isHindi ? 'ईमेल' : 'Email'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Message / Ticket Submission Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isHindi ? 'हमें संदेश भेजें' : 'Send Us a Message'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isHindi
              ? 'यदि आपकी कोई विशेष समस्या या प्रश्न है, तो नीचे विवरण भरें।'
              : 'Submit a ticket directly to our customer care team.'}
          </Text>

          {/* Category Chips */}
          <Text style={styles.fieldLabel}>{isHindi ? 'सहायता श्रेणी' : 'Inquiry Category'}</Text>
          <View style={styles.categoryRow}>
            {categories.map((c) => {
              const active = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {isHindi ? c.hi : c.en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Name Field */}
          <Text style={styles.fieldLabel}>{isHindi ? 'आपका नाम' : 'Your Name'} *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={isHindi ? 'पूरा नाम दर्ज करें' : 'Enter your full name'}
            placeholderTextColor="#999"
          />

          {/* Phone Field */}
          <Text style={styles.fieldLabel}>{isHindi ? 'मोबाइल नंबर' : 'Mobile Number'} *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={isHindi ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          {/* Email Field */}
          <Text style={styles.fieldLabel}>{isHindi ? 'ईमेल पता (वैकल्पिक)' : 'Email Address (Optional)'}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@mail.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Subject Field */}
          <Text style={styles.fieldLabel}>{isHindi ? 'विषय' : 'Subject'}</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={isHindi ? 'संक्षिप्त विषय' : 'Brief subject of your query'}
            placeholderTextColor="#999"
          />

          {/* Message Field */}
          <Text style={styles.fieldLabel}>{isHindi ? 'संदेश या विवरण' : 'Message / Details'} *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder={
              isHindi
                ? 'कृपया अपनी समस्या या प्रश्न का विस्तार से वर्णन करें...'
                : 'Describe your issue, booking request, or question in detail...'
            }
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            onPress={handleSubmitInquiry}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>
                  {isHindi ? 'संदेश भेजें' : 'Submit Message'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Office & Grievance Information */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.royalMaroon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              {isHindi ? 'विश्वास और सुरक्षा' : 'Trust & Safety Assurance'}
            </Text>
            <Text style={styles.infoDesc}>
              {isHindi
                ? 'शादीबनाओ आपकी गोपनीयता का पूरा सम्मान करता है। आपकी शिकायतें प्राथमिकता से 24 से 48 घंटे में हल की जाती हैं।'
                : 'ShaadiBanao takes your privacy and grievances seriously. Inquiries are resolved within 24 to 48 hours by our customer care team.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F4EE' },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  headerSub: { fontSize: 12, fontFamily: fonts.bodyRegular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeading: {
    fontSize: 14,
    fontFamily: fonts.headingSemiBold,
    color: colors.royalMaroon,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  actionGrid: { gap: 12, marginBottom: 24 },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardDetails: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.charcoal },
  cardInfo: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.royalMaroon, marginTop: 2 },
  cardSub: { fontSize: 11, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 2 },
  actionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    marginLeft: 6,
  },
  actionPillText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodySemiBold },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  formTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.charcoal },
  formSubtitle: { fontSize: 12, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 4, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.charcoal, marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#FAFAF7',
    borderWidth: 1,
    borderColor: '#E5DFD5',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
  },
  textArea: { minHeight: 90 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: '#F0ECE4',
  },
  categoryChipActive: { backgroundColor: colors.royalMaroon },
  categoryChipText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.charcoal },
  categoryChipTextActive: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: colors.royalMaroon,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 18,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.headingBold },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8EE',
    borderRadius: borderRadius.md,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3E5D0',
    alignItems: 'flex-start',
  },
  infoTitle: { fontSize: 13, fontFamily: fonts.headingBold, color: colors.charcoal },
  infoDesc: { fontSize: 12, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
});
