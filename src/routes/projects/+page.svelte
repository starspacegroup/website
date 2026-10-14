<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { communityProjects, projects, starspaceProjects } from '$lib/data/projects';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	$: submit = data.submit;
	$: values = form?.values ?? { name: '', url: '', description: '', notes: '' };

	const statusLabel = {
		pending: 'Waiting for a look',
		approved: 'Approved',
		rejected: 'Not this one'
	};

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

	<!-- One box, five visitors. The directory above is the same for everyone;
	     this is the one part of the page that knows who is reading it. The form
	     only opens for a signed-in Discord account SpaceBot confirms is in the
	     server, and the action checks that again on the post. -->
	<aside class="page-cta" aria-labelledby="submit-heading">
		{#if submit.state === 'member'}
			<h2 id="submit-heading">Add your project to this page</h2>
			<p>
				You are in the server, so you can put a project forward from here. Someone will take a look
				and add it to the list — it does not appear by itself.
			</p>

			{#if form?.success}
				<div class="banner banner-success" role="status">{form.message}</div>
			{:else if form?.error}
				<div class="banner banner-error" role="alert">{form.error}</div>
			{/if}

			{#if submit.atLimit && !form?.success}
				<p class="cta-note">
					You have {submit.pendingLimit} waiting for review already. Once one is looked at, you can send
					another.
				</p>
			{:else if !form?.success}
				<form method="POST" action="?/submit" class="submit-form">
					<label class="field">
						<span>Project name</span>
						<input type="text" name="name" maxlength="60" required value={values.name} />
					</label>
					<label class="field">
						<span>Link</span>
						<input
							type="url"
							name="url"
							inputmode="url"
							placeholder="https://"
							required
							value={values.url}
						/>
					</label>
					<label class="field">
						<span>What is it?</span>
						<textarea name="description" rows="4" minlength="20" maxlength="400" required
							>{values.description}</textarea
						>
						<small>One or two sentences, the way the cards above read. Up to 400 characters.</small>
					</label>
					<label class="field">
						<span>Anything for the reviewer? <em>optional</em></span>
						<textarea name="notes" rows="2" maxlength="1000">{values.notes}</textarea>
					</label>
					<button type="submit" class="cta-button">Send it in</button>
				</form>
			{/if}

			{#if submit.submissions.length}
				<section class="mine" aria-labelledby="mine-heading">
					<h3 id="mine-heading">Your submissions</h3>
					<ul>
						{#each submit.submissions as s (s.id)}
							<li>
								<span class="mine-name">{s.name}</span>
								<span class="status status-{s.status}">{statusLabel[s.status]}</span>
								{#if s.reviewNote}
									<span class="mine-note">{s.reviewNote}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{:else if submit.state === 'signed-out'}
			<h2 id="submit-heading">Want your project on this page?</h2>
			<p>
				Everything here started as someone saying what they were working on. If you are in the
				Discord server, sign in with Discord and you can add yours from right here.
			</p>
			<a class="cta-button" href="/api/auth/discord">Sign in with Discord</a>
			<p class="cta-note">
				Not in the server yet?
				<a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Come in</a> first — that is
				where the projects come from.
			</p>
		{:else if submit.state === 'unlinked'}
			<h2 id="submit-heading">Connect your Discord account</h2>
			<p>
				You are signed in, but this site does not know which Discord account is yours. Link it, and
				if you are in the server you can add a project from here.
			</p>
			<a class="cta-button" href="/api/auth/discord?mode=link">Connect Discord</a>
		{:else if submit.state === 'not-member'}
			<h2 id="submit-heading">Want your project on this page?</h2>
			<p>
				Your Discord account is connected, and it is not in the {site.name} server. Projects here come
				from people in the room — join, and this box turns into a form.
			</p>
			<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				Join on Discord
			</a>
		{:else}
			<h2 id="submit-heading">Want your project on this page?</h2>
			<p>
				Members can add a project from here, but the server could not be asked whether you are one
				just now. Try again in a minute, or just say what you are working on in Discord.
			</p>
			<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				Open Discord
			</a>
		{/if}
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

	.cta-note {
		margin-top: var(--spacing-md);
		font-size: 0.9rem;
	}

	.cta-note a {
		color: var(--color-primary);
	}

	.banner {
		max-width: 34rem;
		margin: 0 auto var(--spacing-lg);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.95rem;
	}

	.banner-success {
		background: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.banner-error {
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}

	.submit-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		max-width: 34rem;
		margin: 0 auto;
		text-align: left;
	}

	.submit-form .cta-button {
		align-self: center;
		border: 0;
		cursor: pointer;
		font-size: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.field > span {
		font-weight: 600;
		color: var(--color-text);
	}

	.field em {
		font-weight: 400;
		font-style: normal;
		color: var(--color-text-secondary);
	}

	.field small {
		color: var(--color-text-secondary);
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}

	.field input:focus-visible,
	.field textarea:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.mine {
		max-width: 34rem;
		margin: var(--spacing-xl) auto 0;
		text-align: left;
	}

	.mine h3 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1rem;
		color: var(--color-text-secondary);
	}

	.mine ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.mine li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) 0;
		border-top: 1px solid var(--color-border);
	}

	.mine-name {
		font-weight: 600;
	}

	.mine-note {
		flex-basis: 100%;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.status {
		font-size: 0.8rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.status-approved {
		color: var(--color-success);
		border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
	}

	.status-rejected {
		color: var(--color-error);
		border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
	}
</style>
