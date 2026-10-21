import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ServiceModuleConfig } from '../../constants/serviceModules';
import { colors, shadows } from '../../constants/theme';

interface ServiceModuleCardProps {
  module: ServiceModuleConfig;
  badge?: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const ServiceModuleCard: React.FC<ServiceModuleCardProps> = ({
  module,
  badge,
  onPress,
  style,
}) => {
  const displayBadge = badge || module.defaultBadge;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: module.bgColor,
          borderColor: module.borderColor,
        },
        style,
      ]}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={module.accessibilityLabel}
      accessibilityHint={`Navigates to ${module.title}`}
    >
      {/* Top Accent Stripe */}
      <View
        style={[
          styles.topAccentBar,
          { backgroundColor: module.accentColor },
        ]}
      />

      {/* Top Header Row: Icon and Badge */}
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, { backgroundColor: module.iconBg }]}>
          {module.iconFamily === 'MaterialCommunityIcons' ? (
            <MaterialCommunityIcons
              name={module.iconName as any}
              size={22}
              color={module.primaryColor}
            />
          ) : (
            <Ionicons
              name={module.iconName as any}
              size={21}
              color={module.primaryColor}
            />
          )}
        </View>

        {displayBadge ? (
          <View
            style={[
              styles.badgeContainer,
              {
                backgroundColor: module.badgeBg,
                borderColor: module.borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: module.badgeColor },
              ]}
              numberOfLines={1}
            >
              {displayBadge}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Title & Description */}
      <View style={styles.contentWrap}>
        <Text
          style={[
            styles.title,
            { color: module.primaryColor },
          ]}
          numberOfLines={1}
        >
          {module.title}
        </Text>
        <Text
          style={styles.description}
          numberOfLines={2}
        >
          {module.description}
        </Text>
      </View>

      {/* Action Footer */}
      <View
        style={[
          styles.actionFooter,
          { borderTopColor: 'rgba(0, 0, 0, 0.05)' },
        ]}
      >
        <Text
          style={[
            styles.actionText,
            { color: module.primaryColor },
          ]}
        >
          {module.actionText}
        </Text>
        <Ionicons
          name="arrow-forward-circle"
          size={16}
          color={module.primaryColor}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.2,
    paddingTop: 14,
    paddingBottom: 11,
    paddingHorizontal: 13,
    minHeight: 146,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.subtle,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeContainer: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 0.8,
    maxWidth: '52%',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.bodyText,
    fontWeight: '400',
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 7,
    borderTopWidth: 1,
    marginTop: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
