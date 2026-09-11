<script lang="ts">
	/**
	 * A simulated Discord voice channel for the home hero — #Ten Forward, the
	 * server's lounge VC — with people arriving, leaving, talking and sharing a
	 * screen on a loop.
	 *
	 * It is CSS, not a GIF. A GIF of this would be a few hundred KB, fixed at one
	 * pixel size, dithered on the soft fills, locked to one theme and opaque to a
	 * screen reader. This is a few KB of markup: crisp at any zoom, it follows the
	 * light/dark tokens, and it freezes on a sensible frame under
	 * prefers-reduced-motion. Everything runs from CSS keyframes — no timers, no
	 * JS — so it plays before hydration and costs nothing after it.
	 *
	 * How the loop works, because it looks more complicated than it is: every seat
	 * runs the SAME presence keyframes. What differs is each seat's duration and
	 * its negative animation-delay, which starts it part-way through. Durations
	 * are deliberately co-prime-ish, so the pattern of who is in the room does not
	 * repeat on any short cycle and nobody can see the seam. Two seats are regulars
	 * with no presence animation at all, so the channel is never empty.
	 *
	 * The names are invented. Do not put real members in here without asking them.
	 */

	type Seat = {
		name: string;
		/** Seconds for this seat's join/leave cycle. `null` means a regular: always in. */
		presence: number | null;
		/** Negative offset into that cycle, in seconds, so seats are out of phase. */
		offset: number;
		/** Seconds between this seat's turns to talk. `null` means muted. */
		speech: number | null;
		speechOffset: number;
		/**
		 * Seconds for this seat's camera to come on and go off again. `null` means
		 * a camera that never comes on, which is most people most of the time.
		 */
		camera: number | null;
		cameraOffset: number;
	};

	const seats: Seat[] = [
		{
			name: 'nova',
			presence: null,
			offset: 0,
			speech: 9,
			speechOffset: -1,
			camera: 41,
			cameraOffset: -6
		},
		{
			name: 'quill',
			presence: null,
			offset: 0,
			speech: 13,
			speechOffset: -7,
			camera: null,
			cameraOffset: 0
		},
		{
			name: 'bramble',
			presence: 23,
			offset: -4,
			speech: null,
			speechOffset: 0,
			camera: 29,
			cameraOffset: -17
		},
		{
			name: 'orbit',
			presence: 19,
			offset: -13,
			speech: 11,
			speechOffset: -4,
			camera: null,
			cameraOffset: 0
		},
		{
			name: 'moss',
			presence: 29,
			offset: -21,
			speech: null,
			speechOffset: 0,
			camera: null,
			cameraOffset: 0
		},
		{
			name: 'kestrel',
			presence: 17,
			offset: -9,
			speech: 17,
			speechOffset: -12,
			camera: null,
			cameraOffset: 0
		}
	];
</script>

<figure
	class="vc"
	role="img"
	aria-label="A simulated view of the Ten Forward voice channel: members joining and leaving, some muted or on camera, one of them sharing their screen."
>
	<div class="vc-panel" aria-hidden="true">
		<div class="vc-header">
			<svg class="vc-speaker" width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path
					d="M4 6h2l3-2.5v9L6 10H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
					fill="currentColor"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linejoin="round"
				/>
				<path
					d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linecap="round"
				/>
			</svg>
			<span class="vc-name">Ten Forward</span>
			<span class="vc-live"><i class="vc-dot"></i>live</span>
		</div>

		<ul class="vc-seats">
			{#each seats as seat (seat.name)}
				<li
					class="vc-seat"
					class:vc-regular={seat.presence === null}
					style="--presence: {seat.presence ?? 0}s; --offset: {seat.offset}s;"
				>
					<span class="vc-person">
						<span
							class="vc-avatar"
							class:vc-muted={seat.speech === null}
							style="--speech: {seat.speech ?? 0}s; --speech-offset: {seat.speechOffset}s;"
							>{seat.name.slice(0, 2)}</span
						>

						<!-- The same two badges the live panel draws, in the same places and
						     the same colours, so the mic and the camera do not change
						     meaning when the simulation swaps out for the real room. The
						     camera comes and goes on its own cycle; the mic is fixed,
						     because a seat is either one of the talkers or one of the
						     listeners for the whole loop. -->
						{#if seat.camera !== null}
							<span
								class="vc-flag vc-flag-video"
								style="--camera: {seat.camera}s; --camera-offset: {seat.cameraOffset}s;"
							>
								<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
									<rect x="1.4" y="4.4" width="9.4" height="7.2" rx="1.6" fill="currentColor" />
									<path d="M11.6 8.2l3-2v5.6l-3-2z" fill="currentColor" />
								</svg>
							</span>
						{/if}
						{#if seat.speech === null}
							<span class="vc-flag vc-flag-muted">
								<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
									<path
										d="M8 2.4a1.9 1.9 0 0 1 1.9 1.9v3.4a1.9 1.9 0 0 1-3.8 0V4.3A1.9 1.9 0 0 1 8 2.4z"
										fill="currentColor"
									/>
									<path
										d="M4.3 7.5a3.7 3.7 0 0 0 7.4 0M8 11.2v2.4"
										stroke="currentColor"
										stroke-width="1.4"
										stroke-linecap="round"
									/>
									<path class="vc-slash-gap" d="M3.4 2.8l9.2 10.4" />
									<path class="vc-slash" d="M3.4 2.8l9.2 10.4" />
								</svg>
							</span>
						{/if}
					</span>
					<span class="vc-handle">{seat.name}</span>
				</li>
			{/each}
		</ul>
		<div class="vc-stage">
			<div class="vc-share">
				<div class="vc-share-chrome">
					<i></i><i></i><i></i>
					<span class="vc-share-title">quill is sharing a screen</span>
				</div>
				<div class="vc-share-body">
					<span class="vc-line vc-line-1"></span>
					<span class="vc-line vc-line-2"></span>
					<span class="vc-line vc-line-3"></span>
					<span class="vc-line vc-line-4"></span>
					<span class="vc-cursor"></span>
				</div>
				<span class="vc-share-badge">Screen</span>
			</div>
			<p class="vc-idle">nobody is sharing a screen right now</p>
		</div>
	</div>
</figure>

<style>
	/* The caller sets the measure through --vc-max-width; 26rem is the width
	   this panel was drawn at and stays the default. Both voice components
	   carry the identical rule, so the panel does not resize when it swaps
	   between the simulation and the real room. */
	.vc {
		width: 100%;
		max-width: var(--vc-max-width, 26rem);
		margin: 0 auto;
	}

	.vc-panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		padding: var(--spacing-md);
		text-align: left;
	}

	.vc-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.vc-speaker {
		flex: none;
	}

	.vc-name {
		color: var(--color-text);
	}

	.vc-live {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		color: var(--color-success);
	}

	.vc-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--color-success);
		animation: vc-pulse 2s ease-in-out infinite;
	}

	/* The screen share is up for about two thirds of its cycle, so the panel
	   spends part of every loop as a plain voice call. It and the "nobody is
	   sharing" line are the same slot, cross-faded, so the panel is exactly as
	   tall either way — a collapsing share would shove the page around twice a
	   minute. The window itself never resolves into anything readable: it stands
	   in for "someone is showing you their work", and a legible fake would only
	   invite people to read it. */
	.vc-stage {
		position: relative;
		height: 7.5rem;
		margin-top: var(--spacing-sm);
	}

	.vc-share {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		opacity: 0;
		animation: vc-share-presence 31s ease-in-out infinite;
	}

	.vc-idle {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.vc-share-chrome {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--color-border);
	}

	.vc-share-chrome i {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--color-border);
	}

	.vc-share-title {
		margin-left: 0.4rem;
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}

	.vc-share-body {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.7rem;
		height: 4.75rem;
	}

	.vc-line {
		height: 0.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-text) 14%, transparent);
		transform-origin: left;
		animation: vc-type 7s ease-in-out infinite;
	}

	.vc-line-1 {
		width: 62%;
	}

	.vc-line-2 {
		width: 84%;
		background: color-mix(in srgb, var(--color-primary) 30%, transparent);
		animation-delay: -1.2s;
	}

	.vc-line-3 {
		width: 47%;
		animation-delay: -2.6s;
	}

	.vc-line-4 {
		width: 71%;
		background: color-mix(in srgb, var(--color-secondary) 30%, transparent);
		animation-delay: -4.1s;
	}

	.vc-cursor {
		width: 0.45rem;
		height: 0.4rem;
		border-radius: 1px;
		background: var(--color-primary);
		animation: vc-blink 1.1s steps(2, end) infinite;
	}

	.vc-share-badge {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	/* Flex, not grid, so the seats close ranks when somebody leaves instead of
	   holding an empty cell where they were. min-height reserves both rows, so
	   the panel does not resize as the room fills and empties. */
	.vc-seats {
		/* One seat's width, shared with the collapse keyframe so an animating
		   seat is exactly as wide as a regular one. Narrower on phones (below),
		   so six seats still make two rows there instead of three — a third row
		   appearing and vanishing is what resized the panel as the room filled. */
		--vc-seat-w: 6.25rem;

		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-content: flex-start;
		row-gap: var(--spacing-sm);
		min-height: 9.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.vc-seat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		width: var(--vc-seat-w);
		margin-inline: 0.2rem;
		padding: 0.5rem 0;
		border-radius: var(--radius-md);
		background: var(--color-background);
		/* An inset shadow, not a border: it gives the tile an edge in the light
		   theme without adding width that the collapse keyframes would have to
		   animate away too. */
		box-shadow: inset 0 0 0 1px var(--color-border);
		opacity: 0;
		animation: vc-seat-presence var(--presence) ease-in-out infinite;
		animation-delay: var(--offset);
	}

	/* Regulars. No presence animation, so the channel is never empty however the
	   other four happen to line up. */
	.vc-regular {
		opacity: 1;
		animation: none;
	}

	/* A seat that is not in the room takes up no width, so the others slide
	   across to fill the gap the way Discord's own tiles do. */

	/* The avatar and its badges. Position lives here rather than on the seat, so
	   a badge hangs off the face at any avatar size — including the smaller one
	   phones get below. Identical to the live panel's. */
	.vc-person {
		position: relative;
		display: block;
		line-height: 0;
	}

	.vc-avatar {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-secondary) 22%, transparent);
		color: var(--color-secondary);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1;
		animation: vc-speak var(--speech) ease-out infinite;
		animation-delay: var(--speech-offset);
	}

	/* Muted seats read as muted at a glance, before anyone looks close enough to
	   find the badge: the avatar goes grey and loses its speaking ring. */
	.vc-muted {
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-secondary);
		animation: none;
	}

	/* One chip per state, on the avatar's lower edge, mic on the right where
	   Discord puts it. Each carries a ring of the tile's own background so it
	   separates from the face underneath rather than melting into it. The whole
	   block is the live panel's, verbatim — the two must not drift. */
	.vc-flag {
		position: absolute;
		bottom: -0.1rem;
		display: grid;
		place-items: center;
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 50%;
		box-shadow: 0 0 0 1.5px var(--color-background);
	}

	/* A solid chip with the tile's own background as the glyph, rather than a red
	   tint under a red glyph: at 15px a tinted chip left the mic as a smudge, and
	   the strokes need the full contrast the background token gives in either
	   theme. The fill is also what the slash's gap stroke paints with, so it has
	   to be one opaque colour. */
	.vc-flag-muted {
		right: -0.2rem;
		--vc-flag-fill: var(--color-danger);
		background: var(--vc-flag-fill);
		color: var(--color-background);
	}

	/* Left of the mic, and green rather than the brand coral: coral and the mic's
	   red are nearly the same colour in the light theme, so the two badges would
	   read as one alert state. Green is also what the header dot means here — on,
	   right now. Here it also fades in and out on its own cycle. */
	.vc-flag-video {
		left: -0.2rem;
		--vc-flag-fill: var(--color-success);
		background: var(--vc-flag-fill);
		color: var(--color-background);
		opacity: 0;
		animation: vc-camera var(--camera) ease-in-out infinite;
		animation-delay: var(--camera-offset);
	}

	/* The slash is drawn twice: once thick in the chip's own fill to cut a gap
	   through the mic beneath it, then once thin on top. Without the gap stroke
	   the two shapes merge into a blob at 10px. */
	.vc-slash-gap {
		stroke: var(--vc-flag-fill);
		stroke-width: 2.8;
		stroke-linecap: round;
	}

	.vc-slash {
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
	}

	.vc-handle {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	@keyframes vc-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@keyframes vc-blink {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	@keyframes vc-type {
		0%,
		20% {
			transform: scaleX(0.25);
			opacity: 0.55;
		}
		35%,
		70% {
			transform: scaleX(1);
			opacity: 1;
		}
		85%,
		100% {
			transform: scaleX(0.25);
			opacity: 0.55;
		}
	}

	/* The share sits ON TOP of the idle line and is opaque, so it covers it
	   rather than blending with it. Keep the fades short for the same reason —
	   a slow cross-fade shows both messages at once, which reads as a glitch. */
	@keyframes vc-share-presence {
		0%,
		12% {
			opacity: 0;
			transform: translateY(-4px);
		}
		16%,
		78% {
			opacity: 1;
			transform: none;
		}
		82%,
		100% {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	@keyframes vc-seat-presence {
		0% {
			opacity: 0;
			width: 0;
			margin-inline: 0;
			padding-inline: 0;
		}
		7%,
		70% {
			opacity: 1;
			width: var(--vc-seat-w);
			margin-inline: 0.2rem;
			padding-inline: 0;
		}
		77%,
		100% {
			opacity: 0;
			width: 0;
			margin-inline: 0;
			padding-inline: 0;
		}
	}

	/* The speaking ring: Discord's green halo, on for about a sixth of each
	   seat's cycle. */
	@keyframes vc-speak {
		0%,
		74% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 55%, transparent);
		}
		80%,
		94% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 55%, transparent);
		}
	}

	/* A camera that comes on for about a third of its cycle and goes off again.
	   Nobody in a lounge VC leaves it on all evening. */
	@keyframes vc-camera {
		0%,
		6% {
			opacity: 0;
			transform: scale(0.6);
		}
		12%,
		46% {
			opacity: 1;
			transform: none;
		}
		52%,
		100% {
			opacity: 0;
			transform: scale(0.6);
		}
	}

	@media (max-width: 480px) {
		.vc-avatar {
			width: 2rem;
			height: 2rem;
		}

		.vc-flag {
			width: 0.85rem;
			height: 0.85rem;
		}

		/* Narrower seats keep the room at two rows on a phone, so the panel is the
		   same height whether two people are in it or six — no third row that
		   appears and disappears and drags the box open. Still fits three across
		   down to the smallest phones. */
		.vc-seats {
			--vc-seat-w: 4.75rem;
		}
	}

	/* Frozen frame: the room full, the share up, nothing moving. */
	@media (prefers-reduced-motion: reduce) {
		.vc-share,
		.vc-seat,
		.vc-avatar,
		.vc-flag-video,
		.vc-line,
		.vc-cursor,
		.vc-dot {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
