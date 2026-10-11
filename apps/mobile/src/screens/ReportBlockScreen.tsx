import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { REPORT_REASONS, ReportReason } from '@bandhansetu/shared';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportBlock'>;

export const ReportBlockScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profileId, name } = route.params;
  const [selectedReason, setSelectedReason] = useState<ReportReason>('fake_photos');
  const [comments, setComments] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  const reasonLabels: Record<ReportReason, string> = {
    fake_photos: 'Fake or stolen photos',
    asking_money: 'Asking for money / financial fraud',
    harassment: 'Harassment, offensive or abusive conduct',
    already_married: 'Person is married / already engaged',
    misleading_details: 'Wrong, falsified or misleading details',
    other: 'Other policy violation',
  };

  const handleSubmitReport = () => {
    Alert.alert(
      'Report Submitted',
      `Thank you for protecting our community. Our Trust & Safety team has received your report regarding ${name} (${profileId}) and will review it confidentially within 4 hours.`,
      [
        {
          text: 'Return',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Report Profile"
        subtitle={`Concerning: ${name} (${profileId})`}
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Safety & Moderation: Milestone 6"
          subtext="Admin operations dashboard (S-A01/S-A03) and auto-hide threshold review will be linked in Milestone 6."
        />

        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>What is the issue with this profile?</Text>
          <Text style={styles.subText}>
            Select the most accurate reason. Your report is completely anonymous.
          </Text>

          {/* Reason Radio Options */}
          {REPORT_REASONS.map((reason) => {
            const isSelected = selectedReason === reason;
            return (
              <TouchableOpacity
                key={reason}
                onPress={() => setSelectedReason(reason)}
                style={[styles.radioItem, isSelected && styles.radioItemSelected]}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                  {reasonLabels[reason]}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Comments Input */}
          <Input
            label="Additional Details (Optional)"
            placeholder="Please provide any relevant context to help our moderation team..."
            multiline
            numberOfLines={4}
            value={comments}
            onChangeText={setComments}
            style={{ height: 85, textAlignVertical: 'top' }}
            containerStyle={{ marginTop: spacing.md }}
          />

          {/* Also Block Toggle */}
          <View style={styles.blockRow}>
            <View style={styles.blockTextCol}>
              <Text style={styles.blockLabel}>Also block this member</Text>
              <Text style={styles.blockSub}>
                They will not be able to view your profile, send interests, or message you.
              </Text>
            </View>
            <Switch
              value={alsoBlock}
              onValueChange={setAlsoBlock}
              trackColor={{ false: colors.warmGrey, true: colors.alertRed }}
            />
          </View>

          {/* Blueprint Anonymous Guarantee Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeIcon}>🛡️</Text>
            <Text style={styles.noticeText}>
              Our team reviews all reports promptly. The reported member is NEVER informed of who
              reported them.
            </Text>
          </View>

          <Button
            title="Submit Report"
            onPress={handleSubmitReport}
            variant="primary"
            style={[styles.submitBtn, { backgroundColor: colors.alertRed }]}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  card: {
    padding: spacing.xl,
  },
  sectionHeading: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.xxs,
  },
  subText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceCard,
  },
  radioItemSelected: {
    borderColor: colors.alertRed,
    backgroundColor: '#FFF8F8',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioCircleSelected: {
    borderColor: colors.alertRed,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.alertRed,
  },
  radioLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
  },
  radioLabelSelected: {
    fontWeight: '700',
    color: colors.alertRed,
  },
  blockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  blockTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  blockLabel: {
    fontSize: typography.fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.charcoal,
  },
  blockSub: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  submitBtn: {
    width: '100%',
  },
});
