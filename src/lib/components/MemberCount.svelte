<script lang="ts">
	import { dev } from '$app/environment';
	import { DEV_MEMBERS, DEV_ONLINE } from '$lib/dev-member-series';
	import { fetchGuildCounts } from '$lib/discord';
	import { fetchHumanMemberCount } from '$lib/member-stats';
	import { onMount } from 'svelte';

	/** Rendered above the number. */
	export let label = 'Members on Discord';

	// Dev short-circuit: the invite endpoint is rate limited per IP and a
	// hot-reloading dev server would hammer it. The figures live in
	// `$lib/dev-member-series` because the trend line under this one needs the
	// same ones — a graph that ends somewhere other than the number above it is
	// worse than no graph.

	let members: number | null = null;
	let online: number | null = null;
	let loading = true;
	let failed = false;

	onMount(() => {
		if (dev) {
			members = DEV_MEMBERS;
			online = DEV_ONLINE;
			loading = false;
			return;
		}

		// Two sources, because neither has the whole answer. SpaceBot knows how
		// many of the members are people rather than bots; Discord's invite
		// endpoint is the only one that knows who is online right now. Either can
		// be missing without taking the other down with it — the count only shows
		// a dash when both have nothing.
		void Promise.all([
			fetchGuildCounts().catch((error) => {
				console.error('Member count unavailable:', error);
				return null;
			}),
			fetchHumanMemberCount()
		])
			.then(([counts, humans]) => {
				members = humans ?? counts?.members ?? null;
				online = counts?.online ?? null;
				failed = members === null;
			})
			.finally(() => {
				loading = false;
			});
	});

	const format = (value: number) => value.toLocaleString('en-US');
</script>

<div class="member-count">
	<p class="member-label">{label}</p>
	<p class="member-number" aria-live="polite">
		{#if loading}
			<span class="member-loading" aria-label="Loading the member count"></span>
		{:else if failed || members === null}
			<span aria-hidden="true">&mdash;</span>
			<span class="sr-only">Member count unavailable right now</span>
		{:else}
			{format(members)}
		{/if}
	</p>
	<!-- Always in the flow, even while loading, so the copy under the count does
	     not drop a line when the presence figure arrives. -->
	<p class="member-online">
		{#if online !== null}
			<span class="online-dot" aria-hidden="true"></span>
			{format(online)} online now
		{/if}
	</p>
</div>

<style>
	/* Alignment is the caller's, because the home hero centres this on a phone
	   and left-aligns it beside the voice-channel panel on a wide screen. Custom
	   properties cross the component boundary; a `:global` reach-in would not. */
	.member-count {
		text-align: var(--member-count-align, center);
	}

	.member-label {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 400;
		letter-spacing: 0.02em;
		color: var(--color-text-secondary);
	}

	.member-number {
		margin: 0.25rem 0 0;
		/* The caller's, because the same number is the whole page on a phone and
		   one column of a hero on a desktop. The default is the phone's. */
		font-size: var(--member-number-size, clamp(3.5rem, 12vw, 6rem));
		font-weight: 200;
		line-height: 1.05;
		/* Proportional digits on purpose. Tabular figures give every digit the
		   width of a 0, which makes a display-size number look loose — and this
		   one loads once, it does not tick, so there is nothing to keep steady. */
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.member-online {
		display: flex;
		align-items: center;
		justify-content: var(--member-count-justify, center);
		gap: 0.5rem;
		min-height: 1.5rem;
		margin: 0.25rem 0 0;
		font-size: 1rem;
		color: var(--color-text-secondary);
	}

	.online-dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 0.5rem var(--color-success);
	}

	.member-loading {
		display: inline-block;
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: member-spin 900ms linear infinite;
	}

	@keyframes member-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.member-loading {
			animation-duration: 3s;
		}
	}
</style>
