import mongoose from 'mongoose';
import { ProfileModel } from '../models/profile.model';
import { UserModel } from '../models/user.model';
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

    // Fetch user's partner preferences for factual alignment scoring
    const myPreferences = await PreferenceService.getMyPreferences(requestingUserId);

    const isDbConnected = mongoose.connection.readyState === 1;

    // Enforce matrimonial rule: A boy (male) only sees girls (female), and a girl (female) only sees boys (male)
    let viewerGender: string | undefined;
    if (isDbConnected) {
      const viewerDoc = await ProfileModel.findOne({ userId: requestingUserId }).select('gender');
      if (viewerDoc?.gender) {
        viewerGender = viewerDoc.gender;
      }
    } else {
      const viewerDoc =
        inMemoryProfileStore.get(requestingUserId) ||
        inMemoryProfileRegistry.find((p) => p.userId === requestingUserId);
      if (viewerDoc?.gender) {
        viewerGender = viewerDoc.gender;
      }
    }

    let targetGender = gender;
    if (viewerGender === 'male') {
      targetGender = 'female';
    } else if (viewerGender === 'female') {
      targetGender = 'male';
    }

    let candidateProfiles: any[] = [];
    let totalCount = 0;

    if (isDbConnected) {
      // Build MongoDB query: only approved and active accounts are eligible
      const queryUserId = mongoose.Types.ObjectId.isValid(requestingUserId)
        ? new mongoose.Types.ObjectId(requestingUserId)
        : requestingUserId;

      // 1. Fetch eligible user IDs (Active and Approved)
      const approvedUsers = await UserModel.find({
        status: 'active',
        approvalStatus: 'approved',
        _id: { $ne: queryUserId },
      }).select('_id');

      const approvedUserIds = approvedUsers.map((u) => u._id);

      // 2. Fetch blocked/reported users to respect trust & safety
      const reports = await ReportModel.find({
        $or: [{ reporterId: queryUserId }, { reportedUserId: queryUserId }],
        status: { $in: ['pending', 'reviewed', 'actioned'] },
      }).select('reporterId reportedUserId');

      const excludedIds = new Set<string>();
      reports.forEach((r: any) => {
        if (r.reporterId && r.reporterId.toString() === requestingUserId.toString()) {
          if (r.reportedUserId) excludedIds.add(r.reportedUserId.toString());
        } else {
          if (r.reporterId) excludedIds.add(r.reporterId.toString());
        }
      });

      const eligibleUserIds = approvedUserIds.filter(
        (id) => !excludedIds.has(id.toString())
      );

      const query: any = {
        userId: { $in: eligibleUserIds },
      };

      if (targetGender) query.gender = targetGender;
      if (maritalStatus) query.maritalStatus = maritalStatus;
      if (religion) query.religion = new RegExp(`^${religion}$`, 'i');
      if (motherTongue) query.motherTongue = new RegExp(`^${motherTongue}$`, 'i');
      if (city) query.city = new RegExp(city, 'i');
      if (education) query.education = new RegExp(education, 'i');
      if (occupation) query.occupation = new RegExp(occupation, 'i');
      if (manglik) query.manglik = manglik;
      if (verifiedOnly) query.isVerified = true;

      // Age to Date of Birth conversion
      if (minAge || maxAge) {
        const today = new Date();
        query.dateOfBirth = {};
        if (maxAge) {
          const minDob = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate());
          query.dateOfBirth.$gte = minDob;
        }
        if (minAge) {
          const maxDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
          query.dateOfBirth.$lte = maxDob;
        }
      }

      // Height filter
      if (minHeightCm || maxHeightCm) {
        query.heightCm = {};
        if (minHeightCm) query.heightCm.$gte = minHeightCm;
        if (maxHeightCm) query.heightCm.$lte = maxHeightCm;
      }

      // Sorting
      let sort: any = { createdAt: -1, _id: -1 };
      if (sortBy === 'newest') sort = { createdAt: -1, _id: -1 };
      if (sortBy === 'age_asc') sort = { dateOfBirth: -1, _id: -1 }; // youngest first
      if (sortBy === 'age_desc') sort = { dateOfBirth: 1, _id: -1 }; // oldest first

      totalCount = await ProfileModel.countDocuments(query);
      candidateProfiles = await ProfileModel.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
    } else {
      // In-memory filter for dev/testing
      const pool = [
        ...Array.from(inMemoryProfileStore.values()),
        ...inMemoryProfileRegistry.filter((p) => !inMemoryProfileStore.has(p.userId)),
      ];

      candidateProfiles = pool.filter((p) => {
        if (p.userId === requestingUserId) return false;
        if (targetGender && p.gender !== targetGender) return false;
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

    // Transform candidate profiles to redacted public profiles with factual match alignment
    const acceptedUserIds = await getAcceptedUserIds(
      requestingUserId,
      candidateProfiles.map((p) => p.userId)
    );
    const items: SearchResultProfile[] = candidateProfiles.map((p) => {
      const publicProfile = ProfileService.formatPublicProfile(p, {
        viewerId: requestingUserId,
        acceptedUserIds,
      });
      const matchAlignment = MatchExplanationService.calculateAlignment(p, myPreferences);

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
