import mongoose from 'mongoose';
import { ProfileModel } from '../models/profile.model';
import { ReportModel } from '../models/report.model';
import { PreferenceService } from './preference.service';
import { ProfileService, inMemoryProfileStore } from './profile.service';
import { getAcceptedUserIds } from './photoPrivacy';
import { MatchExplanationService } from './match.service';
import {
  SearchFilterInput,
  SearchResultProfile,
  PaginatedResponse,
} from '@bandhansetu/shared';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// In-memory profiles repository for dev / test mode
export const inMemoryProfileRegistry: any[] = [];

export class SearchService {
  /**
   * Searches public profiles with compound filters, pagination, and preference scoring
   */
  public static async searchProfiles(
    requestingUserId: string,
    filters: SearchFilterInput
  ): Promise<PaginatedResponse<SearchResultProfile>> {
    const {
      minAge,
      maxAge,
      minHeightCm,
      maxHeightCm,
      gender,
      maritalStatus,
      religion,
      motherTongue,
      city,
      education,
      occupation,
      manglik,
      verifiedOnly,
      page = 1,
      limit = 10,
      sortBy = 'best_match',
    } = filters;

    const isDbConnected = mongoose.connection.readyState === 1;

    let myPreferences: any = null;
    let viewerGender: string | undefined;
    let candidateProfiles: any[] = [];
    let totalCount = 0;

    // Client-supplied `gender` filter is intentionally ignored; opposite gender is derived ONLY from viewer's saved profile.
    void gender;

    if (isDbConnected) {
      const queryUserId = mongoose.Types.ObjectId.isValid(requestingUserId)
        ? new mongoose.Types.ObjectId(requestingUserId)
        : requestingUserId;

      // Parallelize independent DB reads: preferences, viewer gender, and safety report exclusions
      // Avoids loading every User document into Node memory!
      const [prefs, viewerDoc, reports] = await Promise.all([
        PreferenceService.getMyPreferences(requestingUserId),
        ProfileModel.findOne({
          $or: [{ userId: queryUserId }, { userId: requestingUserId }],
        })
          .select('gender')
          .lean(),
        ReportModel.find({
          $or: [{ reporterId: queryUserId }, { reportedUserId: queryUserId }],
          status: { $in: ['pending', 'reviewed', 'actioned'] },
        })
          .select('reporterId reportedUserId')
          .lean(),
      ]);

      myPreferences = prefs;
      if ((viewerDoc as any)?.gender) {
        viewerGender = String((viewerDoc as any).gender).trim().toLowerCase();
      }

      // COMPULSORY Matrimonial opposite-gender rule:
      // Boy (male) ONLY sees Girls (female), Girl (female) ONLY sees Boys (male).
      // Derived ONLY from the viewer's saved profile; missing viewer gender returns empty results.
      let targetGender: 'male' | 'female' | undefined;
      if (viewerGender === 'male') {
        targetGender = 'female';
      } else if (viewerGender === 'female') {
        targetGender = 'male';
      }

      if (!targetGender) {
        return {
          items: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 1,
          },
        };
      }

      const excludedObjectIds: any[] = [];
      if (mongoose.Types.ObjectId.isValid(requestingUserId)) {
        excludedObjectIds.push(new mongoose.Types.ObjectId(requestingUserId));
      }
      const seenExcluded = new Set<string>([requestingUserId.toString()]);
      for (const r of reports as any[]) {
        const partnerStr =
          r.reporterId && r.reporterId.toString() === requestingUserId.toString()
            ? r.reportedUserId?.toString()
            : r.reporterId?.toString();
        if (partnerStr && !seenExcluded.has(partnerStr)) {
          seenExcluded.add(partnerStr);
          if (mongoose.Types.ObjectId.isValid(partnerStr)) {
            excludedObjectIds.push(new mongoose.Types.ObjectId(partnerStr));
          }
        }
      }

      const matchQuery: any = {
        gender: targetGender, // Compulsory opposite-gender indexed prefix
        hideProfile: { $ne: true },
        ...(excludedObjectIds.length > 0 ? { userId: { $nin: excludedObjectIds } } : {}),
      };

      if (maritalStatus) matchQuery.maritalStatus = maritalStatus;
      if (religion) matchQuery.religion = new RegExp(`^${escapeRegex(religion)}$`, 'i');
      if (motherTongue) matchQuery.motherTongue = new RegExp(`^${escapeRegex(motherTongue)}$`, 'i');
      if (city) matchQuery.city = new RegExp(escapeRegex(city), 'i');
      if (education) matchQuery.education = new RegExp(escapeRegex(education), 'i');
      if (occupation) matchQuery.occupation = new RegExp(escapeRegex(occupation), 'i');
      if (manglik) matchQuery.manglik = manglik;
      if (verifiedOnly) matchQuery.isVerified = true;

      // Age to Date of Birth conversion
      if (minAge || maxAge) {
        const today = new Date();
        matchQuery.dateOfBirth = {};
        if (maxAge) {
          const minDob = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());
          matchQuery.dateOfBirth.$gte = minDob;
        }
        if (minAge) {
          const maxDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
          matchQuery.dateOfBirth.$lte = maxDob;
        }
      }

      // Height filter
      if (minHeightCm || maxHeightCm) {
        matchQuery.heightCm = {};
        if (minHeightCm) matchQuery.heightCm.$gte = minHeightCm;
        if (maxHeightCm) matchQuery.heightCm.$lte = maxHeightCm;
      }

      // Sorting
      let sort: any = { createdAt: -1, _id: -1 };
      if (sortBy === 'newest') sort = { createdAt: -1, _id: -1 };
      if (sortBy === 'age_asc') sort = { dateOfBirth: -1, _id: -1 }; // youngest first
      if (sortBy === 'age_desc') sort = { dateOfBirth: 1, _id: -1 }; // oldest first

      // Single indexed aggregation pipeline with $lookup against UserModel + $facet pagination
      const aggResult = await ProfileModel.aggregate([
        { $match: matchQuery },
        { $sort: sort },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [
              { $match: { status: 'active', approvalStatus: 'approved' } },
              { $project: { _id: 1 } },
            ],
            as: 'approvedUser',
          },
        },
        { $match: { 'approvedUser.0': { $exists: true } } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            items: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              { $project: { approvedUser: 0 } },
            ],
          },
        },
      ]);

      totalCount = aggResult?.[0]?.total?.[0]?.count || 0;
      const found = aggResult?.[0]?.items || [];
      // Defensive final guard ensuring zero same-gender leakage or duplicate profiles
      const seenUserIds = new Set<string>();
      candidateProfiles = found.filter((p: any) => {
        if (String(p.gender || '').toLowerCase() !== targetGender) return false;
        const uid = p.userId?.toString();
        if (!uid || seenUserIds.has(uid)) return false;
        seenUserIds.add(uid);
        return true;
      });
    } else {
      // In-memory filter for dev/testing
      myPreferences = await PreferenceService.getMyPreferences(requestingUserId);
      const viewerDoc =
        inMemoryProfileStore.get(requestingUserId) ||
        inMemoryProfileRegistry.find((p) => p.userId === requestingUserId);
      if (viewerDoc?.gender) {
        viewerGender = String(viewerDoc.gender).trim().toLowerCase();
      }

      let targetGender: 'male' | 'female' | undefined;
      if (viewerGender === 'male') {
        targetGender = 'female';
      } else if (viewerGender === 'female') {
        targetGender = 'male';
      }

      if (!targetGender) {
        return {
          items: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 1,
          },
        };
      }

      const pool = [
        ...Array.from(inMemoryProfileStore.values()),
        ...inMemoryProfileRegistry.filter((p) => !inMemoryProfileStore.has(p.userId)),
      ];

      candidateProfiles = pool.filter((p) => {
        if (p.userId === requestingUserId) return false;
        if (String(p.gender || '').toLowerCase() !== targetGender) return false;
        if (maritalStatus && p.maritalStatus !== maritalStatus) return false;
        if (religion && p.religion?.toLowerCase() !== religion.toLowerCase()) return false;
        if (motherTongue && p.motherTongue?.toLowerCase() !== motherTongue.toLowerCase()) return false;
        if (city && !p.city?.toLowerCase().includes(city.toLowerCase())) return false;
        if (education && !p.education?.toLowerCase().includes(education.toLowerCase())) return false;
        if (occupation && !p.occupation?.toLowerCase().includes(occupation.toLowerCase())) return false;
        if (manglik && p.manglik !== manglik) return false;
        if (verifiedOnly && !p.isVerified) return false;

        const age = ProfileService.calculateAge(p.dateOfBirth);
        if (minAge && age < minAge) return false;
        if (maxAge && age > maxAge) return false;
        if (minHeightCm && p.heightCm < minHeightCm) return false;
        if (maxHeightCm && p.heightCm > maxHeightCm) return false;

        return true;
      });

      totalCount = candidateProfiles.length;
      candidateProfiles = candidateProfiles.slice((page - 1) * limit, page * limit);
    }

    // Transform candidate profiles to redacted public profiles with pre-compiled O(1) preference scoring
    const preparedPrefs = MatchExplanationService.preparePreferences(myPreferences);
    const acceptedUserIds = await getAcceptedUserIds(
      requestingUserId,
      candidateProfiles.map((p) => p.userId)
    );
    const items: SearchResultProfile[] = candidateProfiles.map((p) => {
      const publicProfile = ProfileService.formatPublicProfile(p, {
        viewerId: requestingUserId,
        acceptedUserIds,
      });
      const matchAlignment = MatchExplanationService.calculateAlignment(
        p,
        myPreferences,
        preparedPrefs
      );

      return {
        ...publicProfile,
        matchAlignment,
      };
    });

    // If sorting by best_match, rank by matchedCount descending
    if (sortBy === 'best_match') {
      items.sort((a, b) => b.matchAlignment.matchedCount - a.matchAlignment.matchedCount);
    }

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }
}
