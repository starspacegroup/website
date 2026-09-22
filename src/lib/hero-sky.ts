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
	/**
	 * Depth, on [0, 1), and the one number the live field derives everything
	 * from: how far a star travels under the pointer and the scroll, how wide
	 * it drifts, how much the cursor lifts it.
	 *
	 * Skewed toward the back on purpose. Parallax is only legible when the
	 * near and far layers move at obviously different rates — a narrow spread
	 * reads as one sheet sliding, which is worse than not moving at all.
	 */
	z: number;
	/** Direction and reach of the star's own slow wander, in units. */
	driftX: number;
	driftY: number;
	/** Radians per millisecond: one cycle every 26–60 seconds. */
	speed: number;
	/** Where in that cycle it starts, so the field never moves in unison. */
	phase: number;
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

/**
 * Offset for the motion stream's seed.
 *
 * The motion values come from a *second* generator rather than from more
 * draws inside the loop below, and that is the whole point of it: the share
 * card is a fixed SVG (`brand/og-image.svg`) and this function has to keep
 * producing the sky that is already in it. One extra `random()` call in that
 * loop shifts every star after it, and the page stops being the card somebody
 * clicked. Adding a stream beside it changes nothing that already existed.
 */
const MOTION_SEED_OFFSET = 0x5bd1e995;

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
			delay: twinkle ? round(-random() * 7) : 0,
			// Filled from the second stream below. Declared here so the shape of
			// the object never changes between the two passes.
			z: 0,
			driftX: 0,
			driftY: 0,
			speed: 0,
			phase: 0
		});
	}

	// The motion pass. Separate generator, so everything above is byte for byte
	// the sky the share card already shows.
	const motion = seededRandom(seed + MOTION_SEED_OFFSET);
	for (const star of stars) {
		const sign = () => (motion() < 0.5 ? -1 : 1);
		star.z = round(motion() ** 1.6, 3);
		star.driftX = round((0.16 + motion() * 0.19) * sign(), 3);
		star.driftY = round((0.16 + motion() * 0.19) * sign(), 3);
		// 26s to 60s for a full cycle. Slower than the Braille field on
		// davis9001.com, because a star that visibly circles is a firefly.
		star.speed = (2 * Math.PI) / (26000 + motion() * 34000);
		star.phase = motion() * Math.PI * 2;
	}

	return stars;
}

/**
 * How the sky's 1600×900 box maps onto a hero of some other shape.
 *
 * The SVG does this with `preserveAspectRatio="xMidYMid slice"`: scale to
 * cover, centre, crop the overflow. The canvas has to agree exactly, or the
 * field jumps the moment the live layer takes over from the server-rendered
 * one — which is the single most visible thing this component could get wrong.
 */
export function skyTransform(width: number, height: number) {
	const scale = Math.max(width / SKY.width, height / SKY.height);
	return {
		scale,
		offsetX: (width - SKY.width * scale) / 2,
		offsetY: (height - SKY.height * scale) / 2
	};
}
