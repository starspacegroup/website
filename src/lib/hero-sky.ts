/**
 * The starfield behind the home hero.
 *
 * Deterministic on purpose. The stars come from a seeded generator, so the
 * server and the browser lay out the same sky, hydration has nothing to
 * reconcile, and a rebuild is not a fresh sky. The seed is the share card's
 * (`brand/og-image.svg`, 20260904): the hero and the card are the same night.
 *
 * A plain module rather than code inside the component, so it is testable and
 * counted — `*.svelte` is excluded from coverage, this file is not.
 */

/** The sky's coordinate space. The SVG slices it to cover the hero at any size. */
export const SKY = { width: 1600, height: 900 } as const;

export type Star = {
	x: number;
	y: number;
	r: number;
	opacity: number;
	/** A few stars twinkle. `period` and `delay` are seconds, and 0 on the rest. */
	twinkle: boolean;
	period: number;
	delay: number;
};

/** mulberry32: small, fast, and plenty for scattering dots. Uniform on [0, 1). */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const round = (value: number, places = 1) => Number(value.toFixed(places));

/** The share card's seed. Same number, same night. */
export const SKY_SEED = 20260904;

export function starfield(seed = SKY_SEED, count = 140): Star[] {
	const random = seededRandom(seed);
	const stars: Star[] = [];
	for (let i = 0; i < count; i++) {
		// Skewed small: most stars are pinpricks, a handful are bright.
		const size = random() ** 2.2;
		const twinkle = random() < 0.25;
		stars.push({
			x: round(random() * SKY.width),
			y: round(random() * SKY.height),
			r: round(0.6 + size * 1.8),
			opacity: round(0.25 + random() * 0.7, 2),
			twinkle,
			period: twinkle ? round(3 + random() * 4) : 0,
			// Negative, so every twinkler is already part-way through its cycle
			// on first paint rather than all starting together.
			delay: twinkle ? round(-random() * 7) : 0
		});
	}
	return stars;
}
