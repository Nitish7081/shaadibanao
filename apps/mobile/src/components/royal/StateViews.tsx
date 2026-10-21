import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface LoadingStateProps {
  label?: string;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading...', style }) => (
  <View style={[styles.loading, style]} accessibilityRole="progressbar">
    <ActivityIndicator size="small" color={colors.royalMaroon} />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

interface StateCardProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
  style?: ViewStyle;
}

const StateCard: React.FC<StateCardProps> = ({
  icon = 'flower-outline',
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
  style,
}) => {
  const isError = tone === 'error';
  return (
    <View style={[styles.card, isError && styles.cardError, style]}>
      <View style={[styles.iconCircle, isError && styles.iconCircleError]}>
        <Ionicons name={icon} size={26} color={isError ? colors.alertRed : colors.royalMaroon} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.85}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const EmptyState: React.FC<Omit<StateCardProps, 'tone'>> = (props) => (
  <StateCard {...props} tone="neutral" />
);

export const ErrorState: React.FC<Omit<StateCardProps, 'tone'>> = ({
  icon = 'alert-circle-outline',
  ...props
}) => <StateCard {...props} icon={icon} tone="error" />;

interface OfflineBannerProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  message = 'You appear to be offline. Showing limited information.',
  onRetry,
  style,
}) => (
  <View style={[styles.offline, style]} accessibilityRole="alert">
    <Ionicons name="cloud-offline-outline" size={16} color={colors.deepMaroon} />
    <Text style={styles.offlineText}>{message}</Text>
    {onRetry ? (
      <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry">
        <Text style={styles.offlineRetry}>Retry</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardError: {
    borderColor: '#F3C9C9',
    backgroundColor: '#FFF9F9',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconCircleError: {
    backgroundColor: '#FDECEC',
    borderColor: '#F3C9C9',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
    marginBottom: 4,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: colors.bodyText,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.royalMaroon,
    borderRadius: borderRadius.full,
    paddingVertical: 9,
    paddingHorizontal: 22,
    ...shadows.subtle,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lightGold,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  offlineText: {
    flex: 1,
    fontSize: 12,
    color: colors.deepMaroon,
    fontWeight: '600',
  },
  offlineRetry: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.royalMaroon,
  },
});
