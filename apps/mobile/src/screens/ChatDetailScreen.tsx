import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale } from '../design';
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
import { getInitials } from '../components/home/matchPhoto';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

export const ChatDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId, partnerName } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactExchange, setContactExchange] = useState<ContactExchangeDetails>({
    status: 'none',
  });
  const [contactActionLoading, setContactActionLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const token = getSessionToken();
  const currentUserId = getSessionUserId() || 'me';

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMessages(token, conversationId, 1, 50);
      if (res.data) {
        // Backend returns newest first; reverse for chronological order
        const sorted = [...res.data.items].reverse();
        setMessages(sorted);
      }
      await markMessagesAsRead(token, conversationId);
    } catch (err: any) {
      setError(err?.message || 'Could not load conversation messages.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    loadMessages();

    const socket = initChatSocket(token);
    joinConversationRoom(conversationId);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markMessagesAsRead(token, conversationId).catch(() => {});
      }
    };

    const handleMessagesRead = (payload: { conversationId: string; readerId: string }) => {
      if (payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId ? { ...m, status: 'read' } : m
          )
        );
      }
    };

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
      Alert.alert('Message Failed', err?.message || 'Unable to send message.');
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
        Alert.alert('Request Sent', 'Your contact exchange request has been sent.');
      } else if (action === 'accept') {
        Alert.alert('Contacts Shared 🎉', 'Mutual contact details have been unlocked!');
      }
    } catch (err: any) {
      Alert.alert('Action Notice', err?.message || 'Could not update contact status.');
    } finally {
      setContactActionLoading(false);
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessageBubble = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;
    const isRead = item.status === 'read';

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            styles.bubbleContainer,
            isMe ? styles.bubbleMe : styles.bubbleThem,
          ]}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={[
              styles.messageText,
              isMe ? styles.messageTextMe : styles.messageTextThem,
            ]}
          >
            {item.text}
          </Text>

          <View style={styles.bubbleFooter}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.messageTime,
                isMe ? styles.messageTimeMe : styles.messageTimeThem,
              ]}
            >
              {formatMessageTime(item.createdAt)}
            </Text>

            {isMe && (
              <Ionicons
                name={isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={isRead ? '#93C5FD' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>

        <View style={styles.partnerInfoCol}>
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={styles.partnerHeading}
          >
            {partnerName}
          </Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text maxFontSizeMultiplier={1.2} style={styles.onlineText}>
              {t('chatScreen.online')}
            </Text>
          </View>
        </View>

        <View style={styles.avatarMini}>
          <Text maxFontSizeMultiplier={1.2} style={styles.avatarMiniText}>
            {getInitials(partnerName)}
          </Text>
        </View>
      </View>

      {/* Contact Exchange Banner */}
      <View style={styles.contactBanner}>
        {contactExchange.status === 'accepted' ? (
          <View style={styles.contactSharedBox}>
            <Ionicons name="call" size={15} color="#166534" />
            <Text maxFontSizeMultiplier={1.2} style={styles.contactSharedTitle}>
              {t('chatScreen.contactUnlocked')}
            </Text>
          </View>
        ) : contactExchange.status === 'requested' &&
          contactExchange.requestedBy !== currentUserId ? (
          <View style={styles.contactActionBox}>
            <Text maxFontSizeMultiplier={1.2} style={styles.contactActionPrompt}>
              {partnerName} requested contact sharing:
            </Text>
            <View style={styles.contactBtnRow}>
              <PressableScale
                style={styles.acceptContactBtn}
                onPress={() => handleContactAction('accept')}
                disabled={contactActionLoading}
              >
                <Text maxFontSizeMultiplier={1.2} style={styles.acceptContactText}>
                  {t('chatScreen.acceptContact')}
                </Text>
              </PressableScale>
              <PressableScale
                style={styles.declineContactBtn}
                onPress={() => handleContactAction('decline')}
                disabled={contactActionLoading}
              >
                <Text maxFontSizeMultiplier={1.2} style={styles.declineContactText}>
                  {t('chatScreen.declineContact')}
                </Text>
              </PressableScale>
            </View>
          </View>
        ) : contactExchange.status === 'requested' ? (
          <View style={styles.contactPendingBox}>
            <Ionicons name="hourglass-outline" size={14} color="#92400E" />
            <Text maxFontSizeMultiplier={1.2} style={styles.contactPendingText}>
              {t('chatScreen.contactPending')}
            </Text>
          </View>
        ) : (
          <PressableScale
            style={styles.requestContactBar}
            onPress={() => handleContactAction('request')}
            disabled={contactActionLoading}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.requestContactBarText}>
              {t('chatScreen.requestContact')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={ds.color.maroon} />
          </PressableScale>
        )}
      </View>

      {/* Keyboard-avoiding message area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.loadingText}>
              Loading sacred conversation...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageBubble}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Bottom Input Area */}
        <View
          style={[
            styles.inputToolbar,
            { paddingBottom: Math.max(insets.bottom, ds.space.sm) },
          ]}
        >
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              placeholder={t('chatScreen.inputPlaceholder')}
              placeholderTextColor={ds.color.textMuted}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={1000}
            />

            <PressableScale
              style={[
                styles.sendBtn,
                !inputMessage.trim() && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputMessage.trim() || sending}
              accessibilityLabel="Send Message"
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFFFFF" />
              )}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  partnerInfoCol: {
    flex: 1,
    marginLeft: ds.space.md,
  },
  partnerHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  onlineText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  avatarMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  contactBanner: {
    backgroundColor: ds.color.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
    paddingHorizontal: ds.space.md,
    paddingVertical: 7,
  },
  requestContactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestContactBarText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  contactSharedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactSharedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  contactActionBox: {
    paddingVertical: 2,
  },
  contactActionPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: ds.color.text,
    marginBottom: 4,
  },
  contactBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptContactBtn: {
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  acceptContactText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  declineContactBtn: {
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  declineContactText: {
    color: ds.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  contactPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  messagesList: {
    padding: ds.space.md,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  bubbleContainer: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...ds.shadow.soft,
  },
  bubbleMe: {
    backgroundColor: ds.color.maroon,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextThem: {
    color: ds.color.text,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  messageTime: {
    fontSize: 10,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.75)',
  },
  messageTimeThem: {
    color: ds.color.textMuted,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: ds.space.sm,
    fontSize: 13,
    color: ds.color.textMuted,
  },
  inputToolbar: {
    backgroundColor: ds.color.surface,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.sm,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: ds.color.text,
    maxHeight: 90,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ds.color.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1C7BD',
  },
});
