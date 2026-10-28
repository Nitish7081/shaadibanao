import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { SearchService } from '../src/services/search.service';

describe('Task 3: Today Matches Dynamic & 60-Matches Scalability Test', () => {
  let mongod: MongoMemoryServer;
  let viewerUserId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // 1. Create viewer user
    const viewer = await UserModel.create({
      mobile: '9999900000',
      email: 'viewer@example.com',
      displayName: 'Aarav Sharma',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
    });
    viewerUserId = viewer._id.toString();

    await ProfileModel.create({
      userId: viewer._id,
      firstName: 'Aarav',
      lastName: 'Sharma',
      gender: 'male',
      dateOfBirth: new Date('1995-01-01'),
      heightCm: 175,
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      religion: 'Hindu',
      motherTongue: 'Hindi',
      education: 'B.Tech',
      employedIn: 'private',
      occupation: 'Software Engineer',
      maritalStatus: 'never_married',
      completenessPercent: 95,
      isVerified: true,
    });

    // 2. Generate 60 diverse matrimonial candidate profiles
    const cities = ['Delhi', 'Jaipur', 'Mumbai', 'Bangalore', 'Lucknow', 'Pune'];
    const professions = ['Software Engineer', 'Doctor', 'Chartered Accountant', 'Professor', 'Architect', 'Banker'];

    const userDocs = [];
    for (let i = 1; i <= 60; i++) {
      userDocs.push({
        mobile: `98000000${i.toString().padStart(2, '0')}`,
        email: `candidate${i}@example.com`,
        displayName: `Candidate ${i}`,
        role: 'member',
        status: 'active',
        approvalStatus: 'approved',
      });
    }
    const createdUsers = await UserModel.insertMany(userDocs);

    const profileDocs = createdUsers.map((u, idx) => {
      const isBlurredPhoto = idx % 4 === 1; // 25% blurred photos
      const hasNoPhoto = idx % 5 === 0;    // 20% no photos (initials only)
      const isVerified = idx % 2 === 0;

      const photos = hasNoPhoto
        ? []
        : [
            {
              url: `https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/cand_${idx}.jpg`,
              publicId: `shaadibanao/profiles/cand_${idx}`,
              isMain: true,
              approved: true,
              isBlurred: isBlurredPhoto,
              privacy: isBlurredPhoto ? ('blurred' as const) : ('everyone' as const),
            },
          ];

      return {
        userId: u._id,
        firstName: `Candidate`,
        lastName: `${idx + 1}`,
        gender: 'female',
        dateOfBirth: new Date(`199${(idx % 8) + 1}-0${(idx % 9) + 1}-10`),
        heightCm: 165,
        city: cities[idx % cities.length],
        state: 'State',
        country: 'India',
        religion: 'Hindu',
        motherTongue: 'Hindi',
        education: 'Postgraduate',
        employedIn: 'private',
        occupation: professions[idx % professions.length],
        maritalStatus: 'never_married',
        completenessPercent: 85,
        isVerified,
        photos,
      };
    });

    await ProfileModel.insertMany(profileDocs);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('should return exactly 8 compact matches for Home Screen (server-side limit)', async () => {
    const res = await SearchService.searchProfiles(viewerUserId, {
      limit: 8,
      page: 1,
      sortBy: 'best_match',
    });

    expect(res.items.length).toBe(8);
    expect(res.pagination.totalCount).toBe(60);
    expect(res.pagination.totalPages).toBe(8);
  });

  it('should support pagination over 60 matches for the full Search/Matches screen', async () => {
    const page1 = await SearchService.searchProfiles(viewerUserId, { limit: 10, page: 1, sortBy: 'best_match' });
    expect(page1.items.length).toBe(10);
    expect(page1.pagination.totalCount).toBe(60);
    expect(page1.pagination.totalPages).toBe(6);

    const page2 = await SearchService.searchProfiles(viewerUserId, { limit: 10, page: 2, sortBy: 'best_match' });
    expect(page2.items.length).toBe(10);

    // Verify disjoint sets across pages
    const idsPage1 = new Set(page1.items.map((m: any) => m.id));
    const overlap = page2.items.filter((m: any) => idsPage1.has(m.id));
    expect(overlap.length).toBe(0);
  });

  it('should preserve photo privacy flags (blurred or locked photos remain blurred)', async () => {
    const res = await SearchService.searchProfiles(viewerUserId, { limit: 30, page: 1, sortBy: 'best_match' });
    const blurredMatches = res.items.filter((m: any) => m.photos.some((p: any) => p.isBlurred));
    expect(blurredMatches.length).toBeGreaterThan(0);

    for (const match of blurredMatches) {
      const blurredPhoto = match.photos.find((p: any) => p.isBlurred);
      expect(blurredPhoto).toBeDefined();
      expect(blurredPhoto?.isBlurred).toBe(true);
      // Ensure URL is either empty or contains blur transformation
      if (blurredPhoto?.url) {
        expect(blurredPhoto.url).toContain('e_blur');
      }
    }
  });

  it('should work seamlessly with 0 matches when filter matches none', async () => {
    const res = await SearchService.searchProfiles(viewerUserId, {
      page: 1,
      limit: 10,
      sortBy: 'best_match',
      city: 'NonExistentCityXYZ',
    });
    expect(res.items.length).toBe(0);
    expect(res.pagination.totalCount).toBe(0);
  });
});
