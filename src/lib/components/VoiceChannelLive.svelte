<script lang="ts">
	import type { VoiceMember } from '$lib/server/voice-channel';

	/** Real people, from `/api/voice`. Only ever three or more — see the server module. */
	export let members: VoiceMember[] = [];
	/** The channel's own name, as Discord has it. */
	export let channel = 'Ten Forward';

	/** Two letters for someone with no avatar set, matching the simulated panel. */
	function initials(name: string): string {
		return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '??';
	}

	$: sharing = members.filter((member) => member.streaming);
</script>

<figure class="vc">
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
			{#each members as member (member.name)}
				<li class="vc-seat">
					{#if member.avatar}
						<img
							class="vc-avatar vc-photo"
							class:vc-muted={member.muted}
							src={member.avatar}
							alt=""
							width="36"
							height="36"
							loading="lazy"
							decoding="async"
							referrerpolicy="no-referrer"
						/>
					{:else}
						<span class="vc-avatar" class:vc-muted={member.muted}>{initials(member.name)}</span>
					{/if}
					<span class="vc-handle">{member.name}</span>
				</li>
			{/each}
		</ul>

		<p class="vc-status">
			{#if sharing.length === 1}
				{sharing[0].name} is sharing a screen
			{:else if sharing.length > 1}
				{sharing.length} people are sharing screens
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
		/* Real display names are long and arbitrary, unlike the demo's six short
		   handles, so the tile keeps a little side padding for the ellipsis to
		   land inside its own edge. */
		padding: 0.5rem 0.35rem;
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: inset 0 0 0 1px var(--color-border);
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
		object-fit: cover;
	}

	/* A muted person is dimmed rather than badged: at this size a mic glyph is
	   four pixels of nothing. */
	.vc-muted {
		opacity: 0.45;
	}

	.vc-handle {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vc-status {
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
			width: 2rem;
			height: 2rem;
		}
	}
</style>
