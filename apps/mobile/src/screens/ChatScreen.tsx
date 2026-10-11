import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

interface ChatScreenProps {
  route?: { params?: { conversationId?: string; partnerName?: string } };
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const partnerName = route?.params?.partnerName || 'Priya S.';
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'partner',
      text: 'Namaste Rohan! Thanks for accepting my interest.',
      time: '10:30 AM',
    },
    {
      id: '2',
      sender: 'user',
      text: 'Namaste Priya, great to connect with you.',
      time: '10:32 AM',
    },
    {
      id: '3',
      sender: 'partner',
      text: 'Would you like our families to speak this weekend?',
      time: '10:35 AM',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMsg = {
      id: String(Date.now()),
      sender: 'user',
      text: inputMessage.trim(),
      time: 'Just now',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
  };

  const handleRequestContact = () => {
    Alert.alert(
      'Contact Share Request',
      `A formal request has been sent to ${partnerName}. Both parties must explicitly consent before numbers are revealed.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={partnerName}
        subtitle="✓ ID Verified • Active Today"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        rightAction={
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ReportBlock', {
                profileId: 'BS-1043',
                name: partnerName,
              })
            }
            style={styles.menuBtn}
          >
            <Text style={styles.menuText}>⋮</Text>
          </TouchableOpacity>
        }
      />

      <StatusNotice
        milestoneText="Real-time Chat & WebSockets: Milestone 6"
        subtext="Socket.IO authorization, anti-harassment keyword screening, and contact-exchange persistence will link in Milestone 6."
      />

      {/* Blueprint Safety Warning Banner (Blueprint S-14) */}
      <View style={styles.safetyBanner}>
        <Text style={styles.safetyIcon}>🛡️</Text>
        <Text style={styles.safetyText}>
          Safety First: Never send money, OTPs, or bank details. Report any suspicious conduct
          immediately.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.messagesContainer}>
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
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
                <Text style={[styles.timeText, isUser ? styles.userTime : styles.partnerTime]}>
                  {msg.time}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Blueprint Contact Share Consent Card (Blueprint S-14) */}
        <View style={styles.contactShareCard}>
          <Text style={styles.contactShareIcon}>📱</Text>
          <View style={styles.contactShareBody}>
            <Text style={styles.contactShareTitle}>Share Verified Contact Numbers?</Text>
            <Text style={styles.contactShareDesc}>
              Both you and {partnerName} must give mutual consent. You can revoke access at any time
              later.
            </Text>
            <Button
              title="Request Mutual Contact Share"
              onPress={handleRequestContact}
              variant="upgrade"
              style={styles.contactShareBtn}
            />
          </View>
        </View>
      </ScrollView>

      {/* Message Input Footer */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a respectful message..."
          placeholderTextColor={colors.textMuted}
          value={inputMessage}
          onChangeText={setInputMessage}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
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
  },
  menuText: {
    fontSize: 22,
    color: colors.royalMaroon,
    fontWeight: 'bold',
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
  messagesContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
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
  timeText: {
    fontSize: 10,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  userTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  partnerTime: {
    color: colors.textMuted,
  },
  contactShareCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.softGold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
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
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.fontSizes.sm,
  },
});
