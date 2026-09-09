<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { describeChannelUse, describeLobby } from '$lib/channel-activity';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';
	import type { PageData } from './$types';

	export let data: PageData;

	const description =
		'Every channel in the *Space Discord, what it is for and how much it is used, and every command SpaceBot answers to. Read from the server itself, once a day.';

	$: directory = data.directory;
	$: builtIn = directory.commands.filter((command) => command.builtIn);
	$: serverCommands = directory.commands.filter((command) => !command.builtIn);
	$: channelCount = directory.categories.reduce(
		(total, category) => total + category.channels.length,
		0
	);
	/* The room command is what the "make your own" section is about. If SpaceBot
	   stops offering it, that section stops claiming it exists. */
	$: roomCommand = directory.commands.find((command) => command.name === 'room');

	/* Discord's own prefixes. A reader scanning the list should be able to tell a
	   room they can talk in from one they can sit in without reading the label. */
	const PREFIX: Record<string, string> = {
		text: '#',
		announcement: '#',
		forum: '#',
		media: '#',
		voice: '🔊',
		stage: '🎙'
	};

	const TYPE_LABEL: Record<string, string> = {
		text: 'Text',
		announcement: 'Announcements',
		forum: 'Forum',
		media: 'Media',
		voice: 'Voice',
		stage: 'Stage'
	};

	const formatDay = (value: string | null) => {
		if (!value) return null;
		const parsed = new Date(value.replace(' ', 'T'));
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	$: syncedOn = formatDay(directory.syncedAt);

	/* One clock for the whole render, so two channels that were last used at the
	   same moment cannot describe it differently. */
	const now = new Date();

	/* What actually happens in a channel, as a sentence. Voice and text answer
	   different questions — "when is anyone in here" against "is this read" — and
	   a forum answers neither, because its messages belong to its threads. */
	const usage = (channel: (typeof directory.categories)[number]['channels'][number]) =>
		describeChannelUse(channel, directory.activityDays, directory.timezone, now);
</script>

<SharingMeta
	title="Server guide"
	{description}
	image="/og-image.png"
	imageAlt={`${site.name} — the channels and commands`}
	imageWidth={1200}
	imageHeight={630}
/>

<div class="page">
	<header class="page-header">
		<h1>Server guide</h1>
		<p class="page-lede">{description}</p>
		{#if syncedOn}
			<p class="page-meta">Channels last read from the server on {syncedOn}.</p>
		{/if}
	</header>

	{#if !directory.available}
		<!-- SpaceBot could not be reached, or is not connected. The page says so
		     rather than rendering an empty shell, and never guesses at a channel
		     list — an out-of-date guide is worse than no guide. -->
		<div class="notice">
			<h2>The listing is not available right now</h2>
			<p>
				This page reads the channel list and the commands from the server itself, and it could not
				reach it just now. Nothing is missing from Discord — only from this page. Try again later,
				or go and look around the server.
			</p>
			<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				Open Discord
			</a>
		</div>
	{:else}
		{#if directory.categories.length}
			<section class="section" aria-labelledby="channels-heading">
				<div class="section-head">
					<h2 id="channels-heading">Channels</h2>
					<p class="section-lede">
						{channelCount} public channels, in the order they appear in Discord. Descriptions are the
						channel topics, written by the people who run them.{#if directory.activityDays}
							The line underneath each one is what actually happened in it over the last {directory.activityDays}
							days — counts only, never who said what. Voice channels are drop-in rooms: nobody schedules
							them, so the useful thing to know is when people are usually in there.
						{/if}
					</p>
				</div>

				<div class="categories">
					{#each directory.categories as category (category.name ?? 'uncategorised')}
						<section class="category">
							<h3 class="category-name">{category.name ?? 'No category'}</h3>
							<ul class="channels">
								{#each category.channels as channel (channel.id)}
									<li class="channel">
										<p class="channel-name">
											<span class="channel-prefix" aria-hidden="true"
												>{PREFIX[channel.type] ?? '#'}</span
											>{channel.name}
											<span class="channel-type">{TYPE_LABEL[channel.type] ?? channel.type}</span>
										</p>
										{#if channel.topic}
											<p class="channel-topic">{channel.topic}</p>
										{/if}
										{#if describeLobby(channel.activity)}
											<!-- The only voice channel whose purpose is a fact rather than a
											     pattern: SpaceBot builds a room when you join it. -->
											<p class="channel-purpose">{describeLobby(channel.activity)}</p>
										{/if}
										{#if usage(channel)}
											<p class="channel-activity">{usage(channel)}</p>
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					{/each}
				</div>
			</section>
		{/if}

		{#if directory.commands.length}
			<section class="section" aria-labelledby="commands-heading">
				<div class="section-head">
					<h2 id="commands-heading">Commands</h2>
					<p class="section-lede">
						Type these anywhere SpaceBot can see. Discord will autocomplete them once you type a
						slash.
					</p>
				</div>

				{#each [{ title: 'SpaceBot', commands: builtIn }, { title: 'Made for this server', commands: serverCommands }] as group (group.title)}
					{#if group.commands.length}
						<h3 class="command-group">{group.title}</h3>
						<ul class="commands">
							{#each group.commands as command (command.name)}
								<li class="command">
									<p class="command-name">
										<code>/{command.name}</code>
										{#each command.options as option (option)}
											<span class="command-option">{option}</span>
										{/each}
									</p>
									<p class="command-description">{command.description}</p>
								</li>
							{/each}
						</ul>
					{/if}
				{/each}
			</section>
		{/if}

		{#if roomCommand}
			<!-- Only rendered when SpaceBot actually offers /room, so the
			     instructions cannot outlive the feature. -->
			<section class="section" aria-labelledby="rooms-heading">
				<div class="section-head">
					<h2 id="rooms-heading">Making your own room</h2>
					<p class="section-lede">
						The channels above are the permanent ones. You can also make a room of your own, which
						appears while you are using it and clears itself up afterwards.
					</p>
				</div>

				<ol class="steps">
					<li>
						Type <code>/{roomCommand.name}</code> in any channel. {roomCommand.description}
					</li>
					<li>
						Pick what kind of room you want. Some servers also have a lobby voice channel — join it
						and a room is made for you without typing anything.
					</li>
					<li>
						It is yours while you are in it. Rename it, set who can join, and leave it alone when
						you are done — an empty room closes itself.
					</li>
				</ol>

				<p class="steps-note">
					Rooms people have made are deliberately not listed on this page. Who is sitting in what is
					their business, not a public directory.
				</p>
			</section>
		{/if}
	{/if}

	<aside class="page-cta">
		<h2>Come and use them</h2>
		<p>Reading about a coworking space is not the same as sitting in one.</p>
		<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
			Join on Discord
		</a>
	</aside>
</div>

<style>
	.page {
		max-width: var(--layout-feature-grid-max-width);
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

	.page-meta {
		margin: var(--spacing-sm) 0 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.section {
		margin-bottom: var(--spacing-2xl);
	}

	.section-head {
		max-width: 46rem;
		margin-bottom: var(--spacing-xl);
	}

	.section-head h2 {
		margin: 0 0 var(--spacing-xs);
		font-size: clamp(1.6rem, 3vw, 2.1rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.section-lede {
		margin: 0;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.categories {
		display: grid;
		gap: var(--spacing-lg);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
		align-items: start;
	}

	.category {
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.category-name {
		margin: 0 0 var(--spacing-md);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.channels,
	.commands {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.channel + .channel,
	.command + .command {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	.channel-name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
		margin: 0;
		font-weight: 600;
		color: var(--color-text);
	}

	.channel-prefix {
		color: var(--color-text-secondary);
	}

	.channel-type {
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.channel-topic {
		margin: 0.3rem 0 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	/* What the room is *for*, when that is a fact rather than a topic somebody
	   typed. Carries the accent so it does not read as more description. */
	.channel-purpose {
		margin: 0.35rem 0 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-primary);
	}

	/* The measured line. Quieter than the topic on purpose: it is context for
	   the channel, not a second description of it. */
	.channel-activity {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--color-text-secondary);
	}

	.command-group {
		margin: 0 0 var(--spacing-md);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.commands {
		margin-bottom: var(--spacing-xl);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.command-name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
	}

	.command-name code {
		font-family: var(--font-mono);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.command-option {
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.command-description {
		margin: 0.3rem 0 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.steps {
		max-width: 46rem;
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.steps li + li {
		margin-top: var(--spacing-sm);
	}

	.steps code {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-primary);
	}

	.steps-note {
		max-width: 46rem;
		margin: var(--spacing-md) 0 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.notice {
		max-width: 40rem;
		margin: 0 auto var(--spacing-2xl);
		padding: var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		text-align: center;
	}

	.notice h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1.3rem;
	}

	.notice p {
		margin: 0 0 var(--spacing-lg);
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.page-cta {
		margin-top: var(--spacing-2xl);
		padding: var(--spacing-xl);
		border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
		border-radius: var(--radius-xl);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 10%, var(--color-surface)),
			var(--color-surface)
		);
		text-align: center;
	}

	.page-cta h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1.5rem;
	}

	.page-cta p {
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text-secondary);
	}

	.cta-button {
		display: inline-flex;
		align-items: center;
		padding: 0.85rem 1.6rem;
		border-radius: var(--radius-md);
		background: #5865f2;
		color: #ffffff;
		font-weight: 600;
		text-decoration: none;
		transition: background var(--transition-fast);
	}

	.cta-button:hover,
	.cta-button:focus-visible {
		background: #4752c4;
	}
</style>
