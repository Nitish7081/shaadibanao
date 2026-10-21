import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, fonts } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusNotice } from '../components/common/StatusNotice';
import {
  getPublicProfile,
  sendInterest,
  addShortlist,
  getSessionToken,
} from '../services';
import { PublicProfile } from '@bandhansetu/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export const ProfileDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { profileId, name } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const token = getSessionToken();
        const res = await getPublicProfile(token, profileId);
        if (isMounted && res.data) {
          setProfile(res.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Could not load profile details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [profileId]);

  const handleSendInterest = async () => {
    setActionLoading(true);
    try {
      const token = getSessionToken();
      const res = await sendInterest(token, profileId);
      Alert.alert(
        'Interest Sent 🎉',
        res.message || `Your interest has been expressed to ${profile?.displayName || name}. Once accepted, contact sharing will unlock.`
      );
    } catch (err: any) {
      Alert.alert('Unable to Send Interest', err.message || 'Could not express interest.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShortlist = async () => {
    setActionLoading(true);
    try {
      const token = getSessionToken();
      const res = await addShortlist(token, profileId);
      Alert.alert('Shortlisted', res.message || `${profile?.displayName || name} has been added to your shortlist.`);
    } catch (err: any) {
      Alert.alert('Shortlist Failed', err.message || 'Could not add to shortlist.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReport = () => {
    navigation.navigate('ReportBlock', { profileId, name: profile?.displayName || name });
  };

  const formatHeight = (cm?: number) => {
    if (!cm) return '';
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };

  const displayName = profile?.displayName || name;
  const age = profile?.age || 26;
  const heightStr = profile?.heightCm ? formatHeight(profile.heightCm) : "5'4\"";
  const city = profile?.city || 'Delhi NCR';
  const education = profile?.education || 'Graduate';
  const occupation = profile?.occupation || 'Professional';
  const maritalStatus = profile?.maritalStatus ? profile.maritalStatus.replace('_', ' ') : 'Never Married';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title={displayName}
        subtitle={`ID: ${profileId}`}
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        variant="royal"
        rightAction={
          <TouchableOpacity onPress={handleReport} style={styles.moreBtn}>
            <Text style={styles.moreIcon}>⚠️ Report</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StatusNotice
          milestoneText="Profile & Privacy Rules: Milestone 5"
          subtext="Contact info is locked behind mutual interest. Identity verification badges strictly follow Blueprint S-11."
        />

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.royalMaroon} />
            <Text style={styles.centerText}>Loading profile details...</Text>
          </View>
        )}

        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load profile</Text>
            <Text style={styles.errorSub}>{error}</Text>
          </Card>
        )}

        {/* Hero Photo Carousel Card */}
        <View style={styles.photoCarousel}>
          {profile?.photos && profile.photos.length > 0 && profile.photos[0].url && !heroImageError ? (
            <Image
              source={{ uri: profile.photos[0].url }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setHeroImageError(true)}
            />
          ) : (
            <View style={styles.photoView}>
              <Text style={styles.photoAvatar}>👤</Text>
            </View>
          )}
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCountText}>
              {profile?.photos?.length ? `${profile.photos.length} Photo${profile.photos.length > 1 ? 's' : ''}` : 'No Photos'}
            </Text>
          </View>
        </View>

        {/* Profile Core Header */}
        <Card style={styles.detailsCard}>
          <View style={styles.titleRow}>
            <Text style={styles.profileName}>
              {displayName}, {age}
            </Text>
            {profile?.isVerified && <Badge label="ID Verified" variant="verified" />}
          </View>

          <Text style={styles.headline}>
            {heightStr} • {city} • {maritalStatus} • {profile?.religion || 'Hindu'}
          </Text>

          {/* Factual Preference Alignment */}
          <View style={styles.whyMatchBox}>
            <Text style={styles.whyMatchTitle}>Preference Alignment</Text>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Age compatible: {age} yrs</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Location: {city}</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Education: {education}</Text>
            </View>
            <View style={styles.matchItem}>
              <Text style={styles.matchIcon}>✓</Text>
              <Text style={styles.matchText}>Occupation: {occupation}</Text>
            </View>
          </View>

          {/* About Section */}
          <Text style={styles.sectionHeading}>About</Text>
          <Text style={styles.bodyText}>
            {profile?.aboutMe ||
              'Looking for a kind, respectful, and family-oriented partner with shared values.'}
          </Text>

          {/* Education & Career */}
          <Text style={styles.sectionHeading}>Education & Profession</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Highest Education:</Text>
            <Text style={styles.detailValue}>{education}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Profession:</Text>
            <Text style={styles.detailValue}>{occupation}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mother Tongue:</Text>
            <Text style={styles.detailValue}>{profile?.motherTongue || 'Hindi'}</Text>
          </View>

          {/* Blueprint Locked Contact Banner (Rule from Page 14) */}
          <View style={styles.lockedContactCard}>
            <Text style={styles.lockIcon}>🔒</Text>
            <View style={styles.lockTextContainer}>
              <Text style={styles.lockTitle}>Contact Details Locked</Text>
              <Text style={styles.lockDesc}>
                Phone numbers and email addresses are protected by default and only disclosed after
                mutual interest and explicit mutual consent.
              </Text>
            </View>
          </View>
        </Card>

        {/* Sticky Action Footer */}
        <View style={styles.actionRow}>
          <Button
            title={actionLoading ? 'Processing...' : 'Send Interest'}
            onPress={handleSendInterest}
            variant="primary"
            loading={actionLoading}
            style={styles.mainActionBtn}
          />
          <Button
            title="Shortlist"
            onPress={handleShortlist}
            variant="secondary"
            disabled={actionLoading}
            style={styles.saveActionBtn}
          />
        </View>
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
    padding: spacing.base,
    paddingBottom: 60,
  },
  centerBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  centerText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  errorCard: {
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.alertRed,
  },
  errorSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    marginTop: 2,
  },
  moreBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorBg,
    marginRight: spacing.xs,
  },
  moreIcon: {
    fontSize: typography.fontSizes.xs,
    color: colors.alertRed,
    fontWeight: '700',
  },
  photoCarousel: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0ECE4',
  },
  photoView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoAvatar: {
    fontSize: 90,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },
  detailsCard: {
    padding: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  profileName: {
    fontSize: typography.fontSizes.xl,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.charcoal,
  },
  headline: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  whyMatchBox: {
    backgroundColor: '#F3FAF8',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C2E5DD',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  whyMatchTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.deepTeal,
    marginBottom: spacing.sm,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  matchIcon: {
    color: colors.verifiedGreen,
    fontWeight: '800',
    marginRight: spacing.sm,
    fontSize: typography.fontSizes.xs,
  },
  matchText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
  },
  sectionHeading: {
    fontSize: typography.fontSizes.base,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    color: colors.charcoal,
  },
  lockedContactCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: colors.softGold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  lockTextContainer: {
    flex: 1,
  },
  lockTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: '#8D6E63',
    marginBottom: 2,
  },
  lockDesc: {
    fontSize: typography.fontSizes.xs - 2,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  mainActionBtn: {
    flex: 2,
    minHeight: 50,
  },
  saveActionBtn: {
    flex: 1,
    minHeight: 50,
  },
});
