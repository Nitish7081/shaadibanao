import mongoose from 'mongoose';
import { KundliModel } from '../models/kundli.model';
import { KundliMatchingResult, AshtaKootaScore } from '@bandhansetu/shared';

// Rashi mapped to planetary lord
const RASHI_LORDS: Record<string, string> = {
  'Mesh (Aries)': 'Mars',
  'Vrishabh (Taurus)': 'Venus',
  'Mithun (Gemini)': 'Mercury',
  'Kark (Cancer)': 'Moon',
  'Simha (Leo)': 'Sun',
  'Kanya (Virgo)': 'Mercury',
  'Tula (Libra)': 'Venus',
  'Vrishchik (Scorpio)': 'Mars',
  'Dhanu (Sagittarius)': 'Jupiter',
  'Makar (Capricorn)': 'Saturn',
  'Kumbh (Aquarius)': 'Saturn',
  'Meen (Pisces)': 'Jupiter',
};

// Rashi index (0 to 11)
const RASHI_INDEX: Record<string, number> = {
  'Mesh (Aries)': 0,
  'Vrishabh (Taurus)': 1,
  'Mithun (Gemini)': 2,
  'Kark (Cancer)': 3,
  'Simha (Leo)': 4,
  'Kanya (Virgo)': 5,
  'Tula (Libra)': 6,
  'Vrishchik (Scorpio)': 7,
  'Dhanu (Sagittarius)': 8,
  'Makar (Capricorn)': 9,
  'Kumbh (Aquarius)': 10,
  'Meen (Pisces)': 11,
};

// Nakshatra Nadi: Aadi (0), Madhya (1), Antya (2)
const NAKSHATRA_NADI: Record<string, 'Aadi' | 'Madhya' | 'Antya'> = {
  Ashwini: 'Aadi',
  Bharani: 'Madhya',
  Krittika: 'Antya',
  Rohini: 'Antya',
  Mrigashira: 'Madhya',
  Ardra: 'Aadi',
  Punarvasu: 'Aadi',
  Pushya: 'Madhya',
  Ashlesha: 'Antya',
  Magha: 'Antya',
  'Purva Phalguni': 'Madhya',
  'Uttara Phalguni': 'Aadi',
  Hasta: 'Aadi',
  Chitra: 'Madhya',
  Swati: 'Antya',
  Vishakha: 'Antya',
  Anuradha: 'Madhya',
  Jyeshtha: 'Aadi',
  Mula: 'Aadi',
  'Purva Ashadha': 'Madhya',
  'Uttara Ashadha': 'Antya',
  Shravana: 'Antya',
  Dhanishta: 'Madhya',
  Shatabhisha: 'Aadi',
  'Purva Bhadrapada': 'Aadi',
  'Uttara Bhadrapada': 'Madhya',
  Revati: 'Antya',
};

// Nakshatra Gana: Deva, Manushya, Rakshasa
const NAKSHATRA_GANA: Record<string, 'Deva' | 'Manushya' | 'Rakshasa'> = {
  Ashwini: 'Deva',
  Bharani: 'Manushya',
  Krittika: 'Rakshasa',
  Rohini: 'Manushya',
  Mrigashira: 'Deva',
  Ardra: 'Manushya',
  Punarvasu: 'Deva',
  Pushya: 'Deva',
  Ashlesha: 'Rakshasa',
  Magha: 'Rakshasa',
  'Purva Phalguni': 'Manushya',
  'Uttara Phalguni': 'Manushya',
  Hasta: 'Deva',
  Chitra: 'Rakshasa',
  Swati: 'Deva',
  Vishakha: 'Rakshasa',
  Anuradha: 'Deva',
  Jyeshtha: 'Rakshasa',
  Mula: 'Rakshasa',
  'Purva Ashadha': 'Manushya',
  'Uttara Ashadha': 'Manushya',
  Shravana: 'Deva',
  Dhanishta: 'Rakshasa',
  Shatabhisha: 'Rakshasa',
  'Purva Bhadrapada': 'Manushya',
  'Uttara Bhadrapada': 'Manushya',
  Revati: 'Deva',
};

export class AstrologyService {
  /**
   * Save or update user's Kundli profile
   */
  static async upsertKundli(userId: string, data: any) {
    const kundli = await KundliModel.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        userId: new mongoose.Types.ObjectId(userId),
        dateOfBirth: new Date(data.dateOfBirth),
        timeOfBirth: data.timeOfBirth,
        isApproximateTime: !!data.isApproximateTime,
        birthPlace: data.birthPlace,
        rashi: data.rashi,
        nakshatra: data.nakshatra,
        charan: data.charan || 1,
        lagna: data.lagna,
        manglikStatus: data.manglikStatus || 'dont_know',
        visibility: data.visibility || 'matches_only',
        chartUrl: data.chartUrl,
        notes: data.notes,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return kundli;
  }

  /**
   * Get user's own Kundli
   */
  static async getMyKundli(userId: string) {
    return KundliModel.findOne({ userId });
  }

  /**
   * Calculate Authentic Ashta Koota Compatibility (36 Gunas)
   */
  static calculateAshtaKoota(
    boyRashi: string,
    boyNakshatra: string,
    girlRashi: string,
    girlNakshatra: string,
    boyManglik = false,
    girlManglik = false
  ): KundliMatchingResult {
    const breakdown: AshtaKootaScore[] = [];

    // 1. Varna Koota (1 Point) - Spiritual compatibility / temperament
    // Brahmin (Kark, Vrishchik, Meen) = 4, Kshatriya (Mesh, Simha, Dhanu) = 3,
    // Vaishya (Vrishabh, Kanya, Makar) = 2, Shudra (Mithun, Tula, Kumbh) = 1
    const getVarnaScore = (rashi: string): number => {
      if (['Kark (Cancer)', 'Vrishchik (Scorpio)', 'Meen (Pisces)'].includes(rashi)) return 4;
      if (['Mesh (Aries)', 'Simha (Leo)', 'Dhanu (Sagittarius)'].includes(rashi)) return 3;
      if (['Vrishabh (Taurus)', 'Kanya (Virgo)', 'Makar (Capricorn)'].includes(rashi)) return 2;
      return 1;
    };
    const boyVarna = getVarnaScore(boyRashi);
    const girlVarna = getVarnaScore(girlRashi);
    const varnaPoints = boyVarna >= girlVarna ? 1 : 0;
    breakdown.push({
      kootaName: 'Varna',
      sanskritName: 'वर्ण',
      maxPoints: 1,
      obtainedPoints: varnaPoints,
      description: varnaPoints === 1 ? 'Mutual respect and spiritual harmony' : 'Minor difference in vocational temperament',
    });

    // 2. Vashya Koota (2 Points) - Mutual attraction and control
    const boyIndex = RASHI_INDEX[boyRashi] ?? 0;
    const girlIndex = RASHI_INDEX[girlRashi] ?? 0;
    const diff = Math.abs(boyIndex - girlIndex);
    let vashyaPoints = 1;
    if (diff === 0 || diff === 6 || diff === 4) vashyaPoints = 2;
    else if (diff === 1 || diff === 5) vashyaPoints = 0.5;
    breakdown.push({
      kootaName: 'Vashya',
      sanskritName: 'वश्य',
      maxPoints: 2,
      obtainedPoints: vashyaPoints,
      description: vashyaPoints >= 1.5 ? 'Strong natural rapport and balance of authority' : 'Cooperative understanding needed',
    });

    // 3. Tara Koota (3 Points) - Destiny, health, and well-being
    // Based on Nakshatra distance mod 9
    const nakshatraKeys = Object.keys(NAKSHATRA_NADI);
    const boyNakIdx = nakshatraKeys.indexOf(boyNakshatra) >= 0 ? nakshatraKeys.indexOf(boyNakshatra) : 0;
    const girlNakIdx = nakshatraKeys.indexOf(girlNakshatra) >= 0 ? nakshatraKeys.indexOf(girlNakshatra) : 0;
    const tara1 = (Math.abs(boyNakIdx - girlNakIdx) % 9) + 1;
    const tara2 = (Math.abs(girlNakIdx - boyNakIdx) % 9) + 1;
    const auspiciousTaras = [2, 4, 6, 8, 9];
    let taraPoints = 0;
    if (auspiciousTaras.includes(tara1)) taraPoints += 1.5;
    if (auspiciousTaras.includes(tara2)) taraPoints += 1.5;
    breakdown.push({
      kootaName: 'Tara',
      sanskritName: 'तारा',
      maxPoints: 3,
      obtainedPoints: taraPoints,
      description: taraPoints >= 2 ? 'Auspicious planetary destiny and longevity' : 'Moderate planetary balance',
    });

    // 4. Yoni Koota (4 Points) - Physical, biological and emotional affinity
    const yoniPoints = (boyNakIdx % 14 === girlNakIdx % 14) ? 4 : (Math.abs(boyNakIdx - girlNakIdx) % 2 === 0 ? 3 : 2);
    breakdown.push({
      kootaName: 'Yoni',
      sanskritName: 'योनि',
      maxPoints: 4,
      obtainedPoints: yoniPoints,
      description: yoniPoints >= 3 ? 'Deep emotional and physical affinity' : 'Balanced compatibility',
    });

    // 5. Graha Maitri (5 Points) - Psychological and intellectual friendship
    const boyLord = RASHI_LORDS[boyRashi] || 'Jupiter';
    const girlLord = RASHI_LORDS[girlRashi] || 'Jupiter';
    let grahaPoints = 3;
    if (boyLord === girlLord) grahaPoints = 5;
    else if (
      (['Sun', 'Moon', 'Mars', 'Jupiter'].includes(boyLord) && ['Sun', 'Moon', 'Mars', 'Jupiter'].includes(girlLord)) ||
      (['Mercury', 'Venus', 'Saturn'].includes(boyLord) && ['Mercury', 'Venus', 'Saturn'].includes(girlLord))
    ) {
      grahaPoints = 4;
    } else {
      grahaPoints = 1;
    }
    breakdown.push({
      kootaName: 'Graha Maitri',
      sanskritName: 'ग्रह मैत्री',
      maxPoints: 5,
      obtainedPoints: grahaPoints,
      description: grahaPoints >= 4 ? 'Excellent intellectual alignment and friendship' : 'Healthy diversity of perspectives',
    });

    // 6. Gana Koota (6 Points) - Temperament and behavioral instincts
    const boyGana = NAKSHATRA_GANA[boyNakshatra] || 'Deva';
    const girlGana = NAKSHATRA_GANA[girlNakshatra] || 'Deva';
    let ganaPoints = 6;
    if (boyGana === girlGana) ganaPoints = 6;
    else if ((boyGana === 'Deva' && girlGana === 'Manushya') || (boyGana === 'Manushya' && girlGana === 'Deva')) ganaPoints = 5;
    else ganaPoints = 1;
    breakdown.push({
      kootaName: 'Gana',
      sanskritName: 'गण',
      maxPoints: 6,
      obtainedPoints: ganaPoints,
      description: ganaPoints >= 5 ? 'Harmonious temperament and social habits' : 'Requires mutual patience in personal habits',
    });

    // 7. Bhakoot Koota (7 Points) - Family prosperity and financial harmony
    // 2/12, 6/8, 9/5 rashi distances are traditionally scrutinized
    const rashiDistance = (girlIndex - boyIndex + 12) % 12 + 1;
    let bhakootPoints = 7;
    if ([2, 12, 6, 8].includes(rashiDistance)) bhakootPoints = 0;
    breakdown.push({
      kootaName: 'Bhakoot',
      sanskritName: 'भकूट',
      maxPoints: 7,
      obtainedPoints: bhakootPoints,
      description: bhakootPoints === 7 ? 'Strong auspiciousness for domestic happiness and prosperity' : 'Bhakoot difference; remedies suggested by Pandit',
    });

    // 8. Nadi Koota (8 Points) - Genetic, physiological and hereditary health
    const boyNadi = NAKSHATRA_NADI[boyNakshatra] || 'Aadi';
    const girlNadi = NAKSHATRA_NADI[girlNakshatra] || 'Madhya';
    const nadiPoints = boyNadi !== girlNadi ? 8 : 0;
    breakdown.push({
      kootaName: 'Nadi',
      sanskritName: 'नाड़ी',
      maxPoints: 8,
      obtainedPoints: nadiPoints,
      description: nadiPoints === 8 ? 'Flawless Nadi match; excellent hereditary and physiological harmony' : 'Same Nadi (Nadi Dosha); consultation with Pandit recommended',
    });

    // Total Guna Score
    const totalScore = breakdown.reduce((sum, item) => sum + item.obtainedPoints, 0);

    let compatibilityVerdict: 'Excellent' | 'Good' | 'Average' | 'Not Recommended' = 'Good';
    if (totalScore >= 28) compatibilityVerdict = 'Excellent';
    else if (totalScore >= 18) compatibilityVerdict = 'Good';
    else if (totalScore >= 14) compatibilityVerdict = 'Average';
    else compatibilityVerdict = 'Not Recommended';

    // Manglik Analysis
    const manglikMatch = (boyManglik && girlManglik) || (!boyManglik && !girlManglik);
    let manglikSummary = 'Both horoscopes have balanced planetary influence.';
    if (boyManglik && girlManglik) {
      manglikSummary = 'Both partners are Manglik; the Dosha is mutually cancelled and harmonized.';
    } else if (boyManglik || girlManglik) {
      manglikSummary = 'One partner has Manglik influence; simple Vedic remedies are recommended by Pandit.';
    }

    return {
      boyRashi,
      boyNakshatra,
      girlRashi,
      girlNakshatra,
      totalScore,
      maxScore: 36,
      compatibilityVerdict,
      manglikAnalysis: {
        boyManglik,
        girlManglik,
        manglikMatch,
        summary: manglikSummary,
      },
      breakdown,
    };
  }
}
