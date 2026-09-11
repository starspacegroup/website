<script lang="ts">
	import type { VoiceMember } from '$lib/server/voice-channel';

	/**
	 * Real people, from `/api/voice`. Only ever three or more, and only ever
	 * faces: the server sends no names, usernames or ids (see
	 * `$lib/server/voice-channel`). Someone who recognises a face knows who is in
	 * the room; the page does not publish a roster to everyone else.
	 */
	export let members: VoiceMember[] = [];
	/** The channel's own name, as Discord has it. */
	export let channel = 'Ten Forward';

	$: sharing = members.filter((member) => member.streaming).length;
	$: muted = members.filter((member) => member.muted).length;
	$: cameras = members.filter((member) => member.video).length;

	/**
	 * The panel is one `role="img"`, so nothing inside it reaches a screen reader
	 * on its own — the mic and camera badges have to be said here or not at all.
	 */
	$: label = [
		`${members.length} people are in the ${channel} voice channel right now.`,
		muted === 1 ? 'One of them is muted.' : muted > 1 ? `${muted} of them are muted.` : '',
		cameras === 1
			? 'One has their camera on.'
			: cameras > 1
				? `${cameras} have their cameras on.`
				: ''
	]
		.filter(Boolean)
		.join(' ');
</script>

<figure class="vc" role="img" aria-label={label}>
	<div class="vc-panel">
		<div class="vc-header">
			<svg
				class="vc-speaker"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden="true"
			>
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
			<span class="vc-name">{channel}</span>
			<span class="vc-live"><i class="vc-dot"></i>{members.length} in voice</span>
		</div>

		<ul class="vc-seats">
			<!-- Keyed by index on purpose. There is no id to key on, which is the
			     point, and the whole list is replaced on every poll anyway. -->
			{#each members as member, i (i)}
				<li class="vc-seat">
					<span class="vc-person">
						{#if member.avatar}
							<img
								class="vc-avatar"
								class:vc-dimmed={member.muted}
								src={member.avatar}
								alt=""
								width="40"
								height="40"
								loading="lazy"
								decoding="async"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<span class="vc-avatar vc-anon" class:vc-dimmed={member.muted} aria-hidden="true">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<circle cx="10" cy="7" r="3.4" fill="currentColor" />
									<path d="M3.6 17.2c0-3.2 2.9-5.2 6.4-5.2s6.4 2 6.4 5.2" fill="currentColor" />
								</svg>
							</span>
						{/if}

						<!-- Badges, not text. Both sit on the avatar's lower edge and are
						     absolutely positioned, so a person with neither flag, one flag
						     or both is exactly the same size and the row never reflows.
						     Only the ON states are drawn: an unmuted mic and a dark camera
						     are the normal case, and a tile of grey "no" icons says nothing
						     a visitor needs. -->
						{#if member.video}
							<span class="vc-flag vc-flag-video" aria-hidden="true">
								<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
									<rect x="1.4" y="4.4" width="9.4" height="7.2" rx="1.6" fill="currentColor" />
									<path d="M11.6 8.2l3-2v5.6l-3-2z" fill="currentColor" />
								</svg>
							</span>
						{/if}
						{#if member.muted}
							<span class="vc-flag vc-flag-muted" aria-hidden="true">
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
				</li>
			{/each}
		</ul>

		<p class="vc-status">
			{#if sharing === 1}
				somebody is sharing a screen
			{:else if sharing > 1}
				{sharing} people are sharing screens
			{:else}
				nobody is sharing a screen right now
			{/if}
		</p>
	</div>
	<figcaption class="vc-caption">#{channel}, right now. This is live.</figcaption>
</figure>

<style>
	/* Deliberately the same shapes and spacing as VoiceChannelDemo: the panel
	   swaps between simulated and live without the layout moving, and a visitor
	   who watches it change should see the people change, not the furniture. */
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

	/* Height is pinned to the simulated tile's, which carries a handle under its
	   avatar. Without it the panel would shrink the moment the channel went live
	   and grow back when it emptied, shoving the page around twice a minute. */
	.vc-seat {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 6.25rem;
		height: 4.625rem;
		margin-inline: 0.2rem;
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: inset 0 0 0 1px var(--color-border);
	}

	/* The avatar and its badges. Position lives here rather than on the seat, so
	   a badge hangs off the face at any avatar size — including the smaller one
	   phones get below. */
	.vc-person {
		position: relative;
		display: block;
		line-height: 0;
	}

	.vc-avatar {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-secondary) 22%, transparent);
		color: var(--color-secondary);
		object-fit: cover;
	}

	/* Somebody with no avatar set. A silhouette, not initials — initials are a
	   name in two letters, and the whole point is that the names stay off. */
	.vc-anon {
		color: color-mix(in srgb, var(--color-text) 45%, transparent);
	}

	/* A muted person also reads muted at a glance, before anyone looks close
	   enough to find the badge. Dimmed less than it used to be: the badge now
	   carries the meaning, so this only has to be a hint. */
	.vc-dimmed {
		opacity: 0.6;
	}

	/* One chip per state, on the avatar's lower edge, mic on the right where
	   Discord puts it. Each carries a ring of the tile's own background so it
	   separates from the face underneath rather than melting into it. */
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
	   right now. */
	.vc-flag-video {
		left: -0.2rem;
		--vc-flag-fill: var(--color-success);
		background: var(--vc-flag-fill);
		color: var(--color-background);
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

	/* Same box, same 7.5rem, as the simulated panel's screen-share slot. Discord
	   does not hand out the picture, so where the simulation shows a fake window
	   this shows a line of text — but it has to take up the same room, or the
	   whole page jumps 90px every time the channel crosses three people. */
	.vc-status {
		display: grid;
		place-items: center;
		height: 7.5rem;
		margin: var(--spacing-sm) 0 0;
		padding: 0.55rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-align: center;
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

	@media (prefers-reduced-motion: reduce) {
		.vc-dot {
			animation: none;
		}
	}

	@media (max-width: 480px) {
		.vc-avatar {
			width: 2.25rem;
			height: 2.25rem;
		}

		.vc-flag {
			width: 0.85rem;
			height: 0.85rem;
		}
	}
</style>
