import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ds, PressableScale } from '../../design';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  targetName?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  targetName,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Gold decorative grab bar */}
              <View style={styles.grabBar} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Crown & Royal Header Badge */}
                <View style={styles.headerBadgeContainer}>
                  <LinearGradient
                    colors={['#801026', '#540917']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.crownCircle}
                  >
                    <Ionicons name="ribbon" size={28} color="#F9D976" />
                  </LinearGradient>
                  <View style={styles.vipTag}>
                    <Text style={styles.vipTagText}>VIP SANATAN MATRIMONY</Text>
                  </View>
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.title}>{t('paywall.sheetTitle')}</Text>
                <Text style={styles.subtitle}>
                  {targetName
                    ? `${t('paywall.sheetSubtitle')} (${targetName})`
                    : t('paywall.sheetSubtitle')}
                </Text>

                {/* Benefits List */}
                <View style={styles.benefitsCard}>
                  <Text style={styles.benefitsHeading}>
                    {t('paywall.benefitsTitle')}
                  </Text>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="chatbubble-ellipses" size={16} color="#801026" />
                    </View>
                    <Text style={styles.benefitText}>{t('paywall.benefitChat')}</Text>
                  </View>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="call" size={16} color="#801026" />
                    </View>
                    <Text style={styles.benefitText}>{t('paywall.benefitContacts')}</Text>
                  </View>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="images" size={16} color="#801026" />
                    </View>
                    <Text style={styles.benefitText}>{t('paywall.benefitPhotos')}</Text>
                  </View>

                  <View style={styles.benefitRow}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="sparkles" size={16} color="#801026" />
                    </View>
                    <Text style={styles.benefitText}>{t('paywall.benefitKundli')}</Text>
                  </View>
                </View>

                {/* Plan Previews */}
                <View style={styles.plansRow}>
                  {/* Plus Plan Card */}
                  <View style={styles.planMiniCard}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planMiniName}>{t('paywall.plusTitle')}</Text>
                    </View>
                    <Text style={styles.planMiniPrice}>{t('paywall.plusPrice')}</Text>
                    <Text style={styles.planMiniTag}>25 Contacts • Chat</Text>
                  </View>

                  {/* Premium Plan Card */}
                  <LinearGradient
                    colors={['#540917', '#801026']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.planMiniCard, styles.planMiniCardGold]}
                  >
                    <View style={styles.goldBadgePill}>
                      <Text style={styles.goldBadgePillText}>RECOMMENDED</Text>
                    </View>
                    <Text style={[styles.planMiniName, { color: '#F9D976' }]}>
                      {t('paywall.premiumTitle')}
                    </Text>
                    <Text style={[styles.planMiniPrice, { color: '#FFFFFF' }]}>
                      {t('paywall.premiumPrice')}
                    </Text>
                    <Text style={[styles.planMiniTag, { color: 'rgba(255,255,255,0.85)' }]}>
                      75 Contacts • Advisor
                    </Text>
                  </LinearGradient>
                </View>

                {/* Primary CTA Upgrade Button */}
                <PressableScale
                  onPress={() => {
                    onClose();
                    onUpgrade();
                  }}
                  style={styles.upgradeBtnContainer}
                >
                  <LinearGradient
                    colors={['#801026', '#540917']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeBtn}
                  >
                    <Text style={styles.upgradeBtnText}>
                      {t('paywall.explorePlansBtn')}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </LinearGradient>
                </PressableScale>

                {/* Maybe Later Button */}
                <PressableScale onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>{t('paywall.closeBtn')}</Text>
                </PressableScale>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: Dimensions.get('window').height * 0.88,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  grabBar: {
    width: 44,
    height: 5,
    backgroundColor: '#D1C7BD',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerBadgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#C9A24B',
    ...ds.shadow.lift,
  },
  vipTag: {
    backgroundColor: '#FBF4E6',
    borderWidth: 1,
    borderColor: '#E8D29F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: ds.radius.pill,
  },
  vipTagText: {
    fontFamily: ds.font.bodyBold,
    fontSize: 10,
    color: '#801026',
    letterSpacing: 1,
  },
  title: {
    fontFamily: ds.font.headingBold,
    fontSize: 20,
    color: ds.color.deepMaroon,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: ds.font.bodyRegular,
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: '#FDFBF7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E6D8',
    padding: 14,
    marginBottom: 16,
  },
  benefitsHeading: {
    fontFamily: ds.font.bodyBold,
    fontSize: 13,
    color: '#333333',
    marginBottom: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5EAEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  benefitText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 12.5,
    color: '#444444',
    flex: 1,
  },
  plansRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  planMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D5',
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  planMiniCardGold: {
    borderWidth: 1,
    borderColor: '#C9A24B',
  },
  goldBadgePill: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#C9A24B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: ds.radius.pill,
  },
  goldBadgePillText: {
    fontFamily: ds.font.bodyBold,
    fontSize: 8,
    color: '#3B2404',
    letterSpacing: 0.5,
  },
  planHeader: {
    marginBottom: 2,
  },
  planMiniName: {
    fontFamily: ds.font.headingBold,
    fontSize: 13,
    color: ds.color.deepMaroon,
    textAlign: 'center',
    marginTop: 2,
  },
  planMiniPrice: {
    fontFamily: ds.font.headingBold,
    fontSize: 14,
    color: '#801026',
    marginVertical: 3,
  },
  planMiniTag: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 10,
    color: '#777777',
    textAlign: 'center',
  },
  upgradeBtnContainer: {
    width: '100%',
    marginBottom: 10,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    ...ds.shadow.lift,
  },
  upgradeBtnText: {
    fontFamily: ds.font.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 13,
    color: '#888888',
  },
});
