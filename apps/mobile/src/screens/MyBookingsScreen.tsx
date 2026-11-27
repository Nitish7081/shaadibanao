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
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { AnimatedStaggerItem } from '../design';
import { PujaBooking } from '@bandhansetu/shared';
import { API_BASE, getAuthHeader, getSessionToken } from '../services/authSession';
import { apiClient } from '../services/apiClient';
import { initChatSocket } from '../services/chatService';
import { openBookingConsultationChat } from '../services/panditService';

export const MyBookingsScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<PujaBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookings();
    const token = getSessionToken();
    if (!token) return;
    const socket = initChatSocket(token);
    const handleSync = () => {
      fetchBookings();
    };
    socket.on('booking_updated', handleSync);
    return () => {
      socket.off('booking_updated', handleSync);
    };
  }, []);

  const handleSafeBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleSafeBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const json = await apiClient<any>('/bookings/my');
      if (json && (json.success || Array.isArray(json.data))) {
        setBookings(json.data || []);
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
              const json = await apiClient<any>(`/bookings/${bookingId}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Cancelled by devotee' }),
              });
              if (json && json.success) {
                Alert.alert('Notice', t('myBookings.cancelSuccess'));
                fetchBookings();
              } else {
                Alert.alert('Notice', json?.message || json?.error?.message || 'Could not cancel booking.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Network error. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePayBooking = async (booking: PujaBooking) => {
    try {
      const orderRes = await apiClient<any>(`/bookings/${booking.id}/payment/order`, {
        method: 'POST',
      });
      if (orderRes?.data?.orderId) {
        Alert.alert(
          'Confirm Dakshina Payment',
          `Pay ₹${(booking.priceInr || 0).toLocaleString('en-IN')} for ${booking.serviceName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Pay ₹' + (booking.priceInr || 0),
              onPress: async () => {
                const verifyRes = await apiClient<any>(`/bookings/${booking.id}/payment/verify`, {
                  method: 'POST',
                  body: JSON.stringify({
                    orderId: orderRes.data.orderId,
                    paymentId: `pay_sb_${Date.now()}`,
                  }),
                });
                if (verifyRes?.success) {
                  Alert.alert('Payment Successful! 🎉', 'Your Dakshina has been confirmed and credited.');
                  fetchBookings();
                }
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Payment Notice', err?.message || 'Unable to initiate payment.');
    }
  };

  const handleOpenBookingChat = async (booking: PujaBooking) => {
    try {
      const res = await openBookingConsultationChat(booking.id);
      if (res?.data?.id) {
        navigation.navigate('ChatDetail', {
          conversationId: res.data.id,
          partnerName: booking.panditName || 'Pandit Ji',
          partnerId: res.data.participant?.id,
          category: 'booking_consultation',
          bookingId: booking.id,
          panditId: booking.panditId,
        });
      }
    } catch (err: any) {
      Alert.alert('Consultation Chat', err?.message || 'Unable to open booking consultation chat.');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'accepted':
        return t('myBookings.statusConfirmed', 'Confirmed');
      case 'assigned':
        return t('myBookings.statusAssigned', 'Assigned');
      case 'completed':
        return t('myBookings.statusCompleted', 'Completed');
      case 'cancelled':
      case 'declined':
        return t('myBookings.statusCancelled', 'Cancelled');
      case 'pending':
      case 'requested':
      default:
        return t('myBookings.statusRequested', 'Pending');
    }
  };

  const renderBookingItem = ({ item, index }: { item: PujaBooking; index: number }) => {
    const isOnline = item.mode === 'online';
    const isConfirmed = item.status === 'accepted' || item.status === 'confirmed' || item.status === 'assigned';
    const canCancel = item.status === 'requested' || item.status === 'pending' || item.status === 'accepted' || item.status === 'confirmed';

    return (
      <AnimatedStaggerItem index={index} style={styles.bookingCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refCode}>{item.bookingReference || 'SB-BOOKING'}</Text>
            <Text style={styles.serviceName}>{item.serviceName || item.ceremonyType}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              item.status === 'accepted' || item.status === 'confirmed'
                ? styles.statusConfirmed
                : item.status === 'assigned'
                ? styles.statusAssigned
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
              ₹{(item.priceInr || 0).toLocaleString('en-IN')} •{' '}
              <Text style={{ color: item.paymentStatus === 'paid' ? '#059669' : '#B45309' }}>
                {item.paymentStatus === 'paid' ? 'Paid ✓' : 'Payment Pending'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Booking Consultation Chat (Never blocked by matrimonial subscription) */}
        {(item.paymentStatus === 'paid' || isConfirmed) && item.panditId && (
          <TouchableOpacity
            style={[styles.joinVideoBtn, { backgroundColor: '#7A1528', marginBottom: 8 }]}
            onPress={() => handleOpenBookingChat(item)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
            <Text style={styles.joinVideoText}>Consultation Chat</Text>
          </TouchableOpacity>
        )}

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

        {/* Pay Dakshina Button if unpaid */}
        {item.priceInr > 0 && item.paymentStatus !== 'paid' && item.status !== 'cancelled' && item.status !== 'declined' && (
          <TouchableOpacity
            style={[styles.joinVideoBtn, { backgroundColor: '#059669', marginTop: 8 }]}
            onPress={() => handlePayBooking(item)}
          >
            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            <Text style={styles.joinVideoText}>Pay Dakshina (₹{(item.priceInr || 0).toLocaleString('en-IN')})</Text>
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
      </AnimatedStaggerItem>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleSafeBack} style={{ padding: 4 }}>
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
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
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
  statusAssigned: {
    backgroundColor: '#E3F2FD',
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
