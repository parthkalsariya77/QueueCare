import { describe, it, expect, beforeEach } from 'vitest';
import { calculateEWMA, calculateMedian, calculateStdDev, blendDuration } from '../services/eta.service.js';

describe('Adaptive ETA Engine Unit Tests', () => {
  it('calculates Exponentially Weighted Moving Average (EWMA) with alpha 0.30 correctly', () => {
    // Single observation: EWMA equals the observation
    expect(calculateEWMA([10])).toBe(10);

    // Two observations: 10, 14 -> 0.30 * 14 + 0.70 * 10 = 4.2 + 7.0 = 11.2
    expect(calculateEWMA([10, 14], 0.30)).toBe(11.2);

    // Recent observations carry more weight
    const trendingUp = [8, 9, 10, 12, 14];
    const ewmaUp = calculateEWMA(trendingUp, 0.30);
    // Should be higher than simple arithmetic mean (10.6) because of recent high values
    expect(ewmaUp).toBeGreaterThan(10.6);
  });

  it('calculates median correctly for odd and even datasets', () => {
    expect(calculateMedian([5, 8, 12])).toBe(8);
    expect(calculateMedian([6, 8, 10, 14])).toBe(9);
    expect(calculateMedian([])).toBe(10); // fallback
  });

  it('smooths doctor EWMA with department median using sample-size weighting', () => {
    const doctorEWMA = 15;
    const deptMedian = 10;
    const k = 5;

    // With 0 doctor samples, should equal department median (10)
    expect(blendDuration(doctorEWMA, deptMedian, 0, k)).toBe(10);

    // With 5 doctor samples: weight = 5 / (5 + 5) = 0.50 -> (0.5 * 15 + 0.5 * 10) = 12.5
    expect(blendDuration(doctorEWMA, deptMedian, 5, k)).toBe(12.5);

    // With 20 doctor samples: weight = 20 / 25 = 0.80 -> (0.8 * 15 + 0.2 * 10) = 14.0
    expect(blendDuration(doctorEWMA, deptMedian, 20, k)).toBe(14.0);
  });

  it('calculates standard deviation and handles small sets safely', () => {
    expect(calculateStdDev([10, 10, 10])).toBe(0);
    expect(calculateStdDev([8, 12])).toBeCloseTo(2.8, 1);
    expect(calculateStdDev([10])).toBe(2.5); // safe fallback variance
  });
});
