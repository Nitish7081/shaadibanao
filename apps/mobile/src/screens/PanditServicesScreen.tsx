import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { PanditProfile } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { getAuthHeader } from '../services/authSession';

export const PanditServicesScreen: React.FC<any> = ({ navigation, route }) => {
  const [pandits, setPandits] = useState<PanditProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCeremony, setSelectedCeremony] = useState<string>(
    route?.params?.ceremonyType || 'all'
  );

  useEffect(() => {
    if (route?.params?.ceremonyType) {
      setSelectedCeremony(route?.params?.ceremonyType);
    }
  }, [route?.params?.ceremonyType]);

  const ceremonies = [
    { key: 'all', title: 'All Ceremonies', icon: 'sparkles' },
    { key: 'wedding', title: 'Wedding (Vivah)', icon: 'heart' },
    { key: 'griha_pravesh', title: 'Griha Pravesh', icon: 'home' },
    { key: 'satyanarayan_puja', title: 'Satyanarayan', icon: 'book' },
    { key: 'rudrabhishek', title: 'Rudrabhishek', icon: 'flame' },
    { key: 'kundli_milan', title: 'Kundli Milan', icon: 'planet' },
  ];

  useEffect(() => {
    fetchPandits();
  }, [selectedCeremony]);

  const fetchPandits = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const ceremonyParam = selectedCeremony !== 'all' ? `?ceremonyType=${selectedCeremony}` : '';
      const res = await fetch(`${API_BASE}/pandits${ceremonyParam}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setPandits(json.data.items || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const renderPanditCard = ({ item }: { item: PanditProfile }) => {
    const mainService = (item.services || [])[0];

    return (
      <View style={styles.panditCard}>
        <View style={styles.panditHeader}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>{(item.name || 'P')[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.panditName}>{item.name}</Text>
              <Ionicons name="checkmark-circle" size={16} color={colors.verifiedGreen} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.panditTradition}>{item.religiousTradition || 'Vedic Sanatan'}</Text>
            <Text style={styles.panditExp}>{item.experienceYears} Years Experience • {item.languages.slice(0, 2).join(', ')}</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={13} color="#FFFFFF" />
            <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : '5.0'}</Text>
          </View>
        </View>

        <Text style={styles.panditBio} numberOfLines={2}>
          {item.bio || 'Authentic Vedic rituals and solemn ceremonies performed according to traditional shastras.'}
        </Text>

        {/* Featured Service */}
        {mainService && (
          <View style={styles.servicePreviewBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{mainService.name}</Text>
              <Text style={styles.serviceDuration}>{mainService.durationMinutes} Mins • Vedic Rites</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.servicePrice}>₹{mainService.priceInr.toLocaleString('en-IN')}</Text>
              <Text style={styles.servicePriceSub}>Transparent Fee</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => navigation.navigate('PanditDetail', { panditId: item.id, panditName: item.name })}
          >
            <Text style={styles.detailsBtnText}>View Services & Bio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() =>
              navigation.navigate('BookingFlow', {
                panditId: item.id,
                serviceId: mainService?.serviceId || 'srv_default',
                serviceName: mainService?.name || 'Ceremony Consultation',
                priceInr: mainService?.priceInr || 2100,
              })
            }
          >
            <Text style={styles.bookBtnText}>Book Pandit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Vedic Pandit Services</Text>
            <Text style={styles.headerSubtitle}>Verified Pandits for Auspicious Rituals</Text>
          </View>
          <TouchableOpacity
            style={styles.myBookingsBtn}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
            <Text style={styles.myBookingsBtnText}>My Bookings</Text>
          </TouchableOpacity>
        </View>

        {/* Ceremonies Horizontal Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {ceremonies.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.ceremonyPill,
                selectedCeremony === c.key && styles.ceremonyPillActive,
              ]}
              onPress={() => setSelectedCeremony(c.key)}
            >
              <Text
                style={[
                  styles.ceremonyPillText,
                  selectedCeremony === c.key && styles.ceremonyPillTextActive,
                ]}
              >
                {c.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pandit Catalog */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.royalMaroon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={pandits}
          keyExtractor={(p) => p.id}
          renderItem={renderPanditCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="sunny-outline" size={54} color={colors.softGold} />
              <Text style={styles.emptyTitle}>No Pandits Found</Text>
              <Text style={styles.emptySub}>Please select another ceremony or try again shortly.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.softGold,
    marginTop: 1,
  },
  myBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  myBookingsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  ceremonyPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginRight: 8,
  },
  ceremonyPillActive: {
    backgroundColor: '#FFFFFF',
  },
  ceremonyPillText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  ceremonyPillTextActive: {
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  panditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  panditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  panditName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.charcoal,
  },
  panditTradition: {
    fontSize: 12,
    color: colors.royalMaroon,
    fontWeight: '600',
    marginTop: 1,
  },
  panditExp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.softGold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  panditBio: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  servicePreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginBottom: 14,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
  },
  serviceDuration: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.royalMaroon,
  },
  servicePriceSub: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  detailsBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.royalMaroon,
    alignItems: 'center',
  },
  detailsBtnText: {
    color: colors.royalMaroon,
    fontSize: 12,
    fontWeight: '600',
  },
  bookBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
