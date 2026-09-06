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
	};

	const seats: Seat[] = [
		{ name: 'nova', presence: null, offset: 0, speech: 9, speechOffset: -1 },
		{ name: 'quill', presence: null, offset: 0, speech: 13, speechOffset: -7 },
		{ name: 'bramble', presence: 23, offset: -4, speech: null, speechOffset: 0 },
		{ name: 'orbit', presence: 19, offset: -13, speech: 11, speechOffset: -4 },
		{ name: 'moss', presence: 29, offset: -21, speech: null, speechOffset: 0 },
		{ name: 'kestrel', presence: 17, offset: -9, speech: 17, speechOffset: -12 }
	];
</script>

<figure
	class="vc"
	role="img"
	aria-label="A simulated view of the Ten Forward voice channel: members joining and leaving, one of them sharing their screen."
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
					<span
						class="vc-avatar"
						class:vc-muted={seat.speech === null}
						style="--speech: {seat.speech ?? 0}s; --speech-offset: {seat.speechOffset}s;"
						>{seat.name.slice(0, 2)}</span
					>
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
	<figcaption class="vc-caption">#Ten Forward, most afternoons.</figcaption>
</figure>

<style>
	.vc {
		width: 100%;
		max-width: 26rem;
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
		width: 6.25rem;
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
		animation: vc-speak var(--speech) ease-out infinite;
		animation-delay: var(--speech-offset);
	}

	/* Muted seats read as muted at a glance: the avatar goes grey and loses its
	   speaking ring, rather than carrying a mic glyph nobody can see this small. */
	.vc-muted {
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-secondary);
		animation: none;
	}

	.vc-handle {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.vc-caption {
		margin-top: var(--spacing-sm);
		font-size: 0.8rem;
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
			width: 6.25rem;
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

	@media (max-width: 480px) {
		.vc-avatar {
			width: 2rem;
			height: 2rem;
		}
	}

	/* Frozen frame: the room full, the share up, nothing moving. */
	@media (prefers-reduced-motion: reduce) {
		.vc-share,
		.vc-seat,
		.vc-avatar,
		.vc-line,
		.vc-cursor,
		.vc-dot {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
