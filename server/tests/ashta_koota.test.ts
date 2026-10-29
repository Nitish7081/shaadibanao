import { AstrologyService } from '../src/services/astrology.service';

describe('Vedic Ashta Koota Milan & 36 Gunas Scoring Suite', () => {
  it('Pair 1: Mesh/Ashwini (Groom) & Simha/Magha (Bride) - 25 Gunas (Good)', () => {
    const result = AstrologyService.calculateAshtaKoota(
      'Mesh (Aries)',
      'Ashwini',
      'Simha (Leo)',
      'Magha',
      false,
      false
    );

    expect(result.maxScore).toBe(36);
    expect(result.breakdown).toHaveLength(8);

    // Verify 8 Kootas
    const varna = result.breakdown.find((k) => k.kootaName === 'Varna')!;
    const vashya = result.breakdown.find((k) => k.kootaName === 'Vashya')!;
    const tara = result.breakdown.find((k) => k.kootaName === 'Tara')!;
    const yoni = result.breakdown.find((k) => k.kootaName === 'Yoni')!;
    const graha = result.breakdown.find((k) => k.kootaName === 'Graha Maitri')!;
    const gana = result.breakdown.find((k) => k.kootaName === 'Gana')!;
    const bhakoot = result.breakdown.find((k) => k.kootaName === 'Bhakoot')!;
    const nadi = result.breakdown.find((k) => k.kootaName === 'Nadi')!;

    expect(varna.obtainedPoints).toBe(1);
    expect(vashya.obtainedPoints).toBe(2);
    expect(tara.obtainedPoints).toBe(0);
    expect(yoni.obtainedPoints).toBe(2);
    expect(graha.obtainedPoints).toBe(4);
    expect(gana.obtainedPoints).toBe(1);
    expect(bhakoot.obtainedPoints).toBe(7);
    expect(nadi.obtainedPoints).toBe(8); // Ashwini (Aadi) vs Magha (Antya)

    expect(result.totalScore).toBe(25);
    expect(result.compatibilityVerdict).toBe('Good');
    expect(result.manglikAnalysis.manglikMatch).toBe(true);
  });

  it('Pair 2: Kark/Pushya & Kark/Pushya - 25 Gunas with Nadi Dosha detected', () => {
    const result = AstrologyService.calculateAshtaKoota(
      'Kark (Cancer)',
      'Pushya',
      'Kark (Cancer)',
      'Pushya',
      true,
      true
    );

    const nadi = result.breakdown.find((k) => k.kootaName === 'Nadi')!;
    // Same Nadi (Pushya is Madhya) -> 0 points (Nadi Dosha)
    expect(nadi.obtainedPoints).toBe(0);
    expect(nadi.description).toContain('Nadi Dosha');

    // Both are Manglik -> mutually cancelled
    expect(result.manglikAnalysis.manglikMatch).toBe(true);
    expect(result.manglikAnalysis.summary).toContain('mutually cancelled');
    expect(result.totalScore).toBe(25);
  });

  it('Pair 3: Kark/Ashlesha & Kumbh/Shatabhisha - 19 Gunas with Bhakoot Dosha (6/8 distance)', () => {
    const result = AstrologyService.calculateAshtaKoota(
      'Kark (Cancer)',
      'Ashlesha',
      'Kumbh (Aquarius)',
      'Shatabhisha',
      true,
      false
    );

    const bhakoot = result.breakdown.find((k) => k.kootaName === 'Bhakoot')!;
    // Rashi distance 8 -> 0 points (Bhakoot difference)
    expect(bhakoot.obtainedPoints).toBe(0);
    expect(bhakoot.description).toContain('Bhakoot difference');

    // Manglik mismatch
    expect(result.manglikAnalysis.manglikMatch).toBe(false);
    expect(result.totalScore).toBe(19);
    expect(result.compatibilityVerdict).toBe('Good');
  });
});

