import { LRUCache } from '../../apps/mobile/src/utils/lruCache';
import { ProfileService } from '../src/services/profile.service';

describe('DSA Component: LRUCache (Doubly Linked List + Hash Map)', () => {
  it('should support O(1) set and get', () => {
    const cache = new LRUCache<string, string>(3);
    cache.set('a', 'apple');
    cache.set('b', 'banana');
    cache.set('c', 'cherry');

    expect(cache.get('a')).toBe('apple');
    expect(cache.get('b')).toBe('banana');
    expect(cache.get('c')).toBe('cherry');
    expect(cache.size).toBe(3);
  });

  it('should evict least recently used item when capacity is exceeded', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('item1', 1);
    cache.set('item2', 2);
    cache.set('item3', 3);

    // Access item1, making item2 the least recently used
    cache.get('item1');

    // Add item4, item2 should be evicted
    cache.set('item4', 4);

    expect(cache.get('item2')).toBeUndefined();
    expect(cache.get('item1')).toBe(1);
    expect(cache.get('item3')).toBe(3);
    expect(cache.get('item4')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('should honor TTL expiration', async () => {
    const cache = new LRUCache<string, string>(5);
    cache.set('temp', 'temporary_value', 50); // 50ms TTL

    expect(cache.get('temp')).toBe('temporary_value');

    // Wait 70ms for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 70));

    expect(cache.get('temp')).toBeUndefined();
    expect(cache.has('temp')).toBe(false);
  });

  it('should support updating existing keys and moving to head', () => {
    const cache = new LRUCache<string, string>(2);
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k1', 'v1_updated');

    cache.set('k3', 'v3'); // Should evict k2, not k1

    expect(cache.get('k1')).toBe('v1_updated');
    expect(cache.get('k2')).toBeUndefined();
    expect(cache.get('k3')).toBe('v3');
  });
});

describe('Profile Completion Calculation (Guaranteed 100% on Complete Profile)', () => {
  it('should calculate 100% when all standard profile wizard sections are completed', () => {
    const completeProfileData = {
      firstName: 'Rahul',
      lastName: 'Sharma',
      gender: 'male' as const,
      dateOfBirth: new Date('1995-05-15'),
      heightCm: 175,
      city: 'Delhi',
      religion: 'Hindu',
      motherTongue: 'Hindi',
      education: 'B.Tech Computer Science',
      occupation: 'Software Engineer',
      photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg' }],
      aboutMe: 'Seeking a kind, cultured and family-oriented life partner.',
      familyValues: 'moderate' as const,
      familyType: 'nuclear' as const,
    };

    const completeness = ProfileService.calculateCompleteness(completeProfileData as any);
    expect(completeness).toBe(100);
  });

  it('should calculate 100% even if aboutMe is concise when family or marital status details are present', () => {
    const profileWithShortBio = {
      firstName: 'Pooja',
      lastName: 'Verma',
      gender: 'female' as const,
      dateOfBirth: new Date('1997-08-20'),
      heightCm: 162,
      city: 'Lucknow',
      religion: 'Hindu',
      motherTongue: 'Hindi',
      education: 'MBA Marketing',
      occupation: 'Brand Manager',
      photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/sample2.jpg' }],
      aboutMe: 'Looking for a life partner.', // 27 characters
      familyType: 'joint' as const,
    };

    const completeness = ProfileService.calculateCompleteness(profileWithShortBio as any);
    expect(completeness).toBe(100);
  });

  it('should accurately calculate partial profiles and never exceed 100%', () => {
    const partialData = {
      firstName: 'Amit',
      lastName: 'Kumar',
      dateOfBirth: new Date('1994-01-01'),
      heightCm: 170,
    };

    const partialScore = ProfileService.calculateCompleteness(partialData as any);
    expect(partialScore).toBe(25);
  });
});
