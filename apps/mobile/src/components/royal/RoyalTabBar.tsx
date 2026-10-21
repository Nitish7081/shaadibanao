import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<string, { label: string; icon: IconName; focusedIcon: IconName }> = {
  Home: { label: 'Home', icon: 'home-outline', focusedIcon: 'home' },
  Matches: { label: 'Matches', icon: 'heart-outline', focusedIcon: 'heart' },
  Community: { label: 'Community', icon: 'people-outline', focusedIcon: 'people' },
  Astrology: { label: 'Astrology', icon: 'planet-outline', focusedIcon: 'planet' },
  Profile: { label: 'Profile', icon: 'person-circle-outline', focusedIcon: 'person-circle' },
};

/**
 * Royal bottom navigation: ivory bar, gold top trim, maroon active state.
 */
export const RoyalTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]}>
      <View style={styles.goldTrim} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name] || {
          label: route.name,
          icon: 'ellipse-outline' as IconName,
          focusedIcon: 'ellipse' as IconName,
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.item}
            activeOpacity={0.8}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={`${meta.label} tab`}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
              <Ionicons
                name={focused ? meta.focusedIcon : meta.icon}
                size={21}
                color={focused ? colors.royalMaroon : colors.textMuted}
              />
            </View>
            <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1}>
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.ivoryLight,
    paddingTop: 8,
    elevation: 16,
    shadowColor: colors.deepMaroon,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  goldTrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: colors.goldBorder,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'transparent',
  },
  iconWrapFocused: {
    backgroundColor: 'rgba(122, 21, 40, 0.10)',
    borderColor: colors.royalGold,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  labelFocused: {
    color: colors.royalMaroon,
    fontWeight: '800',
  },
});
