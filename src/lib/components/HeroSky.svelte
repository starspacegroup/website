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
			<g class="cell">
				{#if star.r >= 1.8}
					<circle class="halo" cx={star.x} cy={star.y} r={star.r * 7} />
				{/if}

				<!-- The halo a pointer brings up, on every star rather than only the
				     bright few. It is drawn under the point and carries no size of
				     its own until it is wanted. -->
				<circle class="flare" cx={star.x} cy={star.y} r={Math.max(star.r * 9, 16)} />

				<circle
					class="star"
					class:twinkle={star.twinkle}
					cx={star.x}
					cy={star.y}
					r={star.r}
					opacity={star.opacity}
					style={star.twinkle ? `--period: ${star.period}s; --delay: ${star.delay}s` : undefined}
				/>

				<!-- The hit box, and the reason any of this is reachable. A star is
				     between 0.6 and 2.4 units across in a 1600-unit sky; nobody is
				     aiming at that. This is transparent, last so it sits on top, and
				     the only thing in the sky that takes a pointer at all. -->
				<circle class="hit" cx={star.x} cy={star.y} r={Math.max(star.r * 6, 13)} />
			</g>
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

	/* ── a star answers the pointer ───────────────────────────────────────
	   The same move the Braille figure on davis9001.com makes, read across to
	   a different artifact. There the dots rest nearly unlit and come up one
	   cell at a time, because Braille is not a thing you see across a room —
	   it is a thing you find with a hand and it answers.

	   A sky is the opposite in one respect and the same in another. It IS
	   meant to be seen across a room, so the resting field does not dim: this
	   sky is the share card's sky, and a visitor who clicked the card has to
	   land on it. What carries over is the answering. Pass a pointer across
	   the field and the star under it brightens, alone, with its own small
	   flare — one at a time, the way you actually look at a sky.

	   Nothing is only available this way. The stars are decoration, marked
	   `aria-hidden` on the whole sky, and the hero's words carry every piece
	   of meaning on the page. This is a reward for wandering, not a route to
	   anything, which is also why the stars are not focusable: a focus stop on
	   an aria-hidden decoration is a trap that says nothing when it is reached. */
	/* The hit box is the only thing in the sky that takes a pointer, and the
	   rest has to say so out loud: a `.flare` is thirty-two units across and
	   `opacity: 0` does not stop hit testing, so one star's invisible flare can
	   sit over a neighbour's hit box and take the hover meant for it. Honest
	   about what it bought: at the sizes this field actually generates, the
	   reachable count did not move (28 of 136 on a 1600px screen either way).
	   It is kept because the overlap is real and the field is seeded — a
	   different seed, or a denser count, would find it. */
	.stars circle {
		pointer-events: none;
	}

	/* Written `.stars .hit` rather than `.hit` on purpose. Svelte adds a
	   scoping class to both selectors, which leaves a bare `.hit` at a lower
	   specificity than the descendant rule above it — the first attempt turned
	   every star off, including the boxes that were supposed to stay on, and
	   reachability went from 28 to 0 rather than up. Measured, not reasoned. */
	.stars .hit {
		fill: transparent;
		pointer-events: auto;
	}

	.star {
		transform-box: fill-box;
		transform-origin: center;
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}

	.flare {
		fill: url(#hero-sky-halo);
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		transform: scale(0.4);
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}

	/* Faster going on than coming off: the light arrives about as quickly as
	   the eye lands, and lingers a moment behind the pointer, so a sweep
	   leaves a wake rather than a hard edge. */
	.cell:hover .star {
		opacity: 1;
		transform: scale(1.9);
		transition-duration: 0.12s;
	}

	.cell:hover .flare {
		opacity: 0.55;
		transform: scale(1);
		transition-duration: 0.12s;
	}

	/* A twinkling star is mid-animation, and the animation owns `opacity`.
	   Without this the hovered star is lit by the transform and then dragged
	   back down by whatever frame the twinkle is on. */
	.cell:hover .star.twinkle {
		animation: none;
	}

	/* No pointer, no hover, and no way to find any of it — so a touch screen
	   is simply left the sky it already had, rather than a secret it cannot
	   reach. Nothing to add here; the resting field is the whole design. */
	@media (hover: none) {
		.flare {
			display: none;
		}
	}

	/* Reduced motion keeps the response and drops the travel. It answers a
	   person's own action, so it should still happen — just without the
	   scaling and the fade. */
	@media (prefers-reduced-motion: reduce) {
		.star,
		.flare {
			transition: none;
		}

		.cell:hover .star {
			transform: none;
		}

		.cell:hover .flare {
			transform: scale(1);
		}
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
