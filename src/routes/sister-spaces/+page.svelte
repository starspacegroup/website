<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import TagPill from '$lib/components/TagPill.svelte';
	import { sisterSpaces } from '$lib/data/sister-spaces';
	import { site } from '$lib/site.config';

	const description =
		'*Space lives on Discord, but making things is physical too. These are the workshops and makerspaces we are allied with — real rooms, real machines, open doors.';
</script>

<SharingMeta
	title="Sister Spaces"
	{description}
	image="/og-image.png"
	imageAlt={`${site.name} — allied makerspaces`}
	imageWidth={1200}
	imageHeight={630}
/>

<div class="page">
	<header class="page-header">
		<h1>Sister Spaces</h1>
		<p class="page-lede">{description}</p>
	</header>

	<div class="spaces">
		{#each sisterSpaces as space (space.id)}
			<article class="space">
				{#if space.image}
					<img
						class="space-photo"
						src={space.image}
						alt=""
						loading="lazy"
						decoding="async"
						width="900"
						height="600"
					/>
				{/if}

				<div class="space-body">
					<h2 class="space-name">
						<a href={space.url} target="_blank" rel="noopener noreferrer">{space.name}</a>
					</h2>

					<dl class="space-facts">
						<dt><span class="visually-hidden">Website</span></dt>
						<dd>
							<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6" />
								<path
									d="M2 10h16M10 2c2.5 2.5 2.5 13 0 16M10 2C7.5 4.5 7.5 15.5 10 18"
									stroke="currentColor"
									stroke-width="1.6"
								/>
							</svg>
							<a href={space.url} target="_blank" rel="noopener noreferrer">{space.url}</a>
						</dd>

						<dt><span class="visually-hidden">Address</span></dt>
						<dd>
							<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
								<path
									d="M10 18s6-5.2 6-9.4A6 6 0 0 0 4 8.6C4 12.8 10 18 10 18z"
									stroke="currentColor"
									stroke-width="1.6"
									stroke-linejoin="round"
								/>
								<circle cx="10" cy="8.5" r="2.2" stroke="currentColor" stroke-width="1.6" />
							</svg>
							<a href={space.mapUrl} target="_blank" rel="noopener noreferrer">{space.address}</a>
						</dd>
					</dl>

					<p class="space-description">{space.description}</p>

					<div class="space-tags">
						{#each space.tags as tag (tag.label)}
							<TagPill {tag} />
						{/each}
					</div>
				</div>
			</article>
		{/each}
	</div>
</div>

<style>
	.page {
		max-width: 68rem;
		margin: 0 auto;
		padding: var(--spacing-2xl) var(--spacing-md);
	}

	.page-header {
		max-width: 46rem;
		margin: 0 auto var(--spacing-2xl);
		text-align: center;
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-sm);
		font-size: clamp(2.25rem, 6vw, 3.25rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.page-lede {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.spaces {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	.space {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	.space-photo {
		width: 100%;
		height: 16rem;
		object-fit: cover;
	}

	.space-body {
		padding: var(--spacing-xl);
	}

	.space-name {
		margin: 0 0 var(--spacing-md);
		font-size: clamp(1.6rem, 4vw, 2.1rem);
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.space-name a {
		color: var(--color-text);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.space-name a:hover,
	.space-name a:focus-visible {
		color: var(--color-primary);
	}

	.space-facts {
		margin: 0 0 var(--spacing-lg);
	}

	.space-facts dd {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 0 0.4rem;
		color: var(--color-text-secondary);
	}

	.space-facts dd svg {
		flex-shrink: 0;
	}

	.space-facts a {
		color: var(--color-primary);
		overflow-wrap: anywhere;
	}

	.space-description {
		margin: 0 0 var(--spacing-lg);
		line-height: 1.75;
		color: var(--color-text-secondary);
	}

	.space-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@media (min-width: 48rem) {
		.space {
			flex-direction: row-reverse;
		}

		.space-photo {
			width: 18rem;
			height: auto;
			flex-shrink: 0;
		}
	}
</style>
