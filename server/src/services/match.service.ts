import { ProfileService } from './profile.service';
import { PartnerPreferences, MatchAlignment } from '@bandhansetu/shared';

export class MatchExplanationService {
  /**
   * Evaluates factual preference alignment between a profile and partner preferences
   * Never generates arbitrary percentages!
   */
  public static calculateAlignment(
    profile: any,
    preferences: PartnerPreferences | null
  ): MatchAlignment {
    if (!preferences) {
      return {
        scoreText: 'Preferences not yet configured',
        matchedCount: 0,
        totalEvaluated: 0,
        matchedCriteria: [],
      };
    }

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

    // 3. Marital Status
    if (preferences.maritalStatuses && preferences.maritalStatuses.length > 0) {
      evaluatedCount++;
      if (preferences.maritalStatuses.includes(profile.maritalStatus)) {
        matchedCount++;
        matchedCriteria.push(`Marital status aligns (${profile.maritalStatus.replace('_', ' ')})`);
      }
    }

    // 4. Religion
    if (preferences.religions && preferences.religions.length > 0) {
      evaluatedCount++;
      const match = preferences.religions.some(
        (r) => r.toLowerCase() === (profile.religion || '').toLowerCase()
      );
      if (match) {
        matchedCount++;
        matchedCriteria.push(`Religion matches (${profile.religion})`);
      }
    }

    // 5. Mother Tongue
    if (preferences.motherTongues && preferences.motherTongues.length > 0) {
      evaluatedCount++;
      const match = preferences.motherTongues.some(
        (t) => t.toLowerCase() === (profile.motherTongue || '').toLowerCase()
      );
      if (match) {
        matchedCount++;
        matchedCriteria.push(`Mother tongue matches (${profile.motherTongue})`);
      }
    }

    // 6. City / Region
    if (preferences.cities && preferences.cities.length > 0) {
      evaluatedCount++;
      const match = preferences.cities.some(
        (c) =>
          c.toLowerCase() === (profile.city || '').toLowerCase() ||
          (profile.city || '').toLowerCase().includes(c.toLowerCase())
      );
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
