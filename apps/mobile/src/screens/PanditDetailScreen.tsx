import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { API_BASE } from '../services/authSession';

export const PanditDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { panditId, panditName } = route.params || {};
  const [pandit, setPandit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPanditDetails();
  }, []);

  const fetchPanditDetails = async () => {
    try {
      const res = await fetch(`${API_BASE}/pandits/${panditId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPandit(json.data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.royalMaroon} />
      </View>
    );
  }

  const p = pandit || {
    name: panditName || 'Vedic Pandit Ji',
    religiousTradition: 'Vedic Sanatan Tradition',
    experienceYears: 10,
    languages: ['Hindi', 'Sanskrit', 'English'],
    serviceLocations: ['Delhi NCR', 'Online Video Consultation'],
    bio: 'Dedicated Vedic scholar and purohit conducting weddings, Satyanarayan Katha, Griha Pravesh, and comprehensive astrological consultations.',
    services: [
      {
        serviceId: 'srv_vivah',
        name: 'Vedic Wedding Ceremony (Vivah Sanskar)',
        priceInr: 15100,
        durationMinutes: 240,
        description: 'Complete Vedic vivah rituals including Kanyadaan, Saptapadi, and Havan.',
      },
      {
        serviceId: 'srv_kundli',
        name: 'Kundli Milan & Consultation',
        priceInr: 1100,
        durationMinutes: 45,
        description: 'In-depth 36 Guna analysis and Muhurat selection.',
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{p.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>{(p.name || 'P')[0]}</Text>
          </View>
          <Text style={styles.nameText}>{p.name}</Text>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.verifiedGreen} />
            <Text style={styles.verifiedText}>Verified Purohit / Astrologer</Text>
          </View>
          <Text style={styles.traditionText}>{p.religiousTradition}</Text>
          <Text style={styles.expText}>{p.experienceYears} Years Experience • {p.languages?.join(', ')}</Text>
        </View>

        {/* Biography */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>About Pandit Ji</Text>
          <Text style={styles.bioText}>{p.bio}</Text>
        </View>

        {/* Services & Pricing */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ceremony Services & Pricing</Text>
          {(p.services || []).map((s: any, idx: number) => (
            <View key={idx} style={styles.serviceItem}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.serviceItemName}>{s.name}</Text>
                <Text style={styles.serviceItemDesc}>{s.description}</Text>
                <Text style={styles.serviceItemDuration}>⏳ {s.durationMinutes} Minutes</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.serviceItemPrice}>₹{(s.priceInr || 0).toLocaleString('en-IN')}</Text>
                <TouchableOpacity
                  style={styles.bookSmallBtn}
                  onPress={() =>
                    navigation.navigate('BookingFlow', {
                      panditId,
                      serviceId: s.serviceId,
                      serviceName: s.name,
                      priceInr: s.priceInr,
                    })
                  }
                >
                  <Text style={styles.bookSmallBtnText}>Book Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginBottom: 16,
  },
  avatarWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.softGold,
    marginBottom: 10,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    color: colors.verifiedGreen,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  traditionText: {
    fontSize: 13,
    color: colors.royalMaroon,
    fontWeight: '600',
    marginTop: 4,
  },
  expText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D8',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.royalMaroon,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 19,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2EB',
  },
  serviceItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
  },
  serviceItemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  serviceItemDuration: {
    fontSize: 11,
    color: colors.royalMaroon,
    marginTop: 4,
  },
  serviceItemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.royalMaroon,
    marginBottom: 6,
  },
  bookSmallBtn: {
    backgroundColor: colors.royalMaroon,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bookSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
