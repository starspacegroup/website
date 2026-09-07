import { describe, expect, it } from 'vitest';
import { SKY, SKY_SEED, seededRandom, starfield } from './hero-sky';

describe('seededRandom', () => {
	it('repeats exactly for the same seed', () => {
		const a = seededRandom(7);
		const b = seededRandom(7);
		const run = (next: () => number) => Array.from({ length: 8 }, next);
		expect(run(a)).toEqual(run(b));
	});

	it('differs between seeds', () => {
		expect(seededRandom(1)()).not.toBe(seededRandom(2)());
	});

	it('stays on [0, 1) and is roughly uniform', () => {
		const values = Array.from({ length: 2000 }, seededRandom(42));
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...values)).toBeLessThan(1);
		const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
		expect(mean).toBeGreaterThan(0.45);
		expect(mean).toBeLessThan(0.55);
	});
});

describe('starfield', () => {
	it('draws the same sky every time, from the share card seed', () => {
		expect(SKY_SEED).toBe(20260904);
		expect(starfield()).toEqual(starfield());
		expect(starfield()).toEqual(starfield(SKY_SEED, 140));
	});

	it('draws a different sky for a different seed', () => {
		expect(starfield(1)).not.toEqual(starfield(2));
	});

	it('honours the requested count', () => {
		expect(starfield(SKY_SEED, 12)).toHaveLength(12);
		expect(starfield()).toHaveLength(140);
	});

	it('keeps every star inside the sky, small, and visible', () => {
		for (const star of starfield()) {
			expect(star.x).toBeGreaterThanOrEqual(0);
			expect(star.x).toBeLessThanOrEqual(SKY.width);
			expect(star.y).toBeGreaterThanOrEqual(0);
			expect(star.y).toBeLessThanOrEqual(SKY.height);
			expect(star.r).toBeGreaterThanOrEqual(0.6);
			expect(star.r).toBeLessThanOrEqual(2.4);
			expect(star.opacity).toBeGreaterThanOrEqual(0.25);
			expect(star.opacity).toBeLessThanOrEqual(0.95);
		}
	});

	it('is mostly pinpricks', () => {
		const stars = starfield();
		const bright = stars.filter((star) => star.r >= 1.8).length;
		expect(bright).toBeGreaterThan(0);
		expect(bright).toBeLessThan(stars.length / 4);
	});

	it('makes some stars twinkle, not most, and only those carry a period and a delay', () => {
		const stars = starfield();
		const twinklers = stars.filter((star) => star.twinkle);
		expect(twinklers.length).toBeGreaterThan(stars.length / 10);
		expect(twinklers.length).toBeLessThan(stars.length / 2);
		for (const star of twinklers) {
			expect(star.period).toBeGreaterThanOrEqual(3);
			expect(star.period).toBeLessThanOrEqual(7);
			expect(star.delay).toBeLessThanOrEqual(0);
			expect(star.delay).toBeGreaterThanOrEqual(-7);
		}
		for (const star of stars.filter((star) => !star.twinkle)) {
			expect(star.period).toBe(0);
			expect(star.delay).toBe(0);
		}
	});
});
