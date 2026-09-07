<script lang="ts">
	import { SKY, starfield } from '$lib/hero-sky';

	/**
	 * The sky behind the home hero: the share card's, on the page.
	 *
	 * Same gradient, same coral glow, same seeded starfield as
	 * `brand/og-image.svg`, so the page a visitor lands on is the card they
	 * clicked. The card's night is the dark theme's; the light theme gets the
	 * same sky at dawn, its stars nearly out. Both are `--hero-*` tokens in
	 * `app.css` — this component names no colour of its own. It is server-rendered markup and CSS — no script, no timers, no
	 * filters — so it paints before hydration, stays crisp at any zoom, and
	 * costs nothing once painted. Under prefers-reduced-motion the stars hold
	 * still.
	 *
	 * Decorative, and hidden from assistive technology as a whole: the hero's
	 * words say what this place is; the sky only says where.
	 */
	const stars = starfield();
</script>

<div class="hero-sky" aria-hidden="true">
	<svg class="stars" viewBox="0 0 {SKY.width} {SKY.height}" preserveAspectRatio="xMidYMid slice">
		<defs>
			<!-- The halo fades to nothing at its edge. A flat disc at low opacity
			     reads as a moon, not a glow. -->
			<radialGradient id="hero-sky-halo">
				<stop offset="0" class="halo-stop" stop-opacity="0.45" />
				<stop offset="0.4" class="halo-stop" stop-opacity="0.12" />
				<stop offset="1" class="halo-stop" stop-opacity="0" />
			</radialGradient>
		</defs>
		{#each stars as star, i (i)}
			{#if star.r >= 1.8}
				<circle class="halo" cx={star.x} cy={star.y} r={star.r * 7} />
			{/if}
			<circle
				class="star"
				class:twinkle={star.twinkle}
				cx={star.x}
				cy={star.y}
				r={star.r}
				opacity={star.opacity}
				style={star.twinkle ? `--period: ${star.period}s; --delay: ${star.delay}s` : undefined}
			/>
		{/each}
	</svg>
</div>

<style>
	/* The card's sky: a navy that brightens toward where the mark sits and
	   falls to near-black at the edges, with a faint second wash of coral low
	   and to the right, under the voice panel on a wide screen. The centre of
	   the brightening moves with the layout — over the mark on a phone, over
	   the copy column beside the panel on a desktop. */
	.hero-sky {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background:
			radial-gradient(
				ellipse 70% 55% at 85% 100%,
				color-mix(in srgb, var(--hero-glow) var(--hero-wash, 9%), transparent),
				transparent 70%
			),
			radial-gradient(ellipse 95% 85% at 50% 28%, var(--hero-sky), var(--hero-sky-deep));
	}

	@media (min-width: 1024px) {
		.hero-sky {
			background:
				radial-gradient(
					ellipse 60% 60% at 85% 95%,
					color-mix(in srgb, var(--hero-glow) var(--hero-wash, 9%), transparent),
					transparent 70%
				),
				radial-gradient(ellipse 85% 95% at 28% 40%, var(--hero-sky), var(--hero-sky-deep));
		}
	}

	.stars {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* The whole field dims together in the light theme: these are the last
	   stars before sunrise, not a night sky on a white page. Per-star opacity
	   from the generator multiplies with this. */
	.stars {
		opacity: var(--hero-star-opacity, 1);
	}

	.star {
		fill: var(--hero-star);
	}

	/* The bright few get a soft halo, which is what gives the field depth on a
	   night sky. A soft grey disc on a pale one is just a smudge, so the light
	   theme sets --hero-halo-opacity to 0 and keeps the crisp points only. */
	.halo {
		fill: url(#hero-sky-halo);
		opacity: var(--hero-halo-opacity, 1);
	}

	.halo-stop {
		stop-color: var(--hero-star);
	}

	/* A quarter of the stars breathe, each on its own period and already
	   part-way through it, so nothing pulses in step and there is no seam. */
	.twinkle {
		animation: twinkle var(--period) ease-in-out var(--delay) infinite alternate;
	}

	@keyframes twinkle {
		from {
			opacity: 0.15;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.twinkle {
			animation: none;
		}
	}
</style>
