import { ProfileService } from './profile.service';
import { PartnerPreferences, MatchAlignment } from '@bandhansetu/shared';

export interface PreparedPreferences {
  raw: PartnerPreferences;
  maritalSet: Set<string>;
  religionSet: Set<string>;
  motherTongueSet: Set<string>;
  lowerCities: string[];
}

export class MatchExplanationService {
  /**
   * Pre-compile preference criteria into O(1) Hash Sets for fast candidate scoring
   */
  public static preparePreferences(preferences: PartnerPreferences | null): PreparedPreferences | null {
    if (!preferences) return null;
    return {
      raw: preferences,
      maritalSet: new Set(preferences.maritalStatuses || []),
      religionSet: new Set((preferences.religions || []).map((r) => r.toLowerCase())),
      motherTongueSet: new Set((preferences.motherTongues || []).map((t) => t.toLowerCase())),
      lowerCities: (preferences.cities || []).map((c) => c.toLowerCase()),
    };
  }

  /**
   * Evaluates factual preference alignment between a profile and partner preferences
   * Never generates arbitrary percentages!
   */
  public static calculateAlignment(
    profile: any,
    preferences: PartnerPreferences | null,
    prepared?: PreparedPreferences | null
  ): MatchAlignment {
    if (!preferences) {
      return {
        scoreText: 'Preferences not yet configured',
        matchedCount: 0,
        totalEvaluated: 0,
        matchedCriteria: [],
      };
    }

    const prep = prepared || this.preparePreferences(preferences)!;
    const matchedCriteria: string[] = [];
    let evaluatedCount = 0;
    let matchedCount = 0;

    // 1. Age Range
    const age = ProfileService.calculateAge(profile.dateOfBirth);
    evaluatedCount++;
    if (age >= preferences.minAge && age <= preferences.maxAge) {
      matchedCount++;
      matchedCriteria.push(`Age ${age} is in your preferred range (${preferences.minAge}-${preferences.maxAge})`);
    }

    // 2. Height Range
    evaluatedCount++;
    if (profile.heightCm >= preferences.minHeightCm && profile.heightCm <= preferences.maxHeightCm) {
      matchedCount++;
      matchedCriteria.push(`Height matches preferred range (${preferences.minHeightCm}-${preferences.maxHeightCm} cm)`);
    }

    // 3. Marital Status (O(1) Set lookup)
    if (prep.maritalSet.size > 0) {
      evaluatedCount++;
      if (prep.maritalSet.has(profile.maritalStatus)) {
        matchedCount++;
        matchedCriteria.push(`Marital status aligns (${profile.maritalStatus.replace('_', ' ')})`);
      }
    }

    // 4. Religion (O(1) Set lookup)
    if (prep.religionSet.size > 0) {
      evaluatedCount++;
      if (prep.religionSet.has((profile.religion || '').toLowerCase())) {
        matchedCount++;
        matchedCriteria.push(`Religion matches (${profile.religion})`);
      }
    }

    // 5. Mother Tongue (O(1) Set lookup)
    if (prep.motherTongueSet.size > 0) {
      evaluatedCount++;
      if (prep.motherTongueSet.has((profile.motherTongue || '').toLowerCase())) {
        matchedCount++;
        matchedCriteria.push(`Mother tongue matches (${profile.motherTongue})`);
      }
    }

    // 6. City / Region
    if (prep.lowerCities.length > 0) {
      evaluatedCount++;
      const pCity = (profile.city || '').toLowerCase();
      const match = pCity && prep.lowerCities.some((c) => c === pCity || pCity.includes(c));
      if (match) {
        matchedCount++;
        matchedCriteria.push(`Location matches (${profile.city})`);
      }
    }

    // 7. Manglik Preference
    if (preferences.manglikPreference && preferences.manglikPreference !== 'any') {
      evaluatedCount++;
      if (preferences.manglikPreference === profile.manglik) {
        matchedCount++;
        matchedCriteria.push(`Manglik preference matched (${profile.manglik})`);
      }
    }

    return {
      scoreText: `${matchedCount} of ${evaluatedCount} preferences match`,
      matchedCount,
      totalEvaluated: evaluatedCount,
      matchedCriteria,
    };
  }
}
