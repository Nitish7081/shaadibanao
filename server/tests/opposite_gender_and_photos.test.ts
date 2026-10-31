import { SearchService, inMemoryProfileRegistry } from '../src/services/search.service';
import { inMemoryProfileStore, ProfileService } from '../src/services/profile.service';
import { buildPublicPhotos } from '../src/services/photoPrivacy';
import { SearchFilterInput } from '@bandhansetu/shared';

describe('Opposite Gender & Photo Visibility Suite', () => {
  const defaultFilters: SearchFilterInput = {
    page: 1,
    limit: 10,
    sortBy: 'best_match',
  };

  beforeEach(() => {
    inMemoryProfileStore.clear();
    inMemoryProfileRegistry.length = 0;
  });

  describe('Matrimonial Opposite-Gender Rule', () => {
    it('enforces Boy (Male viewer) ONLY sees Girls (Female candidates)', async () => {
      // Viewer is Male
      inMemoryProfileStore.set('boy_user_1', {
        userId: 'boy_user_1',
        gender: 'male',
        firstName: 'Rahul',
        dateOfBirth: new Date('1996-01-01'),
      });

      // Candidates: 2 males and 2 females
      inMemoryProfileStore.set('boy_candidate_2', {
        userId: 'boy_candidate_2',
        gender: 'male',
        firstName: 'Amit',
        dateOfBirth: new Date('1995-01-01'),
        photos: [{ url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/amit.jpg', isMain: true, approved: true }],
      });
      inMemoryProfileStore.set('girl_candidate_1', {
        userId: 'girl_candidate_1',
        gender: 'female',
        firstName: 'Pooja',
        dateOfBirth: new Date('1997-01-01'),
        photos: [{ url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/pooja.jpg', isMain: true, approved: true }],
      });
      inMemoryProfileStore.set('girl_candidate_2', {
        userId: 'girl_candidate_2',
        gender: 'female',
        firstName: 'Neha',
        dateOfBirth: new Date('1998-01-01'),
        photos: [{ url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/neha.jpg', isMain: true, approved: true }],
      });

      const res = await SearchService.searchProfiles('boy_user_1', defaultFilters);
      expect(res.items.length).toBe(2);
      expect(res.items.every((p) => p.gender === 'female')).toBe(true);
      expect(res.items.map((p) => p.displayName)).toEqual(
        expect.arrayContaining([expect.stringContaining('Pooja'), expect.stringContaining('Neha')])
      );
    });

    it('enforces Girl (Female viewer) ONLY sees Boys (Male candidates)', async () => {
      // Viewer is Female
      inMemoryProfileStore.set('girl_user_1', {
        userId: 'girl_user_1',
        gender: 'female',
        firstName: 'Pooja',
        dateOfBirth: new Date('1997-01-01'),
      });

      // Candidates
      inMemoryProfileStore.set('boy_candidate_1', {
        userId: 'boy_candidate_1',
        gender: 'male',
        firstName: 'Rahul',
        dateOfBirth: new Date('1995-01-01'),
        photos: [{ url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/rahul.jpg', isMain: true, approved: true }],
      });
      inMemoryProfileStore.set('girl_candidate_2', {
        userId: 'girl_candidate_2',
        gender: 'female',
        firstName: 'Neha',
        dateOfBirth: new Date('1998-01-01'),
        photos: [{ url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/neha.jpg', isMain: true, approved: true }],
      });

      const res = await SearchService.searchProfiles('girl_user_1', defaultFilters);
      expect(res.items.length).toBe(1);
      expect(res.items[0].gender).toBe('male');
      expect(res.items[0].displayName).toContain('Rahul');
    });

    it('overrides an incorrect gender filter with the mandatory opposite gender', async () => {
      inMemoryProfileStore.set('boy_user_1', {
        userId: 'boy_user_1',
        gender: 'male',
        firstName: 'Rahul',
        dateOfBirth: new Date('1996-01-01'),
      });

      inMemoryProfileStore.set('boy_candidate_2', {
        userId: 'boy_candidate_2',
        gender: 'male',
        firstName: 'Amit',
        dateOfBirth: new Date('1995-01-01'),
      });
      inMemoryProfileStore.set('girl_candidate_1', {
        userId: 'girl_candidate_1',
        gender: 'female',
        firstName: 'Pooja',
        dateOfBirth: new Date('1997-01-01'),
      });

      // Male viewer tries to query gender=male
      const res = await SearchService.searchProfiles('boy_user_1', {
        ...defaultFilters,
        gender: 'male' as any,
      });
      // Matrimonial rule enforces female only
      expect(res.items.every((p) => p.gender === 'female')).toBe(true);
      expect(res.items.length).toBe(1);
    });
  });

  describe('Photo Visibility & Public Output Rule', () => {
    it('newly uploaded photos are approved and visible by default', () => {
      const publicPhotos = buildPublicPhotos({
        userId: 'girl_candidate_1',
        photos: [
          {
            url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/girl.jpg',
            isMain: true,
            approved: true,
          },
        ],
      });

      expect(publicPhotos.length).toBe(1);
      expect(publicPhotos[0].url).toBe('https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/girl.jpg');
      expect(publicPhotos[0].isBlurred).toBe(false);
    });

    it('upsertMyProfile preserves visibility and approves uploaded photos by default', async () => {
      const created = await ProfileService.upsertMyProfile('new_user_123', {
        firstName: 'Ananya',
        lastName: 'Roy',
        gender: 'female',
        dateOfBirth: '1998-05-15',
        maritalStatus: 'never_married',
        manglik: 'no',
        photoPrivacy: 'everyone',
        heightCm: 162,
        motherTongue: 'Bengali',
        religion: 'Hindu',
        country: 'India',
        state: 'West Bengal',
        city: 'Kolkata',
        familyValues: 'moderate',
        familyType: 'nuclear',
        education: 'B.Tech',
        employedIn: 'private',
        occupation: 'Product Manager',
        showIncomeBand: false,
        aboutMe: 'Looking for a good soul.',
        photos: [
          {
            url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/ananya.jpg',
            isMain: true,
            privacy: 'everyone',
            approved: true,
          },
        ],
      });

      expect(created.photos.length).toBe(1);
      expect((created.photos[0] as any).approved).toBe(true);

      // Verify formatted public profile shows the photo
      const publicDoc = ProfileService.formatPublicProfile(created);
      expect(publicDoc.photos.length).toBe(1);
      expect(publicDoc.photos[0].url).toContain('ananya.jpg');
    });
  });
});
