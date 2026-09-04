<script lang="ts">
	import TagPill from '$lib/components/TagPill.svelte';
	import type { Project } from '$lib/data/projects';

	export let project: Project;
	/** The first cards on screen are worth fetching eagerly; the rest are not. */
	export let eager = false;

	// One place decides how an off-site link behaves, so the title, the artwork
	// and the button can never disagree about it.
	$: target = project.external ? '_blank' : undefined;
	$: rel = project.external ? 'noopener noreferrer' : undefined;
</script>

<article class="card">
	{#if project.screenshot}
		<!-- The screenshot is the biggest target on the card, so it goes where the
		     title goes. Out of the tab order and the accessibility tree, because
		     the title already says the same thing. -->
		<a href={project.url} {target} {rel} tabindex="-1" aria-hidden="true" class="card-art">
			<img
				src={project.screenshot}
				alt=""
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="900"
				height="506"
			/>
		</a>
	{/if}

	<div class="card-body">
		<h3 class="card-title">
			{#if project.logo}
				<img
					class="card-logo"
					src={project.logo}
					alt=""
					loading="lazy"
					decoding="async"
					width="32"
					height="32"
				/>
			{/if}
			<a href={project.url} {target} {rel}>{project.name}</a>
		</h3>

		<!-- flex:1 pushes the tags and the button to the bottom edge, so buttons
		     line up across a row whatever the description length. -->
		<p class="card-description">{project.description}</p>

		<div class="card-tags">
			{#each project.tags as tag (tag.label)}
				<TagPill {tag} />
			{/each}
		</div>

		<a class="card-cta" href={project.url} {target} {rel}>
			Check it out
			{#if project.external}
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path
						d="M6 3h7v7M13 3L5 11M11 9v4H3V5h4"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</a>
	</div>
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		transition:
			transform var(--transition-base),
			border-color var(--transition-base),
			box-shadow var(--transition-base);
	}

	.card:hover {
		transform: translateY(-4px);
		border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
		box-shadow: var(--shadow-lg);
	}

	.card-art {
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--color-surface-hover);
	}

	.card-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top;
		transition: transform var(--transition-slow);
	}

	.card:hover .card-art img {
		transform: scale(1.03);
	}

	.card-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
	}

	.card-title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.card-title a {
		color: var(--color-text);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.card-title a:hover,
	.card-title a:focus-visible {
		color: var(--color-primary);
	}

	.card-logo {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		object-fit: contain;
	}

	.card-description {
		flex: 1;
		margin: 0;
		line-height: 1.65;
		color: var(--color-text-secondary);
	}

	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.card-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: flex-start;
		margin-top: var(--spacing-xs);
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-background);
		font-weight: 600;
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.card-cta:hover,
	.card-cta:focus-visible {
		background: var(--color-primary-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.card-art img {
			transition: none;
		}

		.card:hover {
			transform: none;
		}

		.card:hover .card-art img {
			transform: none;
		}
	}
</style>
