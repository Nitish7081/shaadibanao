import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PujaBooking } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const MyBookingsScreen: React.FC<any> = ({ navigation }) => {
  const [bookings, setBookings] = useState<PujaBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/bookings/my`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setBookings(json.data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderBookingItem = ({ item }: { item: PujaBooking }) => {
    const isOnline = item.mode === 'online';
    const isConfirmed = item.status === 'accepted';

    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.refCode}>{item.bookingReference || 'SB-BOOKING'}</Text>
            <Text style={styles.serviceName}>{item.serviceName || item.ceremonyType}</Text>
          </View>
          <View style={[
            styles.statusPill,
            item.status === 'accepted' ? styles.statusConfirmed :
            item.status === 'completed' ? styles.statusCompleted :
            item.status === 'cancelled' ? styles.statusCancelled : styles.statusRequested
          ]}>
            <Text style={styles.statusPillText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>Pandit Ji: <Text style={{ fontWeight: '700' }}>{item.panditName || 'Assigned Vedic Pandit'}</Text></Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.bookingDate} • {item.timeSlot}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name={isOnline ? 'videocam-outline' : 'location-outline'} size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>{isOnline ? 'Online Video Consultation' : (item.venueAddress || 'In-Person Venue')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={15} color={colors.royalMaroon} />
            <Text style={[styles.detailText, { fontWeight: '700', color: colors.royalMaroon }]}>₹{(item.priceInr || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Online Video Consultation Join Button */}
        {isOnline && isConfirmed && (
          <TouchableOpacity
            style={styles.joinVideoBtn}
            onPress={() =>
              navigation.navigate('VideoConsultation', {
                bookingId: item.id,
                ceremonyName: item.serviceName,
                panditName: item.panditName,
              })
            }
          >
            <Ionicons name="videocam" size={18} color="#FFFFFF" />
            <Text style={styles.joinVideoText}>Join Video Consultation Room</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Ceremony Bookings</Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.royalMaroon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id || b.bookingReference}
          renderItem={renderBookingItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchBookings();
              }}
              colors={[colors.royalMaroon]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={54} color={colors.softGold} />
              <Text style={styles.emptyTitle}>No Bookings Yet</Text>
              <Text style={styles.emptySub}>Book a certified Pandit for Vivah, Griha Pravesh, or Kundli Milan consultations.</Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('PanditServices')}
              >
                <Text style={styles.browseBtnText}>Explore Pandit Services →</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
    paddingBottom: 8,
  },
  refCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.softGold,
    letterSpacing: 0.5,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusRequested: {
    backgroundColor: '#FFF8E1',
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9',
  },
  statusCompleted: {
    backgroundColor: '#E0F2F1',
  },
  statusCancelled: {
    backgroundColor: '#FFEBEE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
  },
  detailsBox: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.charcoal,
    marginLeft: 8,
  },
  joinVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.verifiedGreen,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  joinVideoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  browseBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
