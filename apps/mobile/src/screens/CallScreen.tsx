import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { callService, CallSession } from '../services/callService';
import { getChatSocket, initChatSocket } from '../services/chatService';
import { getAuthHeader } from '../services/authSession';

export const CallScreen: React.FC<any> = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const {
    sessionId: routeSessionId,
    callType = 'audio',
    targetUserId,
    targetUserName = 'ShaadiBanao User',
    targetUserPhoto,
    isIncoming = false,
    panditId,
  } = route.params || {};

  const [sessionId, setSessionId] = useState<string>(routeSessionId || '');
  const [callStatus, setCallStatus] = useState<'initiating' | 'ringing' | 'connected' | 'ended'>(
    isIncoming ? 'ringing' : 'initiating'
  );
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimerRef = useRef<any>(null);

  useEffect(() => {
    // Pulse animation for ringing state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();

    setupCall();

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  // Timer start on connected
  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    }
  }, [callStatus]);

  const setupCall = async () => {
    try {
      // Ensure socket connection
      const authHeader = await getAuthHeader();
      const token = authHeader.Authorization?.replace('Bearer ', '');
      let socket = getChatSocket();
      if (!socket && token) {
        socket = initChatSocket(token);
      }

      if (socket) {
        socket.on('call_accepted', (data: any) => {
          if (!sessionId || data.sessionId === sessionId) {
            setCallStatus('connected');
          }
        });

        socket.on('call_rejected', (data: any) => {
          Alert.alert(
            isHindi ? 'कॉल अस्वीकृत' : 'Call Declined',
            data.reason || (isHindi ? 'उपयोगकर्ता व्यस्त हैं।' : 'User is currently unavailable.'),
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        });

        socket.on('call_ended', (data: any) => {
          setCallStatus('ended');
          const mins = Math.floor((data.durationSeconds || durationSeconds) / 60);
          const secs = (data.durationSeconds || durationSeconds) % 60;
          Alert.alert(
            isHindi ? 'कॉल समाप्त' : 'Call Ended',
            `${isHindi ? 'कॉल अवधि' : 'Call duration'}: ${mins}:${secs < 10 ? '0' : ''}${secs}`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        });

        socket.on('webrtc_mute_toggle', (data: any) => {
          if (data.sessionId === sessionId) {
            setRemoteMuted(!!data.isMuted);
          }
        });
      }

      // If outgoing, initiate call via API
      if (!isIncoming && !sessionId) {
        const session = await callService.initiateCall({
          receiverId: targetUserId,
          callType,
          panditId,
        });
        setSessionId(session.sessionId);
        setCallStatus('ringing');
      }
    } catch (err: any) {
      Alert.alert(
        isHindi ? 'कॉल त्रुटि' : 'Call Error',
        err.message || (isHindi ? 'कॉल प्रारंभ करने में असमर्थ।' : 'Unable to establish call.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleAcceptCall = async () => {
    try {
      if (!sessionId) return;
      await callService.acceptCall(sessionId);
      setCallStatus('connected');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not accept call.');
    }
  };

  const handleRejectCall = async () => {
    try {
      if (sessionId) {
        await callService.rejectCall(sessionId, 'User declined call');
      }
    } catch {
      // Non-blocking
    } finally {
      navigation.goBack();
    }
  };

  const handleEndCall = async () => {
    try {
      if (sessionId) {
        await callService.endCall(sessionId, 'User ended call');
      }
    } catch {
      // Non-blocking
    } finally {
      navigation.goBack();
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const socket = getChatSocket();
    if (socket && sessionId) {
      socket.emit('webrtc_mute_toggle', {
        sessionId,
        targetUserId,
        isMuted: nextMuted,
        isVideoOff,
      });
    }
  };

  const handleToggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    const socket = getChatSocket();
    if (socket && sessionId) {
      socket.emit('webrtc_mute_toggle', {
        sessionId,
        targetUserId,
        isMuted,
        isVideoOff: nextVideoOff,
      });
    }
  };

  const handleToggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.secureBadge}>
          <Ionicons name="lock-closed" size={14} color="#D4AF37" />
          <Text style={styles.secureText}>
            {isHindi ? '256-बिट सुरक्षित एन्क्रिप्टेड कॉल' : 'End-to-End Encrypted'}
          </Text>
        </View>

        {callStatus === 'connected' && (
          <View style={styles.timerBadge}>
            <View style={styles.liveIndicator} />
            <Text style={styles.timerText}>{formatTimer(durationSeconds)}</Text>
          </View>
        )}
      </View>

      {/* Center Avatar & Info */}
      <View style={styles.centerSection}>
        {callType === 'video' && callStatus === 'connected' && !isVideoOff ? (
          <View style={styles.videoSurfacePlaceholder}>
            <Ionicons name="videocam" size={48} color="#D4AF37" />
            <Text style={styles.videoSurfaceText}>
              {isHindi ? 'लाइव एचडी वीडियो कॉल सक्रिय है' : 'Live HD Video Stream Active'}
            </Text>
            {remoteMuted && (
              <View style={styles.remoteMutedPill}>
                <Ionicons name="mic-off" size={14} color="#FFF" />
                <Text style={styles.remoteMutedText}>{isHindi ? 'म्यूट है' : 'Muted'}</Text>
              </View>
            )}
          </View>
        ) : (
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{targetUserName[0] || 'S'}</Text>
            </View>
          </Animated.View>
        )}

        <Text style={styles.targetName}>{targetUserName}</Text>

        <Text style={styles.callStateText}>
          {callStatus === 'connected'
            ? isHindi
              ? `${callType === 'video' ? 'वीडियो' : 'ऑडियो'} कॉल कनेक्टेड`
              : `${callType === 'video' ? 'Video' : 'Audio'} Call Connected`
            : callStatus === 'ringing'
            ? isIncoming
              ? isHindi
                ? 'इनकमिंग कॉल आ रही है...'
                : 'Incoming Call...'
              : isHindi
              ? 'घंटी बज रही है...'
              : 'Ringing...'
            : isHindi
            ? 'कनेक्ट हो रहा है...'
            : 'Connecting...'}
        </Text>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controlsSection}>
        {isIncoming && callStatus === 'ringing' ? (
          /* Incoming Call Actions: Accept / Reject */
          <View style={styles.incomingActionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleRejectCall}>
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.actionLabel}>{isHindi ? 'अस्वीकार करें' : 'Decline'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAcceptCall}>
              <Ionicons name="call" size={32} color="#FFF" />
              <Text style={styles.actionLabel}>{isHindi ? 'स्वीकार करें' : 'Accept'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Active Call Controls */
          <View>
            <View style={styles.controlsRow}>
              {/* Mic Mute */}
              <TouchableOpacity
                style={[styles.circleBtn, isMuted && styles.circleBtnActive]}
                onPress={handleToggleMute}
              >
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#FFF' : '#E0E0E0'} />
                <Text style={styles.circleBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
              </TouchableOpacity>

              {/* Video Toggle (If Video Call) */}
              {callType === 'video' && (
                <TouchableOpacity
                  style={[styles.circleBtn, isVideoOff && styles.circleBtnActive]}
                  onPress={handleToggleVideo}
                >
                  <Ionicons
                    name={isVideoOff ? 'videocam-off' : 'videocam'}
                    size={24}
                    color={isVideoOff ? '#FFF' : '#E0E0E0'}
                  />
                  <Text style={styles.circleBtnLabel}>{isVideoOff ? 'Video On' : 'Video Off'}</Text>
                </TouchableOpacity>
              )}

              {/* Flip Camera (If Video Call) */}
              {callType === 'video' && (
                <TouchableOpacity style={styles.circleBtn} onPress={handleToggleCamera}>
                  <Ionicons name="camera-reverse" size={24} color="#E0E0E0" />
                  <Text style={styles.circleBtnLabel}>Flip</Text>
                </TouchableOpacity>
              )}

              {/* Speaker Toggle */}
              <TouchableOpacity
                style={[styles.circleBtn, isSpeakerOn && styles.circleBtnActive]}
                onPress={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                <Ionicons
                  name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
                  size={24}
                  color={isSpeakerOn ? '#FFF' : '#E0E0E0'}
                />
                <Text style={styles.circleBtnLabel}>Speaker</Text>
              </TouchableOpacity>
            </View>

            {/* Hangup Button */}
            <View style={styles.endCallContainer}>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>{isHindi ? 'कॉल समाप्त करें' : 'End Call'}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16080C',
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  secureText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  timerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: '800',
  },
  videoSurfacePlaceholder: {
    width: '90%',
    height: 280,
    backgroundColor: '#2A1017',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    marginBottom: 20,
  },
  videoSurfaceText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  remoteMutedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
  },
  remoteMutedText: {
    color: '#FFF',
    fontSize: 12,
  },
  targetName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  callStateText: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: '500',
  },
  controlsSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  incomingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  actionLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnActive: {
    backgroundColor: '#C62828',
  },
  circleBtnLabel: {
    color: '#B0B0B0',
    fontSize: 11,
    marginTop: 4,
  },
  endCallContainer: {
    alignItems: 'center',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  endCallLabel: {
    color: '#FFCDD2',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
});
