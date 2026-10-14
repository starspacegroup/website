<script lang="ts">
	import { onMount } from 'svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { describeChannelUse, describeLobby } from '$lib/channel-activity';
	import { channelNote } from '$lib/channel-notes';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';
	import type { PageData } from './$types';

	export let data: PageData;

	const description =
		'Every channel in the *Space Discord, what it is for and how much it is used, and every command SpaceBot answers to. Read from the server itself, once a day.';

	/* The page is a reference, so the first job is getting to the one thing you
	   came for. The filters below are an enhancement on top of the full
	   server-rendered list: nothing is hidden until a script has run and a
	   person has typed or tapped, so a crawler, an agent and a reader with
	   JavaScript off all get every channel. */
	let ready = false;
	let query = '';
	type Kind = 'all' | 'text' | 'voice' | 'other';
	let kind: Kind = 'all';
	let active = 'channels';
	let navOffset = 64;

	const KINDS: { id: Kind; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'text', label: 'Text' },
		{ id: 'voice', label: 'Voice' },
		{ id: 'other', label: 'Other' }
	];

	const kindOf = (type: string): Exclude<Kind, 'all'> =>
		type === 'voice' || type === 'stage' ? 'voice' : type === 'text' ? 'text' : 'other';

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

	$: needle = query.trim().toLowerCase();
	$: filtering = needle !== '' || kind !== 'all';

	type Channel = (typeof directory.categories)[number]['channels'][number];
	/* The filters are parameters, not closed over: Svelte re-runs a `$:` line
	   only for the variables it names, so a helper that reads `needle` itself
	   would never be re-run when the search changed. */
	const channelMatches = (channel: Channel, text: string, only: Kind) => {
		if (only !== 'all' && kindOf(channel.type) !== only) return false;
		if (!text) return true;
		return [channel.name, channel.topic, channelNote(channel.name)]
			.filter(Boolean)
			.some((field) => String(field).toLowerCase().includes(text));
	};
	const commandMatches = (command: (typeof directory.commands)[number], text: string) =>
		!text ||
		`${command.name} ${command.description} ${command.options.join(' ')}`
			.toLowerCase()
			.includes(text);

	$: shownCategories = directory.categories
		.map((category) => ({
			...category,
			channels: category.channels.filter((channel) => channelMatches(channel, needle, kind))
		}))
		.filter((category) => category.channels.length);
	$: shownChannelCount = shownCategories.reduce((n, c) => n + c.channels.length, 0);
	/* A channel-type filter says nothing about commands, so it leaves them be. */
	$: shownBuiltIn =
		kind === 'all' ? builtIn.filter((command) => commandMatches(command, needle)) : builtIn;
	$: shownServerCommands =
		kind === 'all'
			? serverCommands.filter((command) => commandMatches(command, needle))
			: serverCommands;
	$: commandsHidden = kind !== 'all';

	const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const clear = () => {
		query = '';
		kind = 'all';
	};

	$: sections = [
		directory.categories.length && { id: 'channels', label: 'Channels' },
		directory.commands.length && { id: 'commands', label: 'Commands' },
		roomCommand && { id: 'rooms', label: 'Make a room' }
	].filter(Boolean) as { id: string; label: string }[];

	onMount(() => {
		ready = true;
		// The site's nav is sticky, and the toolbar sticks beneath it. Its height
		// changes with the breakpoint, so it is read rather than guessed.
		const nav = document.querySelector('nav');
		const measure = () => (navOffset = nav?.getBoundingClientRect().height ?? 64);
		measure();
		window.addEventListener('resize', measure, { passive: true });

		// Which section is on screen, for the toolbar to point at.
		const seen = new Map<string, boolean>();
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
				const first = sections.find((section) => seen.get(section.id));
				if (first) active = first.id;
			},
			{ rootMargin: '-30% 0px -55% 0px' }
		);
		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) io.observe(el);
		}

		return () => {
			io.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

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
	breadcrumb={[{ name: 'Server guide', path: '/guide' }]}
/>

<div class="page" style="--guide-nav-offset: {navOffset}px">
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
		<!-- One bar that stays with you: where you are, a way to jump, and a way to
		     narrow. The jump links are plain anchors and work without a script;
		     the search and the filters only appear once there is one to run them. -->
		<div class="toolbar">
			{#if sections.length > 1}
				<nav class="jump" aria-label="On this page">
					{#each sections as section (section.id)}
						<a
							href="#{section.id}"
							class:current={active === section.id}
							aria-current={active === section.id ? 'true' : undefined}>{section.label}</a
						>
					{/each}
				</nav>
			{/if}

			{#if ready}
				<div class="filters" role="search">
					<label class="search">
						<span class="visually-hidden">Search channels and commands</span>
						<input
							type="search"
							placeholder="Search channels and commands"
							autocomplete="off"
							bind:value={query}
						/>
					</label>
					{#if directory.categories.length}
						<div class="kinds" role="group" aria-label="Channel type">
							{#each KINDS as option (option.id)}
								<button
									type="button"
									class:on={kind === option.id}
									aria-pressed={kind === option.id}
									on:click={() => (kind = option.id)}>{option.label}</button
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if directory.categories.length}
			<section class="section" id="channels" aria-labelledby="channels-heading">
				<div class="section-head">
					<h2 id="channels-heading">Channels</h2>
					<p class="section-lede">
						{#if filtering}
							Showing {shownChannelCount} of {channelCount} channels.
							<button type="button" class="link" on:click={clear}>Clear filters</button>
						{:else}
							{channelCount} public channels, in the order they appear in Discord.
						{/if}
					</p>
					{#if !filtering}
						<details class="reading">
							<summary>How to read this</summary>
							<p>
								Descriptions are the channel topics, written by the people who run them. Discord
								gives a voice channel no topic, so for those this page says what the room is for.{#if directory.activityDays}
									The line underneath each one is what actually happened in it over the last {directory.activityDays}
									days — counts only, never who said what. Voice channels are drop-in rooms: nobody schedules
									them, so the useful thing to know is when people are usually in there.
								{/if}
							</p>
						</details>
					{/if}
				</div>

				{#if shownCategories.length > 1 && !filtering}
					<!-- Every category, one tap away. Only worth having once there are
					     enough of them to scroll past. -->
					<nav class="category-jump" aria-label="Channel categories">
						{#each directory.categories as category (category.name ?? 'uncategorised')}
							<a href="#cat-{slug(category.name ?? 'other')}">
								{category.name ?? 'Other'}
								<span class="count" aria-hidden="true">{category.channels.length}</span>
							</a>
						{/each}
					</nav>
				{/if}

				{#if shownCategories.length}
					<div class="categories">
						{#each shownCategories as category (category.name ?? 'uncategorised')}
							<section class="category" id="cat-{slug(category.name ?? 'other')}">
								<h3 class="category-name">{category.name ?? 'No category'}</h3>
								<ul class="channels">
									{#each category.channels as channel (channel.id)}
										<li class="channel">
											<p class="channel-name">
												<span class="channel-prefix" aria-hidden="true"
													>{PREFIX[channel.type] ?? '#'}</span
												>{channel.name}
												{#if channel.type !== 'text'}
													<span class="channel-type"
														>{TYPE_LABEL[channel.type] ?? channel.type}</span
													>
												{/if}
											</p>
											{#if channel.topic}
												<p class="channel-topic">{channel.topic}</p>
											{/if}
											{#if channelNote(channel.name)}
												<!-- Voice channels have no topic, so this site keeps its own
												     note on what each room is for. See channel-notes.ts. -->
												<p class="channel-topic">{channelNote(channel.name)}</p>
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
				{:else}
					<p class="empty" role="status">
						No channel matches “{query}”.
						<button type="button" class="link" on:click={clear}>Clear filters</button>
					</p>
				{/if}
			</section>
		{/if}

		{#if directory.commands.length}
			<section class="section" id="commands" aria-labelledby="commands-heading">
				<div class="section-head">
					<h2 id="commands-heading">Commands</h2>
					<p class="section-lede">
						Type these anywhere SpaceBot can see. Discord will autocomplete them once you type a
						slash.
					</p>
				</div>

				{#each [{ title: 'SpaceBot', commands: shownBuiltIn }, { title: 'Made for this server', commands: shownServerCommands }] as group (group.title)}
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

				{#if !commandsHidden && !shownBuiltIn.length && !shownServerCommands.length}
					<p class="empty" role="status">
						No command matches “{query}”.
						<button type="button" class="link" on:click={clear}>Clear search</button>
					</p>
				{/if}
			</section>
		{/if}

		{#if roomCommand}
			<!-- Only rendered when SpaceBot actually offers /room, so the
			     instructions cannot outlive the feature. -->
			<section class="section" id="rooms" aria-labelledby="rooms-heading">
				<div class="section-head">
					<h2 id="rooms-heading">Making your own room</h2>
					<p class="section-lede">
						The channels above are the permanent ones. You can also make a room of your own, which
						appears while you are using it and clears itself up afterwards.
					</p>
				</div>

				<ol class="steps">
					<li>
						<span>
							Type <code>/{roomCommand.name}</code> in any channel. {roomCommand.description}
						</span>
					</li>
					<li>
						<span>
							Pick what kind of room you want. Some servers also have a lobby voice channel — join
							it and a room is made for you without typing anything.
						</span>
					</li>
					<li>
						<span>
							It is yours while you are in it. Rename it, set who can join, and leave it alone when
							you are done — an empty room closes itself.
						</span>
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

	/* Columns rather than a grid: categories are very different heights, and a
	   grid leaves a hole under every short one. Columns pour them down the page
	   and the page fills as wide as the screen allows. */
	.categories {
		columns: 19rem;
		column-gap: var(--spacing-lg);
	}

	.category {
		break-inside: avoid;
		margin-bottom: var(--spacing-lg);
		scroll-margin-top: calc(var(--guide-nav-offset, 4rem) + 4.5rem);
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

	.channel + .channel {
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

	/* Each command is its own small card, so a long list reads as a grid of
	   things to try rather than a wall. */
	.commands {
		display: grid;
		gap: var(--spacing-md);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
		margin-bottom: var(--spacing-xl);
	}

	.command {
		padding: var(--spacing-md) var(--spacing-lg);
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

	/* Three steps side by side where there is room, stacked where there is not,
	   each with its number, so the order reads at a glance. */
	.steps {
		display: grid;
		gap: var(--spacing-md);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.steps li {
		counter-increment: step;
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.steps li::before {
		content: counter(step);
		flex: none;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
		font-weight: 800;
		font-size: 0.875rem;
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

	:global(html:has(.page)) {
		scroll-behavior: smooth;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html:has(.page)) {
			scroll-behavior: auto;
		}
	}

	.section {
		scroll-margin-top: calc(var(--guide-nav-offset, 4rem) + 4.5rem);
	}

	/* Stays under the site's nav for the whole page. The surface is opaque
	   enough that text passing beneath it never shows through. */
	.toolbar {
		position: sticky;
		top: var(--guide-nav-offset, 4rem);
		z-index: 40;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm) var(--spacing-lg);
		margin: 0 calc(var(--spacing-md) * -1) var(--spacing-xl);
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-background) 88%, transparent);
		backdrop-filter: blur(10px);
	}

	/* On a phone three rows of controls would eat a third of the screen, so
	   the bar stops sticking and the filters sit in one scrolling row. */
	@media (max-width: 639px) {
		.toolbar {
			position: static;
			backdrop-filter: none;
		}

		.filters {
			justify-content: flex-start;
		}

		.search {
			max-width: none;
		}

		.section,
		.category {
			scroll-margin-top: var(--spacing-md);
		}
	}

	.jump,
	.category-jump,
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.jump a,
	.category-jump a,
	.kinds button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast),
			border-color var(--transition-fast);
	}

	.jump a:hover,
	.category-jump a:hover,
	.kinds button:hover {
		border-color: var(--color-primary);
		color: var(--color-text);
	}

	.jump a.current,
	.kinds button.on {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
	}

	.category-jump {
		margin-bottom: var(--spacing-lg);
	}

	.count {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		flex: 1 1 22rem;
		justify-content: flex-end;
	}

	.search {
		flex: 1 1 14rem;
		max-width: 26rem;
	}

	.search input {
		width: 100%;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 0.9375rem;
	}

	.search input:focus-visible,
	.jump a:focus-visible,
	.category-jump a:focus-visible,
	.kinds button:focus-visible,
	.link:focus-visible,
	.reading summary:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.reading {
		margin-top: var(--spacing-sm);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-text-secondary);
	}

	.reading summary {
		width: fit-content;
		cursor: pointer;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	.reading p {
		margin: var(--spacing-sm) 0 0;
		line-height: 1.7;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-primary);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}

	.empty {
		padding: var(--spacing-xl);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		text-align: center;
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
