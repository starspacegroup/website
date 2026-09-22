import { describe, expect, it } from 'vitest';
import { SKY, SKY_SEED, seededRandom, skyTransform, starfield } from './hero-sky';

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

describe('the share card is not allowed to move', () => {
	/**
	 * `brand/og-image.svg` is a fixed file with this sky already drawn into it.
	 * Every star's geometry here is pinned, because the way this breaks is not
	 * a failing assertion — it is one extra `random()` call added inside the
	 * loop, which shifts every star after it and quietly stops the page being
	 * the card somebody clicked.
	 */
	it('still draws the sky that is in the file', () => {
		const stars = starfield();
		const geometry = ({ x, y, r, opacity }: (typeof stars)[number]) => ({ x, y, r, opacity });

		expect(geometry(stars[0])).toEqual({ x: 421.8, y: 116.4, r: 0.7, opacity: 0.57 });
		expect(geometry(stars[1])).toEqual({ x: 856.7, y: 98, r: 0.8, opacity: 0.45 });
		expect(geometry(stars[2])).toEqual({ x: 42.6, y: 227.8, r: 1.8, opacity: 0.31 });
		expect(geometry(stars[139])).toEqual({ x: 575.6, y: 478.2, r: 0.6, opacity: 0.66 });
	});
});

describe('starfield motion', () => {
	it('gives every star a depth, a direction and a period of its own', () => {
		for (const star of starfield()) {
			expect(star.z).toBeGreaterThanOrEqual(0);
			expect(star.z).toBeLessThan(1);
			expect(Math.abs(star.driftX)).toBeGreaterThanOrEqual(0.16);
			expect(Math.abs(star.driftX)).toBeLessThanOrEqual(0.35);
			expect(Math.abs(star.driftY)).toBeGreaterThanOrEqual(0.16);
			expect(Math.abs(star.driftY)).toBeLessThanOrEqual(0.35);
			expect(star.phase).toBeGreaterThanOrEqual(0);
			expect(star.phase).toBeLessThan(Math.PI * 2);
		}
	});

	it('drifts in both directions rather than all one way', () => {
		const stars = starfield();
		expect(stars.some((star) => star.driftX > 0)).toBe(true);
		expect(stars.some((star) => star.driftX < 0)).toBe(true);
		expect(stars.some((star) => star.driftY > 0)).toBe(true);
		expect(stars.some((star) => star.driftY < 0)).toBe(true);
	});

	it('wanders slowly: one cycle every 26 to 60 seconds', () => {
		for (const star of starfield()) {
			const seconds = (2 * Math.PI) / star.speed / 1000;
			expect(seconds).toBeGreaterThanOrEqual(26);
			expect(seconds).toBeLessThanOrEqual(60);
		}
	});

	it('spreads depth toward the back, so the layers are told apart', () => {
		// A narrow spread reads as one sheet sliding. The skew is the thing
		// being asserted, not the individual numbers.
		const depths = starfield().map((star) => star.z);
		const mean = depths.reduce((sum, z) => sum + z, 0) / depths.length;
		expect(mean).toBeLessThan(0.45);
		expect(Math.max(...depths)).toBeGreaterThan(0.8);
	});

	it('is as repeatable as the rest of the sky', () => {
		expect(starfield().map((s) => s.z)).toEqual(starfield().map((s) => s.z));
		expect(starfield(1).map((s) => s.z)).not.toEqual(starfield(2).map((s) => s.z));
	});
});

describe('skyTransform', () => {
	it('covers the box and centres the overflow, like xMidYMid slice', () => {
		// Wider than the sky: scale to the width, crop top and bottom evenly.
		const wide = skyTransform(3200, 900);
		expect(wide.scale).toBe(2);
		expect(wide.offsetX).toBe(0);
		expect(wide.offsetY).toBe((900 - 1800) / 2);

		// Taller: scale to the height instead, crop the sides.
		const tall = skyTransform(800, 900);
		expect(tall.scale).toBe(1);
		expect(tall.offsetX).toBe((800 - 1600) / 2);
		expect(tall.offsetY).toBe(0);
	});

	it('matches the sky exactly at its own size', () => {
		expect(skyTransform(SKY.width, SKY.height)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
	});
});
