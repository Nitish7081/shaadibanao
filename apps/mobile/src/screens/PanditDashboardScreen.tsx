import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../constants/theme';
import { ds, PressableScale } from '../design';
import { apiClient } from '../services/apiClient';
import { getSessionUser, getSessionToken } from '../services/authSession';
import { initChatSocket } from '../services/chatService';
import { openBookingConsultationChat } from '../services/panditService';

export const PanditDashboardScreen: React.FC<any> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const insets = useSafeAreaInsets();
  const sessionUser = getSessionUser() as any;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'calls' | 'wallet'>('requests');
  const [isOnline, setIsOnline] = useState(true);
  const [isAudioCallAvailable, setIsAudioCallAvailable] = useState(true);
  const [isVideoCallAvailable, setIsVideoCallAvailable] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Withdrawal modal state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [dashRes, wallRes] = await Promise.allSettled([
        apiClient<any>('/pandits/dashboard'),
        apiClient<any>('/pandits/wallet'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setDashboardData(dashRes.value.data);
        setIsOnline(Boolean(dashRes.value.data.pandit?.isOnline));
        setIsAudioCallAvailable(dashRes.value.data.pandit?.isAudioCallAvailable !== false);
        setIsVideoCallAvailable(dashRes.value.data.pandit?.isVideoCallAvailable !== false);
      }
      if (wallRes.status === 'fulfilled' && wallRes.value?.data) {
        setWalletData(wallRes.value.data);
        if (wallRes.value.data.bankDetails?.upiId) {
          setWithdrawUpi(wallRes.value.data.bankDetails.upiId);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const token = getSessionToken();
    if (!token) return;
    const socket = initChatSocket(token);
    const handleSync = () => {
      fetchDashboard();
    };
    socket.on('booking_assigned', handleSync);
    socket.on('booking_updated', handleSync);
    return () => {
      socket.off('booking_assigned', handleSync);
      socket.off('booking_updated', handleSync);
    };
  }, [fetchDashboard]);

  const handleOpenBookingChat = async (booking: any) => {
    try {
      const bookingId = booking._id || booking.id;
      const res = await openBookingConsultationChat(bookingId);
      if (res?.data?.id) {
        navigation.navigate('ChatDetail', {
          conversationId: res.data.id,
          partnerName: booking.userName || 'Devotee',
          partnerId: res.data.participant?.id,
          category: 'booking_consultation',
          bookingId,
        });
      }
    } catch (err: any) {
      Alert.alert('Consultation Chat', err?.message || 'Unable to open booking consultation chat.');
    }
  };

  // Online / Offline Availability Toggle
  const handleToggleAvailability = async (newVal: boolean) => {
    setIsOnline(newVal);
    try {
      await apiClient('/pandits/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ isOnline: newVal }),
      });
    } catch (err: any) {
      setIsOnline(!newVal); // revert on error
      Alert.alert('Error', err.message || 'Could not update availability.');
    }
  };

  // Audio / Video Call Availability Toggle
  const handleToggleCallAvailability = async (type: 'audio' | 'video', newVal: boolean) => {
    if (type === 'audio') setIsAudioCallAvailable(newVal);
    if (type === 'video') setIsVideoCallAvailable(newVal);

    try {
      await apiClient('/pandits/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({
          [type === 'audio' ? 'isAudioCallAvailable' : 'isVideoCallAvailable']: newVal,
        }),
      });
    } catch (err: any) {
      if (type === 'audio') setIsAudioCallAvailable(!newVal);
      if (type === 'video') setIsVideoCallAvailable(!newVal);
      Alert.alert('Error', err.message || 'Could not update call availability.');
    }
  };

  // Accept Booking
  const handleAcceptBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const res = await apiClient<any>(`/bookings/${bookingId}/accept`, {
        method: 'POST',
      });
      if (res.success || res.data) {
        Alert.alert(
          isHindi ? 'स्वीकृत! 🎉' : 'Booking Accepted! 🎉',
          isHindi ? 'आपने यह बुकिंग स्वीकार कर ली है।' : 'You have accepted this booking request.'
        );
        fetchDashboard();
      } else {
        Alert.alert('Notice', res.message || 'Could not accept booking.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept booking.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline Booking
  const handleDeclineBooking = (bookingId: string) => {
    Alert.alert(
      isHindi ? 'अस्वीकार करें?' : 'Decline Booking?',
      isHindi ? 'क्या आप इस बुकिंग को अस्वीकार करना चाहते हैं?' : 'Are you sure you want to decline this booking?',
      [
        { text: isHindi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: isHindi ? 'अस्वीकार करें' : 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(bookingId);
            try {
              const res = await apiClient<any>(`/bookings/${bookingId}/decline`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Pandit Ji is unavailable at the requested time slot' }),
              });
              if (res.success) {
                Alert.alert(isHindi ? 'सूचना' : 'Notice', isHindi ? 'बुकिंग अस्वीकार कर दी गई।' : 'Booking was declined.');
                fetchDashboard();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline booking.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // Mark Ceremony Completed
  const handleCompleteBooking = (bookingId: string) => {
    Alert.alert(
      isHindi ? 'अनुष्ठान पूर्ण मार्क करें?' : 'Mark Ceremony Completed?',
      isHindi ? 'क्या यह पूजा संपन्न हो चुकी है?' : 'Confirm that this ceremony has been performed successfully?',
      [
        { text: isHindi ? 'नहीं' : 'No', style: 'cancel' },
        {
          text: isHindi ? 'हाँ, पूर्ण हुआ' : 'Yes, Complete',
          onPress: async () => {
            setActionLoadingId(bookingId);
            try {
              const res = await apiClient<any>(`/bookings/${bookingId}/complete`, {
                method: 'POST',
              });
              if (res.success || res.data) {
                Alert.alert(
                  isHindi ? 'बधाई! 🕉️' : 'Ceremony Completed! 🕉️',
                  isHindi ? 'पूजा सफलतापूर्वक संपन्न हुई। दक्षिणा आपके वॉलेट में जोड़ दी गई है।' : 'Ceremony completed and payment added to your earnings.'
                );
                fetchDashboard();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to complete ceremony.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 100) {
      Alert.alert('Notice', 'Minimum withdrawal amount is ₹100.');
      return;
    }
    const maxBal = walletData?.pendingPayout || dashboardData?.stats?.pendingPayout || 0;
    if (amt > maxBal) {
      Alert.alert('Notice', `Requested amount exceeds available balance (₹${maxBal.toLocaleString('en-IN')}).`);
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const res = await apiClient<any>('/pandits/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          bankDetails: {
            upiId: withdrawUpi.trim(),
            bankName: walletData?.bankDetails?.bankName || 'UPI Transfer',
          },
        }),
      });

      if (res.success || res.data) {
        Alert.alert(
          isHindi ? 'अनुरोध जमा हुआ' : 'Withdrawal Submitted',
          isHindi ? 'आपका निकासी अनुरोध व्यवस्थापक को भेज दिया गया है।' : 'Your withdrawal request has been submitted for admin processing.'
        );
        setWithdrawModalVisible(false);
        setWithdrawAmount('');
        fetchDashboard();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8B1D24" />
        <Text style={styles.loadingText}>Loading Pandit Dashboard...</Text>
      </View>
    );
  }

  const pandit = dashboardData?.pandit || {};
  const stats = dashboardData?.stats || {};
  const pendingRequests = dashboardData?.pendingRequests || [];
  const upcomingBookings = dashboardData?.upcomingBookings || [];
  const recentCalls = dashboardData?.recentCalls || [];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>पंडित डैशबोर्ड</Text>
          <Text style={styles.headerSubtitle}>
            {pandit.name || 'Pandit Portal'} {pandit.panditId ? `• ${pandit.panditId}` : ''}
          </Text>
        </View>
        <View style={styles.statusBadgeRow}>
          <View
            style={[
              styles.verificationBadge,
              pandit.verificationStatus === 'verified' || pandit.verificationStatus === 'approved'
                ? styles.badgeApproved
                : styles.badgePending,
            ]}
          >
            <Text style={styles.badgeText}>
              {pandit.verificationStatus === 'verified' || pandit.verificationStatus === 'approved'
                ? '✓ Verified'
                : 'Pending'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboard(true)}
            tintColor="#8B1D24"
            colors={['#8B1D24']}
          />
        }
      >
        {/* Availability Switch Card */}
        <View style={styles.availabilityCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.availTitle}>
              {isOnline ? '🟢 Online (Accepting Ceremonies)' : '⚪ Offline (Paused)'}
            </Text>
            <Text style={styles.availSubtitle}>
              {isOnline
                ? 'Devotees can find your profile and request bookings.'
                : 'You are currently unavailable for new bookings.'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleAvailability}
            trackColor={{ false: '#475569', true: '#10b981' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Audio & Video Call Availability Sub-Cards */}
        <View style={styles.callAvailRow}>
          <View style={styles.callAvailItem}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.callAvailLabel}>📞 Audio Calls</Text>
              <Text style={styles.callAvailSub}>{isAudioCallAvailable ? 'Online' : 'Paused'}</Text>
            </View>
            <Switch
              value={isAudioCallAvailable}
              onValueChange={(val) => handleToggleCallAvailability('audio', val)}
              trackColor={{ false: '#475569', true: '#10b981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.callAvailItem}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.callAvailLabel}>📹 Video Calls</Text>
              <Text style={styles.callAvailSub}>{isVideoCallAvailable ? 'Online' : 'Paused'}</Text>
            </View>
            <Switch
              value={isVideoCallAvailable}
              onValueChange={(val) => handleToggleCallAvailability('video', val)}
              trackColor={{ false: '#475569', true: '#10b981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* 4 Metric Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Earnings</Text>
            <Text style={styles.metricValue}>
              ₹{(stats.totalEarnings || 0).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.metricSub}>Lifetime</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pending Payout</Text>
            <Text style={[styles.metricValue, { color: '#fbbf24' }]}>
              ₹{(stats.pendingPayout || 0).toLocaleString('en-IN')}
            </Text>
            <TouchableOpacity onPress={() => setWithdrawModalVisible(true)}>
              <Text style={styles.withdrawLinkText}>Withdraw ➔</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={[styles.metricValue, { color: '#38bdf8' }]}>
              {stats.completedBookings || 0}
            </Text>
            <Text style={styles.metricSub}>Ceremonies</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>New Requests</Text>
            <Text style={[styles.metricValue, { color: '#f87171' }]}>
              {stats.pendingRequestsCount || 0}
            </Text>
            <Text style={styles.metricSub}>Action needed</Text>
          </View>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'requests' && styles.tabButtonTextActive]}>
              Requests ({pendingRequests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'active' && styles.tabButtonTextActive]}>
              Confirmed ({upcomingBookings.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'calls' && styles.tabButtonActive]}
            onPress={() => setActiveTab('calls')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'calls' && styles.tabButtonTextActive]}>
              Calls ({recentCalls.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'wallet' && styles.tabButtonActive]}
            onPress={() => setActiveTab('wallet')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'wallet' && styles.tabButtonTextActive]}>
              Wallet & Payout
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Pending & Assigned Requests */}
        {activeTab === 'requests' && (
          <View style={styles.tabContentArea}>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="notifications-outline" size={44} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No pending booking requests</Text>
                <Text style={styles.emptyStateText}>
                  When customers or admins assign you to a Puja or ceremony, requests will appear here for your acceptance.
                </Text>
              </View>
            ) : (
              pendingRequests.map((b: any) => (
                <View key={b._id || b.id} style={styles.bookingCard}>
                  <View style={styles.bookingCardHeader}>
                    <View>
                      <Text style={styles.bookingRef}>#{b.bookingReference || 'BOOKING'}</Text>
                      <Text style={styles.serviceTitle}>{b.serviceName}</Text>
                    </View>
                    <View style={styles.badgeAssigned}>
                      <Text style={styles.badgeAssignedText}>
                        {b.status === 'assigned' ? 'Assigned to you' : 'Requested'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetailsCol}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#d97706" />
                      <Text style={styles.detailText}>
                        {b.bookingDate} • {b.timeSlot}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#d97706" />
                      <Text style={styles.detailText}>
                        {b.venueAddress || b.city || 'Devotee Residence'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={16} color="#d97706" />
                      <Text style={styles.detailText}>
                        {b.userName || 'Devotee'} ({b.userMobile || 'Confidential'})
                      </Text>
                    </View>
                    {b.priceInr > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color="#10b981" />
                        <Text style={[styles.detailText, { color: '#10b981', fontWeight: 'bold' }]}>
                          Dakshina: ₹{b.priceInr.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                    {b.specialRequests ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>Notes / Vidhi:</Text>
                        <Text style={styles.notesContent}>{b.specialRequests}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions: Accept or Decline */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.btnAction, styles.btnDecline]}
                      onPress={() => handleDeclineBooking(b._id || b.id)}
                      disabled={actionLoadingId === (b._id || b.id)}
                    >
                      <Text style={styles.btnDeclineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAction, styles.btnAccept]}
                      onPress={() => handleAcceptBooking(b._id || b.id)}
                      disabled={actionLoadingId === (b._id || b.id)}
                    >
                      {actionLoadingId === (b._id || b.id) ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.btnAcceptText}>Accept Booking ✓</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 2: Confirmed / Upcoming Bookings */}
        {activeTab === 'active' && (
          <View style={styles.tabContentArea}>
            {upcomingBookings.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No confirmed upcoming ceremonies</Text>
                <Text style={styles.emptyStateText}>
                  Accepted bookings will appear here. After performing the puja, mark them complete to credit your Dakshina.
                </Text>
              </View>
            ) : (
              upcomingBookings.map((b: any) => (
                <View key={b._id || b.id} style={styles.bookingCard}>
                  <View style={styles.bookingCardHeader}>
                    <View>
                      <Text style={styles.bookingRef}>#{b.bookingReference || 'CONFIRMED'}</Text>
                      <Text style={styles.serviceTitle}>{b.serviceName}</Text>
                    </View>
                    <View style={styles.badgeConfirmed}>
                      <Text style={styles.badgeConfirmedText}>Confirmed</Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetailsCol}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#10b981" />
                      <Text style={styles.detailText}>
                        {b.bookingDate} • {b.timeSlot}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#10b981" />
                      <Text style={styles.detailText}>
                        {b.venueAddress || b.city || 'In-Person Venue'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={16} color="#10b981" />
                      <Text style={styles.detailText}>
                        {b.userName || 'Devotee'} • {b.userMobile || 'Contact via Call'}
                      </Text>
                    </View>
                    {b.priceInr > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color="#10b981" />
                        <Text style={[styles.detailText, { color: '#10b981', fontWeight: 'bold' }]}>
                          Dakshina: ₹{b.priceInr.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.btnCompleteBooking, { backgroundColor: '#1E40AF', marginBottom: 8 }]}
                    onPress={() => handleOpenBookingChat(b)}
                  >
                    <Text style={styles.btnCompleteText}>Open Devotee Consultation Chat 💬</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnCompleteBooking}
                    onPress={() => handleCompleteBooking(b._id || b.id)}
                    disabled={actionLoadingId === (b._id || b.id)}
                  >
                    {actionLoadingId === (b._id || b.id) ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.btnCompleteText}>Mark Ceremony Completed 🕉️</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab: Calls & Consultations */}
        {activeTab === 'calls' && (
          <View style={styles.tabContentArea}>
            {recentCalls.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="call-outline" size={44} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No recent consultation calls</Text>
                <Text style={styles.emptyStateText}>
                  Devotees requesting audio or video astrological guidance will appear here with call records and consultation earnings.
                </Text>
              </View>
            ) : (
              recentCalls.map((c: any) => (
                <View key={c._id || c.sessionId} style={styles.bookingCard}>
                  <View style={styles.bookingCardHeader}>
                    <View>
                      <Text style={styles.bookingRef}>#{c.sessionId || 'CALL'}</Text>
                      <Text style={styles.serviceTitle}>
                        {c.callType === 'video' ? '📹 Live Video Consultation' : '📞 Audio Consultation'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badgeAssigned,
                        c.status === 'ended'
                          ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }
                          : { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeAssignedText,
                          c.status === 'ended' ? { color: '#10b981' } : { color: '#ef4444' },
                        ]}
                      >
                        {String(c.status || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetailsCol}>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={16} color="#d97706" />
                      <Text style={styles.detailText}>Devotee: {c.callerName || 'Devotee'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color="#d97706" />
                      <Text style={styles.detailText}>
                        Duration: {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                      </Text>
                    </View>
                    {c.panditEarnings > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color="#10b981" />
                        <Text style={[styles.detailText, { color: '#10b981', fontWeight: '700' }]}>
                          Earnings Credited: ₹{c.panditEarnings}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.actionButtonsRow, { marginTop: 12 }]}>
                    <TouchableOpacity
                      style={[styles.btnAccept, { backgroundColor: '#8B1D24', flex: 1, marginRight: 6 }]}
                      onPress={() => {
                        navigation.navigate('Call', {
                          callType: 'audio',
                          targetUserId: c.callerId,
                          targetUserName: c.callerName,
                          panditId: pandit.id || pandit._id,
                        });
                      }}
                    >
                      <Ionicons name="call" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.btnAcceptText}>Call Audio</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnAccept, { backgroundColor: '#B8860B', flex: 1, marginLeft: 6 }]}
                      onPress={() => {
                        navigation.navigate('Call', {
                          callType: 'video',
                          targetUserId: c.callerId,
                          targetUserName: c.callerName,
                          panditId: pandit.id || pandit._id,
                        });
                      }}
                    >
                      <Ionicons name="videocam" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.btnAcceptText}>Call Video</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 3: Wallet & Payout History */}
        {activeTab === 'wallet' && (
          <View style={styles.tabContentArea}>
            <View style={styles.walletOverviewCard}>
              <Text style={styles.walletCardLabel}>AVAILABLE FOR WITHDRAWAL</Text>
              <Text style={styles.walletCardAmount}>
                ₹{(walletData?.pendingPayout || stats.pendingPayout || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.walletCardSub}>
                Lifetime Earned: ₹{(walletData?.totalEarnings || stats.totalEarnings || 0).toLocaleString('en-IN')}
              </Text>

              <TouchableOpacity
                style={styles.btnWithdrawNow}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <Text style={styles.btnWithdrawNowText}>Request Payout Transfer 🏦</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeaderTitle}>Withdrawal History</Text>
            {(!walletData?.withdrawals || walletData.withdrawals.length === 0) ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="wallet-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No withdrawal requests yet</Text>
              </View>
            ) : (
              walletData.withdrawals.map((w: any) => (
                <View key={w.id || w.withdrawalId} style={styles.withdrawalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.withdrawIdText}>#{w.withdrawalId}</Text>
                    <Text style={styles.withdrawDateText}>
                      {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.withdrawAmountText}>₹{w.amount.toLocaleString('en-IN')}</Text>
                    <Text
                      style={[
                        styles.withdrawStatusBadge,
                        w.status === 'paid' ? styles.statusPaid : styles.statusPending,
                      ]}
                    >
                      {w.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Withdrawal Request Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Payout Transfer</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Withdrawal Amount (₹)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              placeholderTextColor="#94a3b8"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <Text style={styles.inputLabel}>UPI ID or Bank Account Details</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. panditji@okaxis"
              placeholderTextColor="#94a3b8"
              value={withdrawUpi}
              onChangeText={setWithdrawUpi}
            />

            <TouchableOpacity
              style={styles.btnModalSubmit}
              onPress={handleSubmitWithdrawal}
              disabled={submittingWithdrawal}
            >
              {submittingWithdrawal ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnModalSubmitText}>Submit Payout Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadgeRow: {
    marginLeft: 8,
  },
  verificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeApproved: {
    backgroundColor: '#065F46',
  },
  badgePending: {
    backgroundColor: '#92400E',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  availTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  availSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  callAvailRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
    marginBottom: 16,
  },
  callAvailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  callAvailLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  callAvailSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  metricSub: {
    color: '#64748B',
    fontSize: 11,
  },
  withdrawLinkText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#8B1D24',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  tabContentArea: {
    gap: 12,
  },
  emptyStateCard: {
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyStateTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bookingCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
    marginBottom: 10,
  },
  bookingRef: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  serviceTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  badgeAssigned: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAssignedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeConfirmed: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeConfirmedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingDetailsCol: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  notesBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  notesLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  notesContent: {
    color: '#F8FAFC',
    fontSize: 12,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDecline: {
    backgroundColor: '#334155',
  },
  btnDeclineText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
  btnAccept: {
    backgroundColor: '#059669',
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnCompleteBooking: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  btnCompleteText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  walletOverviewCard: {
    backgroundColor: '#1E293B',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D97706',
    marginBottom: 16,
  },
  walletCardLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  walletCardAmount: {
    color: '#F59E0B',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 6,
  },
  walletCardSub: {
    color: '#64748B',
    fontSize: 12,
  },
  btnWithdrawNow: {
    backgroundColor: '#D97706',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  btnWithdrawNowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sectionHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  withdrawalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  withdrawIdText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  withdrawDateText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  withdrawAmountText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  withdrawStatusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusPaid: {
    color: '#10B981',
  },
  statusPending: {
    color: '#F59E0B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  btnModalSubmit: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  btnModalSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
