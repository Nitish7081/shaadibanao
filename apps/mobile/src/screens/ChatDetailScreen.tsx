import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  requestContactExchange,
  initChatSocket,
  joinConversationRoom,
  leaveConversationRoom,
  getSessionToken,
  getSessionUserId,
} from '../services';
import { ChatMessage, ContactExchangeDetails } from '@bandhansetu/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

export const ChatDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, partnerName } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactExchange, setContactExchange] = useState<ContactExchangeDetails>({
    status: 'none',
  });
  const [contactActionLoading, setContactActionLoading] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const token = getSessionToken();
  const currentUserId = getSessionUserId() || 'me';

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMessages(token, conversationId, 1, 50);
      if (res.data) {
        // Backend returns newest first; reverse for bottom-to-top chat order
        const sorted = [...res.data.items].reverse();
        setMessages(sorted);
      }
      // Mark messages as read
      await markMessagesAsRead(token, conversationId);
    } catch (err: any) {
      setError(err.message || 'Could not load conversation messages.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    loadMessages();

    // Initialize Socket.IO connection
    const socket = initChatSocket(token);
    joinConversationRoom(conversationId);

    // Listen for new incoming messages
    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markMessagesAsRead(token, conversationId).catch(() => {});
      }
    };

    // Listen for read receipts
    const handleMessagesRead = (payload: { conversationId: string; readerId: string }) => {
      if (payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId ? { ...m, status: 'read' } : m
          )
        );
      }
    };

    // Listen for contact exchange updates
    const handleContactUpdate = (payload: {
      conversationId: string;
      contactExchange: ContactExchangeDetails;
    }) => {
      if (payload.conversationId === conversationId) {
        setContactExchange(payload.contactExchange);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('contact_exchange_updated', handleContactUpdate);

    return () => {
      leaveConversationRoom(conversationId);
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('contact_exchange_updated', handleContactUpdate);
    };
  }, [conversationId, token, currentUserId, loadMessages]);

  const handleSend = async () => {
    const text = inputMessage.trim();
    if (!text || sending) return;

    setInputMessage('');
    setSending(true);

    try {
      const res = await sendMessage(token, conversationId, text);
      if (res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data?.id)) return prev;
          return [...prev, res.data!];
        });
      }
    } catch (err: any) {
      Alert.alert('Message Failed', err.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleContactAction = async (action: 'request' | 'accept' | 'decline') => {
    setContactActionLoading(true);
    try {
      const res = await requestContactExchange(token, conversationId, action);
      if (res.data) {
        setContactExchange(res.data);
      }
      if (action === 'request') {
        Alert.alert(
          'Contact Request Sent 📱',
          `A verified contact request was sent to ${partnerName}. Both parties must consent before phone numbers are disclosed.`
        );
      } else if (action === 'accept') {
        Alert.alert(
          'Contact Details Unlocked 🎉',
          `You and ${partnerName} have mutually consented to share contact details.`
        );
      } else if (action === 'decline') {
        Alert.alert('Declined', 'Contact request was declined.');
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not process contact sharing request.');
    } finally {
      setContactActionLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={partnerName}
        subtitle="✓ ID Verified • Mutual Match"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        rightAction={
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ReportBlock', {
                profileId: conversationId,
                name: partnerName,
              })
            }
            style={styles.menuBtn}
          >
            <Text style={styles.menuText}>⚠️ Report</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusNotice
          milestoneText="Milestone 6 Secure Real-Time Chat Active"
          subtext="End-to-end verified mutual match access control and Socket.IO real-time delivery."
        />

        {/* Blueprint Safety Warning Banner (Blueprint S-14) */}
        <View style={styles.safetyBanner}>
          <Text style={styles.safetyIcon}>🛡️</Text>
          <Text style={styles.safetyText}>
            Safety First: Never send money, OTPs, or bank details. Verified identity badges do not
            guarantee financial safety.
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.royalMaroon} />
            <Text style={styles.loadingText}>Connecting to conversation...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadMessages} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Blueprint Contact Share Consent Card (Blueprint S-14) */}
          <View style={styles.contactShareCard}>
            <Text style={styles.contactShareIcon}>📱</Text>
            <View style={styles.contactShareBody}>
              <Text style={styles.contactShareTitle}>Verified Contact Sharing</Text>

              {contactExchange.status === 'accepted' ? (
                <View style={styles.unlockedBox}>
                  <Text style={styles.unlockedText}>
                    ✅ Mutual Consent Granted! Contact details:
                  </Text>
                  <Text style={styles.unlockedDetail}>
                    Phone: {contactExchange.phone || '+91 98XXXXXXXX'}
                  </Text>
                  {contactExchange.email && (
                    <Text style={styles.unlockedDetail}>Email: {contactExchange.email}</Text>
                  )}
                </View>
              ) : contactExchange.status === 'requested' ? (
                <View>
                  <Text style={styles.contactShareDesc}>
                    A contact sharing request is currently pending review.
                  </Text>
                  <View style={styles.contactBtnRow}>
                    <Button
                      title="Accept Share"
                      onPress={() => handleContactAction('accept')}
                      loading={contactActionLoading}
                      variant="primary"
                      style={styles.contactBtnHalf}
                    />
                    <Button
                      title="Decline"
                      onPress={() => handleContactAction('decline')}
                      disabled={contactActionLoading}
                      variant="secondary"
                      style={styles.contactBtnHalf}
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.contactShareDesc}>
                    Phone numbers remain strictly masked by default. Both you and {partnerName} must
                    explicitly consent to disclose numbers.
                  </Text>
                  <Button
                    title="Request Contact Share"
                    onPress={() => handleContactAction('request')}
                    loading={contactActionLoading}
                    variant="upgrade"
                    style={styles.contactShareBtn}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Messages */}
          {messages.length === 0 && !loading && !error && (
            <View style={styles.emptyNotice}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Start your conversation</Text>
              <Text style={styles.emptySub}>
                Say hello to {partnerName}! Keep your introduction polite, respectful, and focused on shared values.
              </Text>
            </View>
          )}

          {messages.map((msg) => {
            const isUser = msg.senderId === currentUserId;
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrapper,
                  isUser ? styles.userWrapper : styles.partnerWrapper,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.partnerBubble,
                  ]}
                >
                  <Text style={[styles.messageText, isUser ? styles.userText : styles.partnerText]}>
                    {msg.text}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.timeText, isUser ? styles.userTime : styles.partnerTime]}>
                      {formatTime(msg.createdAt)}
                    </Text>
                    {isUser && (
                      <Text style={styles.receiptText}>
                        {msg.status === 'read' ? ' ✓✓' : ' ✓'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Message Input Footer */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a respectful message..."
            placeholderTextColor={colors.textMuted}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline={false}
            maxLength={1000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputMessage.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  menuBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.errorBg,
    borderRadius: borderRadius.sm,
  },
  menuText: {
    fontSize: typography.fontSizes.xs,
    color: colors.alertRed,
    fontWeight: '700',
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  safetyIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  safetyText: {
    flex: 1,
    fontSize: typography.fontSizes.xs - 1,
    color: '#8D6E63',
    lineHeight: 16,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    padding: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSizes.xs,
    color: colors.alertRed,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  messagesContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  contactShareCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.softGold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  contactShareIcon: {
    fontSize: 26,
    marginRight: spacing.sm,
  },
  contactShareBody: {
    flex: 1,
  },
  contactShareTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: colors.charcoal,
  },
  contactShareDesc: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    marginVertical: 4,
    lineHeight: 16,
  },
  contactShareBtn: {
    minHeight: 36,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  contactBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  contactBtnHalf: {
    flex: 1,
    minHeight: 34,
    paddingVertical: spacing.xs,
  },
  unlockedBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#E8F5E9',
    borderRadius: borderRadius.sm,
  },
  unlockedText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 2,
  },
  unlockedDetail: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '600',
  },
  emptyNotice: {
    alignItems: 'center',
    padding: spacing.xl,
    marginVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  emptySub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  messageBubbleWrapper: {
    marginBottom: spacing.md,
    maxWidth: '82%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  partnerWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  userBubble: {
    backgroundColor: colors.royalMaroon,
    borderBottomRightRadius: 2,
  },
  partnerBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  messageText: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  partnerText: {
    color: colors.charcoal,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  timeText: {
    fontSize: 10,
  },
  userTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  partnerTime: {
    color: colors.textMuted,
  },
  receiptText: {
    fontSize: 10,
    color: colors.softGold,
    marginLeft: 3,
  },
  inputBar: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSizes.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    color: colors.charcoal,
  },
  sendButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.royalMaroon,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.fontSizes.sm,
  },
});
