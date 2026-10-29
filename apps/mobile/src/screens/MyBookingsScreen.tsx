import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PujaBooking } from '@bandhansetu/shared';
import { API_BASE, getAuthHeader } from '../services/authSession';

export const MyBookingsScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useTranslation();
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

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      t('myBookings.cancelConfirmTitle'),
      t('myBookings.cancelConfirmBody'),
      [
        { text: 'No', style: 'cancel' },
        {
          text: t('myBookings.cancelBooking'),
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Cancelled by devotee' }),
              });
              const json = await res.json();
              if (json.success) {
                Alert.alert('Notice', t('myBookings.cancelSuccess'));
                fetchBookings();
              } else {
                Alert.alert('Notice', json.message || json.error?.message || 'Could not cancel booking.');
              }
            } catch {
              Alert.alert('Error', 'Network error. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return t('myBookings.statusConfirmed');
      case 'completed':
        return t('myBookings.statusCompleted');
      case 'cancelled':
        return t('myBookings.statusCancelled');
      case 'declined':
        return t('myBookings.statusDeclined');
      case 'requested':
      default:
        return t('myBookings.statusRequested');
    }
  };

  const renderBookingItem = ({ item }: { item: PujaBooking }) => {
    const isOnline = item.mode === 'online';
    const isConfirmed = item.status === 'accepted';
    const canCancel = item.status === 'requested' || item.status === 'accepted';

    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refCode}>{item.bookingReference || 'SB-BOOKING'}</Text>
            <Text style={styles.serviceName}>{item.serviceName || item.ceremonyType}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              item.status === 'accepted'
                ? styles.statusConfirmed
                : item.status === 'completed'
                ? styles.statusCompleted
                : item.status === 'cancelled' || item.status === 'declined'
                ? styles.statusCancelled
                : styles.statusRequested,
            ]}
          >
            <Text style={styles.statusPillText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              Pandit Ji:{' '}
              <Text style={{ fontWeight: '700' }}>
                {item.panditName || t('myBookings.assignedPandit')}
              </Text>
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {item.bookingDate} • {item.timeSlot}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons
              name={isOnline ? 'videocam-outline' : 'location-outline'}
              size={15}
              color={colors.textSecondary}
            />
            <Text style={styles.detailText}>
              {isOnline ? t('myBookings.onlineConsultation') : item.venueAddress || 'In-Person Venue'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={15} color={colors.royalMaroon} />
            <Text style={[styles.detailText, { fontWeight: '700', color: colors.royalMaroon }]}>
              ₹{(item.priceInr || 0).toLocaleString('en-IN')}
            </Text>
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
            <Text style={styles.joinVideoText}>{t('myBookings.joinVideo')}</Text>
          </TouchableOpacity>
        )}

        {/* Cancel Button if booking is still open */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancelBooking(item.id)}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.alertRed || '#D32F2F'} />
            <Text style={styles.cancelBtnText}>{t('myBookings.cancelBooking')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('myBookings.title')}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookNewBtn}
          onPress={() => navigation.navigate('PanditBookingRequest')}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.bookNewBtnText}>{t('myBookings.bookNew')}</Text>
        </TouchableOpacity>
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
              <Text style={styles.emptyTitle}>{t('myBookings.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('myBookings.emptySub')}</Text>
              <View style={styles.emptyActionRow}>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => navigation.navigate('PanditServices')}
                >
                  <Text style={styles.browseBtnText}>{t('myBookings.explorePandits')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.browseBtn, styles.directBtn]}
                  onPress={() => navigation.navigate('PanditBookingRequest')}
                >
                  <Text style={[styles.browseBtnText, styles.directBtnText]}>
                    {t('myBookings.directRequest')}
                  </Text>
                </TouchableOpacity>
              </View>
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
    justifyContent: 'space-between',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  bookNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bookNewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
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
    marginLeft: 8,
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
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
  },
  cancelBtnText: {
    color: colors.alertRed || '#D32F2F',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
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
  emptyActionRow: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
  browseBtn: {
    backgroundColor: colors.royalMaroon,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  directBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.royalMaroon,
  },
  directBtnText: {
    color: colors.royalMaroon,
  },
});
