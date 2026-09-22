<script lang="ts">
	import { onMount } from 'svelte';
	import { SKY, skyTransform, starfield } from '$lib/hero-sky';

	/**
	 * The sky behind the home hero: the share card's, on the page — and then
	 * alive.
	 *
	 * **Two layers, and the order matters.** The SVG below is server-rendered
	 * markup and CSS with no script and no timers: same gradient, same coral
	 * glow, same seeded starfield as `brand/og-image.svg`, so the page a
	 * visitor lands on is the card they clicked, and it is painted before a
	 * line of JavaScript has run. A canvas then takes over on mount and draws
	 * *the same stars* — same seed, same `xMidYMid slice` mapping via
	 * `skyTransform` — so the handover is invisible, and from there the field
	 * answers the pointer, answers the scroll, and wanders on its own.
	 *
	 * The card's night is the dark theme's; the light theme gets the same sky
	 * at dawn, its stars nearly out. Both are `--hero-*` tokens in `app.css` —
	 * this component names no colour of its own, and the canvas reads them off
	 * the element rather than repeating them.
	 *
	 * **Under prefers-reduced-motion the canvas never starts.** The SVG is
	 * already the still version of this field, so the reduced-motion path is
	 * not a degraded copy of the live one — it is the layer that was there
	 * first, hover and all.
	 *
	 * Decorative, and hidden from assistive technology as a whole: the hero's
	 * words say what this place is; the sky only says where.
	 */
	const stars = starfield();

	let sky: HTMLDivElement;
	let field: HTMLCanvasElement;
	let live = false;

	onMount(() => {
		const still = matchMedia('(prefers-reduced-motion: reduce)');
		const fine = matchMedia('(pointer: fine)');
		const ctx = field?.getContext('2d');
		if (!ctx || still.matches) return;

		/* The hero is what the pointer is measured against, and the canvas only
		   covers part of it on a tall screen. Both rectangles are read once per
		   resize: the old mistake to avoid is `getBoundingClientRect()` inside a
		   pointermove handler, which forces a layout hundreds of times a second
		   to re-learn a rectangle that has not moved. */
		let w = 0;
		let h = 0;
		let heroTop = 0;
		let heroLeft = 0;
		let heroWidth = 1;
		let heroHeight = 1;
		let raf = 0;

		/* Pointer, eased. `px/py` is where it is, `tx/ty` is where the field has
		   got to — a field that snaps to the cursor reads as a mirror, not as
		   depth. */
		let px = 0;
		let py = 0;
		let tx = 0;
		let ty = 0;
		let scroll = 0;
		/* A coarse pointer has no cursor to answer, so once it has arrived there
		   is nothing to keep drawing for. It sleeps, and scroll wakes it. */
		let awakeUntil = 0;
		const SETTLE_MS = 500;

		let star = 'rgb(255, 255, 255)';
		let fieldAlpha = 1;
		let haloAlpha = 1;
		let glow = 'rgb(255, 138, 101)';

		const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
		const wrap = (v: number, span: number) => ((v % span) + span) % span;

		/* The themes live in `app.css`, so they are read off the element rather
		   than restated here. Re-read on a theme change and on resize — never in
		   the frame loop, where `getComputedStyle` would be a layout read sixty
		   times a second. */
		function readTheme() {
			const style = getComputedStyle(sky);
			star = style.getPropertyValue('--hero-star').trim() || star;
			glow = style.getPropertyValue('--hero-glow').trim() || glow;
			fieldAlpha = Number(style.getPropertyValue('--hero-star-opacity')) || 1;
			const halo = style.getPropertyValue('--hero-halo-opacity').trim();
			haloAlpha = halo === '' ? 1 : Number(halo);
		}

		/* `color-mix` rather than string surgery on the token: the tokens are
		   hex today and could be anything CSS accepts tomorrow, and a regex that
		   assumes `rgb(` is how this breaks quietly six months from now. */
		const tint = (colour: string, alpha: number) =>
			`color-mix(in srgb, ${colour} ${Math.round(clamp01(alpha) * 100)}%, transparent)`;

		function size() {
			const hero = sky.parentElement ?? sky;
			const heroRect = hero.getBoundingClientRect();
			heroTop = heroRect.top + window.scrollY;
			heroLeft = heroRect.left + window.scrollX;
			heroWidth = Math.max(heroRect.width, 1);
			heroHeight = Math.max(heroRect.height, 1);

			const rect = field.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			// Capped: this field is soft-edged points, and a 3x ratio triples the
			// fill cost of every one of them for nothing anybody can see.
			const dpr = Math.min(window.devicePixelRatio || 1, fine.matches ? 2 : 1.5);
			field.width = Math.round(w * dpr);
			field.height = Math.round(h * dpr);
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			readTheme();
		}

		function draw(t: number) {
			ctx!.clearRect(0, 0, w, h);
			const { scale, offsetX, offsetY } = skyTransform(w, h);

			tx += (px - tx) * 0.07;
			ty += (py - ty) * 0.07;

			// A pool of light where the cursor is, under the stars. The coral of
			// the hero's own wash rather than a fifth colour.
			if (fine.matches) {
				const gx = (tx + 0.5) * w;
				const gy = (ty + 0.5) * h;
				const pool = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 360);
				pool.addColorStop(0, tint(glow, 0.06 * fieldAlpha));
				pool.addColorStop(1, tint(glow, 0));
				ctx!.fillStyle = pool;
				ctx!.fillRect(0, 0, w, h);
			}

			const margin = 80;
			for (const s of stars) {
				// Everything is derived from depth. The near stars travel several
				// times further than the far ones, which is the only thing that
				// makes this read as a sky rather than as a sliding sheet.
				const depth = 0.22 + s.z * 3.4;

				const wanderX = Math.sin(t * s.speed + s.phase);
				const wanderY = Math.cos(t * s.speed * 0.73 + s.phase);
				const amp = 4 + s.z * 26;

				const x = offsetX + s.x * scale + tx * 46 * depth + wanderX * s.driftX * amp;
				const y =
					wrap(
						offsetY +
							s.y * scale +
							ty * 46 * depth +
							wanderY * s.driftY * amp -
							scroll * depth * 30 +
							margin,
						h + margin * 2
					) - margin;

				// Found by a cursor: the closer it is, the more the star lifts.
				const near = fine.matches
					? Math.max(0, 1 - Math.hypot(x - (tx + 0.5) * w, y - (ty + 0.5) * h) / 260)
					: 0;
				const lift = near * near;

				// The twinkle the CSS layer does with an animation. Same quarter of
				// the stars, same periods, so the two layers agree about which ones
				// breathe.
				const breath = s.twinkle
					? 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(((t / 1000 + s.delay) / s.period) * Math.PI))
					: 1;

				const radius = (s.r + s.z * 0.9) * scale * (1 + lift * 0.9);
				const alpha = clamp01(s.opacity * breath * fieldAlpha * (1 + lift * 1.8));

				// The soft halo the bright few carry, and the one a lifted star
				// earns while the cursor is on it.
				const haloStrength = (s.r >= 1.8 ? haloAlpha : 0) + lift * 0.9 * haloAlpha;
				if (haloStrength > 0.01) {
					const outer = radius * 7;
					const halo = ctx!.createRadialGradient(x, y, 0, x, y, outer);
					halo.addColorStop(0, tint(star, 0.45 * haloStrength * alpha));
					halo.addColorStop(0.4, tint(star, 0.12 * haloStrength * alpha));
					halo.addColorStop(1, tint(star, 0));
					ctx!.fillStyle = halo;
					ctx!.beginPath();
					ctx!.arc(x, y, outer, 0, Math.PI * 2);
					ctx!.fill();
				}

				ctx!.fillStyle = tint(star, alpha);
				ctx!.beginPath();
				ctx!.arc(x, y, radius, 0, Math.PI * 2);
				ctx!.fill();
			}
		}

		function frame(t: number) {
			draw(t);
			if (fine.matches) {
				raf = requestAnimationFrame(frame);
				return;
			}
			// Touch: draw while something is happening, then keep the last frame.
			if (t > awakeUntil) {
				stop();
				return;
			}
			raf = requestAnimationFrame(frame);
		}

		function start() {
			if (raf) return;
			raf = requestAnimationFrame(frame);
		}

		function stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		}

		size();
		draw(performance.now());
		// Only now: the SVG stays until there is a painted canvas to replace it,
		// so there is no frame with no sky in it.
		live = true;

		const onResize = () => {
			size();
			draw(performance.now());
		};

		const onMove = (e: PointerEvent) => {
			px = (e.clientX - (heroLeft - window.scrollX)) / heroWidth - 0.5;
			py = (e.clientY - (heroTop - window.scrollY)) / heroHeight - 0.5;
		};

		const onLeave = () => {
			px = 0;
			py = 0;
		};

		// 0 at the top of the hero, 1 once it has scrolled a full height away.
		// Reads no layout — `scrollY - heroTop` is the same number as `-rect.top`.
		const onScroll = () => {
			scroll = clamp01((window.scrollY - heroTop) / heroHeight);
			if (!fine.matches) {
				awakeUntil = performance.now() + SETTLE_MS;
				start();
			}
		};

		// Nothing draws while the sky is off screen or the tab is in the
		// background. A decorative field is the last thing that should be
		// spending a battery it cannot be seen with.
		const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
			threshold: 0
		});
		io.observe(field);

		const onVisibility = () => (document.hidden ? stop() : start());
		const theme = new MutationObserver(() => {
			readTheme();
			draw(performance.now());
		});
		theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

		window.addEventListener('resize', onResize, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		document.addEventListener('visibilitychange', onVisibility);
		if (fine.matches) {
			sky.addEventListener('pointermove', onMove, { passive: true });
			sky.addEventListener('pointerleave', onLeave, { passive: true });
		}
		onScroll();

		return () => {
			stop();
			io.disconnect();
			theme.disconnect();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('visibilitychange', onVisibility);
			sky.removeEventListener('pointermove', onMove);
			sky.removeEventListener('pointerleave', onLeave);
		};
	});
</script>

<div class="hero-sky" class:is-live={live} bind:this={sky} aria-hidden="true">
	<canvas class="live" bind:this={field}></canvas>
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

	/* The live layer sits exactly where the SVG does and draws exactly what it
	   draws, so the swap is a swap and not a transition. It is only ever shown
	   once a frame has been painted into it. */
	/* Hidden with `opacity`, not `display`, and that is not a style choice:
	   `size()` measures this canvas before the swap, and a `display: none`
	   element has a zero-sized rect — the first version set its backing store
	   to 0×0 and painted a sky nobody could see. It is laid out from the
	   start; it is only invisible. */
	.live {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
	}

	.hero-sky.is-live .live {
		opacity: 1;
	}

	/* The server-rendered field steps aside rather than being removed: it is
	   still the whole sky under reduced motion, with JavaScript off, and for
	   every millisecond before hydration. */
	.hero-sky.is-live .stars {
		display: none;
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
