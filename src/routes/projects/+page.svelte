<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { communityProjects, projects, starspaceProjects } from '$lib/data/projects';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';

	const description =
		'Games, tools, music and marketplaces built by the people in the *Space Discord — most of them start as a message in a channel.';
</script>

<SharingMeta
	title="Projects"
	{description}
	image="/og-image.png"
	imageAlt={`${site.name} — projects built by the community`}
	imageWidth={1200}
	imageHeight={630}
	pageType="CollectionPage"
	breadcrumb={[{ name: 'Projects', path: '/projects' }]}
	items={projects.map((project) => ({
		name: project.name,
		url: project.url,
		description: project.description
	}))}
/>

<div class="page">
	<header class="page-header">
		<h1>Projects</h1>
		<p class="page-lede">{description}</p>
	</header>

	<!-- Two sections because they are two different claims: the first is
	     *Space's own work, the second is work *Space's people did elsewhere. -->
	<section class="group" aria-labelledby="starspace-heading">
		<div class="group-head">
			<h2 id="starspace-heading">Built by *Space</h2>
			<p class="group-lede">Our own projects, built and run in the open by the community.</p>
		</div>
		<div class="grid">
			{#each starspaceProjects as project, index (project.id)}
				<ProjectCard {project} eager={index < 3} />
			{/each}
		</div>
	</section>

	{#if communityProjects.length}
		<section class="group" aria-labelledby="community-heading">
			<div class="group-head">
				<h2 id="community-heading">From the community</h2>
				<p class="group-lede">
					Made by people in the *Space Discord, outside *Space itself — their projects, not ours,
					and worth a look.
				</p>
			</div>
			<div class="grid">
				{#each communityProjects as project (project.id)}
					<ProjectCard {project} />
				{/each}
			</div>
		</section>
	{/if}

	<aside class="page-cta">
		<h2>Want your project on this page?</h2>
		<p>
			Everything here started as someone saying what they were working on. Come say what you are
			working on.
		</p>
		<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
			Join on Discord
		</a>
	</aside>
</div>

<style>
	.page {
		/* `width: 100%` is load-bearing. The layout's <main> is a column flex
		   container, and an auto inline margin on a flex item overrides
		   `align-items: stretch` — without a width the box shrinks to its content
		   and the max-width never binds. */
		width: 100%;
		max-width: var(--layout-wide-max-width);
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

	.group + .group {
		margin-top: var(--spacing-2xl);
	}

	.group-head {
		max-width: 46rem;
		margin-bottom: var(--spacing-lg);
	}

	.group-head h2 {
		margin: 0 0 var(--spacing-xs);
		font-size: clamp(1.6rem, 3vw, 2.1rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.group-lede {
		margin: 0;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.grid {
		display: grid;
		gap: var(--spacing-lg);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
	}

	.page-cta {
		margin-top: var(--spacing-2xl);
		padding: var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		text-align: center;
	}

	.page-cta h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1.5rem;
	}

	.page-cta p {
		max-width: 34rem;
		margin: 0 auto var(--spacing-lg);
		color: var(--color-text-secondary);
	}

	.cta-button {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-background);
		font-weight: 600;
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.cta-button:hover,
	.cta-button:focus-visible {
		background: var(--color-primary-hover);
	}
</style>
