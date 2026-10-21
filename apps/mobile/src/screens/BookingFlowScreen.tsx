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
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const BookingFlowScreen: React.FC<any> = ({ route, navigation }) => {
  const { panditId, serviceId, serviceName, priceInr } = route.params || {};

  // Form State
  const [bookingDate, setBookingDate] = useState('2026-11-20');
  const [timeSlot, setTimeSlot] = useState('10:00 AM - 01:00 PM');
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person');
  const [venueAddress, setVenueAddress] = useState('Sector 62, Noida, Uttar Pradesh');
  const [kundliSharedConsent, setKundliSharedConsent] = useState(true);
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableSlots = [
    '08:00 AM - 11:00 AM',
    '10:00 AM - 01:00 PM',
    '02:00 PM - 05:00 PM',
    '06:00 PM - 09:00 PM',
  ];

  const handleConfirmBooking = async () => {
    if (!bookingDate || !timeSlot) {
      Alert.alert('Required Fields', 'Please select a date and time slot.');
      return;
    }

    if (mode === 'in_person' && !venueAddress.trim()) {
      Alert.alert('Required Fields', 'Please specify the ceremony venue address.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          panditId,
          serviceId,
          bookingDate,
          timeSlot,
          mode,
          venueAddress: mode === 'in_person' ? venueAddress.trim() : undefined,
          kundliSharedConsent,
          specialRequests: specialRequests.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        Alert.alert(
          'Booking Requested! 🎉',
          `Your request (${json.data.bookingReference}) has been sent to Pandit Ji. You will receive an immediate confirmation once accepted.`,
          [
            {
              text: 'View My Bookings',
              onPress: () => navigation.replace('MyBookings'),
            },
          ]
        );
      } else {
        Alert.alert('Booking Notice', json.error?.message || json.message || 'Unable to complete request.');
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
        <Text style={styles.headerTitle}>Book Ceremony</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Service Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.serviceTitle}>{serviceName || 'Ceremony Service'}</Text>
          <Text style={styles.feeHighlight}>₹{(priceInr || 2100).toLocaleString('en-IN')}</Text>
          <Text style={styles.feeSub}>Transparent Dakshina • No hidden charges</Text>
        </View>

        {/* Ceremony Mode */}
        <Text style={styles.sectionTitle}>Attendance Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeCard, mode === 'in_person' && styles.modeCardActive]}
            onPress={() => setMode('in_person')}
          >
            <Ionicons name="location-outline" size={22} color={mode === 'in_person' ? colors.royalMaroon : colors.textSecondary} />
            <Text style={[styles.modeText, mode === 'in_person' && styles.modeTextActive]}>In-Person Venue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, mode === 'online' && styles.modeCardActive]}
            onPress={() => setMode('online')}
          >
            <Ionicons name="videocam-outline" size={22} color={mode === 'online' ? colors.royalMaroon : colors.textSecondary} />
            <Text style={[styles.modeText, mode === 'online' && styles.modeTextActive]}>Online Video (WebRTC)</Text>
          </TouchableOpacity>
        </View>

        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Auspicious Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.textInput}
          value={bookingDate}
          onChangeText={setBookingDate}
          placeholder="e.g. 2026-11-20"
        />

        {/* Time Slot Selection */}
        <Text style={styles.sectionTitle}>Preferred Muhurat / Time Slot</Text>
        <View style={styles.slotsGrid}>
          {availableSlots.map((slot) => (
            <TouchableOpacity
              key={slot}
              style={[styles.slotChip, timeSlot === slot && styles.slotChipActive]}
              onPress={() => setTimeSlot(slot)}
            >
              <Text style={[styles.slotChipText, timeSlot === slot && styles.slotChipTextActive]}>
                {slot}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Venue Address (for In-Person) */}
        {mode === 'in_person' && (
          <View>
            <Text style={styles.sectionTitle}>Ceremony Venue / Home Address</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
              value={venueAddress}
              onChangeText={setVenueAddress}
              placeholder="Full address where Puja will be conducted..."
              multiline
            />
          </View>
        )}

        {/* Special Requests */}
        <Text style={styles.sectionTitle}>Special Ritual Requests / Gotra (Optional)</Text>
        <TextInput
          style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
          value={specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="e.g. Gotra Kashyap, please bring specific Samagri list..."
          multiline
        />

        {/* Kundli Sharing Consent */}
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setKundliSharedConsent(!kundliSharedConsent)}
        >
          <Ionicons
            name={kundliSharedConsent ? 'checkbox' : 'square-outline'}
            size={22}
            color={colors.royalMaroon}
          />
          <Text style={styles.consentText}>
            Grant Pandit permission to view my Kundli birth details for Muhurat and Sankalpa recitation.
          </Text>
        </TouchableOpacity>

        {/* Confirm Button */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirmBooking}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Request Booking with Pandit Ji</Text>
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
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FAF5ED',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    marginBottom: 20,
    alignItems: 'center',
  },
  serviceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.charcoal,
  },
  feeHighlight: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.royalMaroon,
    marginTop: 6,
  },
  feeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 6,
    marginTop: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    padding: 12,
    alignItems: 'center',
  },
  modeCardActive: {
    borderColor: colors.royalMaroon,
    backgroundColor: '#FAF3F5',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  modeTextActive: {
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.charcoal,
    marginBottom: 10,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  slotChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  slotChipActive: {
    borderColor: colors.royalMaroon,
    backgroundColor: colors.royalMaroon,
  },
  slotChipText: {
    fontSize: 11,
    color: colors.charcoal,
    fontWeight: '600',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 14,
  },
  consentText: {
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 17,
    flex: 1,
    marginLeft: 8,
  },
  confirmBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
