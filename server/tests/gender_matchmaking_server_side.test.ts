import { SearchService, inMemoryProfileRegistry } from '../src/services/search.service';
import { inMemoryProfileStore, ProfileService } from '../src/services/profile.service';
import { SearchFilterInput } from '@bandhansetu/shared';

const filters: SearchFilterInput = { page: 1, limit: 10, sortBy: 'best_match' };

const put = (userId: string, gender: any, name: string) =>
  inMemoryProfileStore.set(userId, {
    userId,
    gender,
    firstName: name,
    lastName: 'Test',
    dateOfBirth: new Date('1996-01-01'),
  });

describe('Server-side opposite-gender matchmaking', () => {
  beforeEach(() => {
    inMemoryProfileStore.clear();
    inMemoryProfileRegistry.length = 0;
    put('m1', 'male', 'Rahul');
    put('m2', 'male', 'Amit');
    put('f1', 'female', 'Pooja');
    put('f2', 'female', 'Neha');
    put('nogender', undefined, 'Ghost');
  });

  it('male viewer sees only female profiles', async () => {
    const res = await SearchService.searchProfiles('m1', filters);
    expect(res.items.length).toBe(2);
    expect(res.items.every((p) => p.gender === 'female')).toBe(true);
  });

  it('female viewer sees only male profiles', async () => {
    const res = await SearchService.searchProfiles('f1', filters);
    expect(res.items.length).toBe(2);
    expect(res.items.every((p) => p.gender === 'male')).toBe(true);
  });

  it('never returns the viewer own profile', async () => {
    const res = await SearchService.searchProfiles('m1', filters);
    expect(res.items.find((p) => p.displayName.startsWith('Rahul'))).toBeUndefined();
  });

  it('excludes profiles with missing gender', async () => {
    const asMale = await SearchService.searchProfiles('m1', filters);
    const asFemale = await SearchService.searchProfiles('f1', filters);
    expect([...asMale.items, ...asFemale.items].some((p) => p.displayName.startsWith('Ghost'))).toBe(false);
  });

  it('ignores a client-supplied gender param (cannot see same gender)', async () => {
    const res = await SearchService.searchProfiles('m1', { ...filters, gender: 'male' as any });
    expect(res.items.every((p) => p.gender === 'female')).toBe(true);
  });

  it('viewer with missing gender gets no results (nothing assumed)', async () => {
    const res = await SearchService.searchProfiles('nogender', filters);
    expect(res.items).toEqual([]);
    expect(res.pagination.totalCount).toBe(0);
  });

  it('preserves pagination', async () => {
    const res = await SearchService.searchProfiles('m1', { ...filters, limit: 1 });
    expect(res.items.length).toBe(1);
    expect(res.pagination.totalCount).toBe(2);
    expect(res.pagination.totalPages).toBe(2);
  });

  it('direct public profile access: opposite gender ok, same gender blocked, own allowed', async () => {
    await expect(ProfileService.getPublicProfile('f1', 'm1')).resolves.toBeDefined();
    await expect(ProfileService.getPublicProfile('m2', 'm1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(ProfileService.getPublicProfile('m1', 'm1')).resolves.toBeDefined();
  });
});
