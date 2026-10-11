import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { checkBackendHealth, HealthCheckResult } from '../../services/healthService';
import { getApiBaseUrl } from '../../services/apiClient';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

export const BackendStatusBadge: React.FC = () => {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await checkBackendHealth();
      setResult(res);
    } catch {
      // Handled in service
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Periodically re-check every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (loading && !result) return colors.softGold;
    if (result?.isHealthy) return colors.verifiedGreen;
    return colors.alertRed;
  };

  const getStatusText = () => {
    if (loading && !result) return 'Connecting...';
    if (result?.isHealthy) return `Backend OK (${result.latencyMs}ms)`;
    return 'Backend Offline';
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
        style={[
          styles.badgeContainer,
          { borderColor: getStatusColor() },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.badgeText}>{getStatusText()}</Text>
        {loading && <ActivityIndicator size="small" color={getStatusColor()} style={styles.spinner} />}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backend Connection Diagnostics</Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Configured API Base URL</Text>
                <Text style={styles.infoValue}>{getApiBaseUrl()}</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Platform</Text>
                <Text style={styles.infoValue}>
                  {Platform.OS.toUpperCase()} {Platform.Version ? `(v${Platform.Version})` : ''}
                </Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Connection Status</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: result?.isHealthy ? colors.verifiedGreen : colors.alertRed },
                  ]}
                >
                  {result?.isHealthy ? 'Operational (200 OK)' : 'Failed to reach API'}
                </Text>
              </View>

              {result && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Latency & Timestamp</Text>
                  <Text style={styles.infoValue}>
                    {result.latencyMs}ms at {result.timestamp}
                  </Text>
                </View>
              )}

              {result?.data && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Backend Health Payload</Text>
                  <Text style={styles.codeBlock}>
                    {JSON.stringify(result.data, null, 2)}
                  </Text>
                </View>
              )}

              {!result?.isHealthy && (
                <View style={[styles.infoCard, styles.troubleshootingCard]}>
                  <Text style={styles.troubleshootingTitle}>Troubleshooting Network Access:</Text>
                  <Text style={styles.troubleshootingText}>
                    • Android Emulator: Ensure host uses `http://10.0.2.2:5000/api/v1`{'\n'}
                    • Physical Android Device: Set `EXPO_PUBLIC_API_URL` to your workstation LAN IP (e.g. `http://192.168.1.X:5000/api/v1`){'\n'}
                    • Check Express Server: Run `npm run server:dev` in terminal
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchHealth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.retryButtonText}>Re-test Connection</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.full,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  spinner: {
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.warmGrey,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  closeButton: {
    fontSize: typography.fontSizes.xl,
    color: colors.charcoal,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  modalScroll: {
    marginVertical: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  infoValue: {
    fontSize: typography.fontSizes.sm,
    color: colors.charcoal,
    fontWeight: '500',
  },
  codeBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    backgroundColor: '#F5F2EB',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  troubleshootingCard: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  troubleshootingTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: '#8D6E63',
    marginBottom: spacing.xs,
  },
  troubleshootingText: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.royalMaroon,
    minHeight: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: typography.fontSizes.base,
  },
});
