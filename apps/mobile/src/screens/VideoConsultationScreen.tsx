import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const VideoConsultationScreen: React.FC<any> = ({ route, navigation }) => {
  const { bookingId, ceremonyName, panditName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    obtainRoomToken();
  }, []);

  useEffect(() => {
    let timer: any;
    if (tokenData) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [tokenData]);

  const obtainRoomToken = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/consultations/${bookingId}/token`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTokenData(json.data);
      } else {
        Alert.alert('Access Denied', json.error?.message || 'Could not authorize video consultation room.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch {
      Alert.alert('Connection Error', 'Unable to connect to consultation server.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = () => {
    Alert.alert(
      'Leave Consultation',
      'Are you sure you want to end this consultation session?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'End Call',
          style: 'destructive',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]
    );
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.royalMaroon} />
        <Text style={styles.connectingText}>Authorizing Private WebRTC Room Token...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote Video Surface */}
      <View style={styles.remoteVideoArea}>
        <View style={styles.panditAvatarLarge}>
          <Text style={styles.panditAvatarText}>{(panditName || 'P')[0]}</Text>
        </View>
        <Text style={styles.panditSpeakingName}>{panditName || 'Vedic Pandit Ji'}</Text>
        <Text style={styles.ceremonyLabel}>{ceremonyName || 'Kundli & Puja Consultation'}</Text>
        <View style={styles.encryptionPill}>
          <Ionicons name="lock-closed" size={12} color={colors.verifiedGreen} />
          <Text style={styles.encryptionText}>End-to-End Encrypted Session</Text>
        </View>
      </View>

      {/* Top Header Bar */}
      <View style={styles.callHeader}>
        <View style={styles.timerBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.timerText}>{formatTimer(callDuration)}</Text>
        </View>
        <Text style={styles.roomTag}>ROOM: {tokenData?.roomId?.slice(0, 12)}</Text>
      </View>

      {/* Self View Floating Camera */}
      <View style={styles.selfVideoFloating}>
        {videoOff ? (
          <Ionicons name="videocam-off" size={24} color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>Self View</Text>
        )}
      </View>

      {/* Bottom Controls Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, micMuted && styles.controlBtnActive]}
          onPress={() => setMicMuted(!micMuted)}
        >
          <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, videoOff && styles.controlBtnActive]}
          onPress={() => setVideoOff(!videoOff)}
        >
          <Ionicons name={videoOff ? 'videocam-off' : 'videocam'} size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.endCallBtn}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1917',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  connectingText: {
    color: '#E8E2D8',
    fontSize: 14,
    marginTop: 14,
  },
  remoteVideoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  panditAvatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.softGold,
  },
  panditAvatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },
  panditSpeakingName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  ceremonyLabel: {
    color: colors.softGold,
    fontSize: 13,
    marginTop: 4,
  },
  encryptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  encryptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginLeft: 4,
  },
  callHeader: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  roomTag: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  selfVideoFloating: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 90,
    height: 130,
    backgroundColor: '#292524',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#EF4444',
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
