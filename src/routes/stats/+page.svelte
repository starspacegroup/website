<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { formatDuration, formatWhen, whenClause } from '$lib/channel-activity';
	import { DISCORD_INVITE } from '$lib/discord';
	import {
		describeWindow,
		formatAhead,
		formatCount,
		formatNetChange,
		formatStanding,
		plural,
		recentDays,
		sparklinePath,
		totalGuildDays
	} from '$lib/stats-copy';
	import { site } from '$lib/site.config';
	import type { PageData } from './$types';

	export let data: PageData;

	const description =
		'How busy the *Space Discord actually is — members, messages and time spent in voice, read from the server itself. Sign in with Discord to see your own figures alongside it.';

	/* One clock for the whole render, so two figures measured at the same moment
	   cannot describe it differently. */
	const now = new Date();

	$: stats = data.stats;
	$: profile = data.profile;
	$: snapshot = stats.snapshot;

	/* The graph window is 30 days where there are 30, and everything there is
	   otherwise — a server SpaceBot has watched for eleven days should show
	   eleven, not a mostly-empty axis. */
	$: window30 = recentDays(stats.days, 30);
	$: totals = totalGuildDays(window30);
	$: windowLabel = describeWindow(window30);

	$: messageLine = sparklinePath(
		window30.map((day) => day.messages),
		100,
		28
	);
	$: memberLine = sparklinePath(
		window30.map((day) => day.netChange),
		100,
		28
	);

	$: voiceTotal = formatDuration(totals.voiceSeconds);
	$: netChange = formatNetChange(totals.netChange);

	/* The personal panel only renders for somebody SpaceBot confirms is in the
	   server right now. Everything else — not signed in, no Discord linked,
	   signed in but not a member, SpaceBot unreachable — lands on one of the
	   invitations below it. */
	$: showsProfile = profile.available && profile.member;

	$: myVoice = formatDuration(profile.activity.voiceSeconds);
	$: myVoiceEver = formatDuration(profile.recorded.voiceSeconds);
	$: myMessageStanding = formatStanding(
		profile.standing.messageRank,
		profile.standing.messagePopulation
	);
	$: myMessageAhead = formatAhead(profile.standing.messageRank, profile.standing.messagePopulation);
	$: myVoiceStanding = formatStanding(profile.standing.voiceRank, profile.standing.voicePopulation);
	$: myLastMessage = formatWhen(profile.activity.lastMessageAt, now);
	$: myLastVoice = formatWhen(profile.activity.lastVoiceAt, now);
	$: joinedOn = profile.joinedAt ? formatJoined(profile.joinedAt) : null;

	/* SpaceBot hands back SQLite's zoneless "2026-01-04 12:00:00". Reading it as
	   UTC matches how it was written; anything unparseable prints nothing rather
	   than "Invalid Date". */
	function formatJoined(value: string): string | null {
		const normalized = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
			? `${value.replace(' ', 'T')}Z`
			: value;
		const at = new Date(normalized);
		if (Number.isNaN(at.getTime())) return null;
		return at.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<SharingMeta
	title="Server stats"
	{description}
	image="/og-image.png"
	imageAlt={`${site.name} — how busy the server is`}
	imageWidth={1200}
	imageHeight={630}
	breadcrumb={[{ name: 'Server stats', path: '/stats' }]}
/>

<div class="page">
	<header class="page-header">
		<h1>Server stats</h1>
		<p class="page-lede">{description}</p>
	</header>

	{#if showsProfile}
		<!-- The reason somebody signed in. It goes first: a member opening this
		     page came to see their own line, not the server's. -->
		<section class="section" aria-labelledby="you-heading">
			<div class="section-head">
				<h2 id="you-heading">You, in the last {profile.days} days</h2>
				<p class="section-lede">
					Counts only, from the same records the figures below come from. Nobody else can see this
					panel, and this site is never told what you said — only how often.{#if profile.unrecordedChannels}
						{' '}{plural(profile.unrecordedChannels, 'channel')} in the server {profile.unrecordedChannels ===
						1
							? 'is'
							: 'are'} not logged at all, so nothing you post there is counted here.
					{/if}
				</p>
			</div>

			<div class="tiles">
				<div class="tile">
					<p class="tile-figure">{formatCount(profile.activity.messages)}</p>
					<p class="tile-label">messages</p>
					{#if myMessageStanding}
						<p class="tile-note">
							{myMessageStanding} who posted{#if myMessageAhead}, {myMessageAhead}{/if}
						</p>
					{/if}
					{#if myLastMessage}
						<p class="tile-note">Last one {whenClause(myLastMessage)}.</p>
					{/if}
				</div>

				<div class="tile">
					<p class="tile-figure">{myVoice ?? '—'}</p>
					<p class="tile-label">in voice</p>
					{#if profile.activity.voiceSessions}
						<p class="tile-note">
							Across {plural(profile.activity.voiceSessions, 'visit')} to {plural(
								profile.activity.voiceChannels,
								'room'
							)}.
						</p>
					{/if}
					{#if myVoiceStanding}
						<p class="tile-note">{myVoiceStanding} who turned up.</p>
					{/if}
					{#if myLastVoice}
						<p class="tile-note">Last there {whenClause(myLastVoice)}.</p>
					{/if}
				</div>

				<div class="tile">
					<p class="tile-figure">{formatCount(profile.activity.channels)}</p>
					<p class="tile-label">channels posted in</p>
					{#if profile.activity.commands}
						<p class="tile-note">{plural(profile.activity.commands, 'command')} run.</p>
					{/if}
				</div>
			</div>

			<p class="section-note">
				{#if joinedOn}You joined on {joinedOn}.{/if}
				{#if profile.recorded.messages > profile.activity.messages}
					Over everything still on record — {profile.retentionDays} days, which is as far back as the
					server keeps raw events — {plural(profile.recorded.messages, 'message')}{#if myVoiceEver},
						and {myVoiceEver} in voice{/if}.
				{/if}
			</p>
		</section>
	{/if}

	{#if !stats.available}
		<!-- SpaceBot could not be reached, or is not connected. Say so rather than
		     rendering a wall of zeroes: a zero on a stats page is a claim. -->
		<div class="notice">
			<h2>The figures are not available right now</h2>
			<p>
				This page reads the numbers from the server itself, and it could not reach it just now.
				Nothing is wrong in Discord — only on this page. Try again later, or go and look for
				yourself.
			</p>
			<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				Open Discord
			</a>
		</div>
	{:else}
		{#if snapshot}
			<section class="section" aria-labelledby="now-heading">
				<div class="section-head">
					<h2 id="now-heading">The server right now</h2>
					<p class="section-lede">
						From the most recent snapshot{#if snapshot.recordedAt && formatWhen(snapshot.recordedAt, now)},
							taken {whenClause(formatWhen(snapshot.recordedAt, now) ?? '')}{/if}.
					</p>
				</div>

				<div class="tiles">
					<div class="tile">
						<p class="tile-figure">{formatCount(snapshot.humans ?? snapshot.members)}</p>
						<p class="tile-label">{snapshot.humans === null ? 'members' : 'people'}</p>
						{#if snapshot.online !== null}
							<p class="tile-note">{formatCount(snapshot.online)} online.</p>
						{/if}
						{#if snapshot.humans !== null && snapshot.bots}
							<p class="tile-note">{plural(snapshot.bots, 'bot')} alongside them.</p>
						{/if}
					</div>

					{#if snapshot.channels !== null}
						<div class="tile">
							<p class="tile-figure">{formatCount(snapshot.channels)}</p>
							<p class="tile-label">channels</p>
							<p class="tile-note"><a href="/guide">What each one is for →</a></p>
						</div>
					{/if}

					{#if snapshot.boosts}
						<div class="tile">
							<p class="tile-figure">{formatCount(snapshot.boosts)}</p>
							<p class="tile-label">boosts</p>
							{#if snapshot.boostLevel}
								<p class="tile-note">Level {snapshot.boostLevel}.</p>
							{/if}
						</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if window30.length}
			<section class="section" aria-labelledby="window-heading">
				<div class="section-head">
					<h2 id="window-heading">
						{windowLabel ? windowLabel.charAt(0).toUpperCase() + windowLabel.slice(1) : 'Lately'}
					</h2>
					<p class="section-lede">
						Rolled up one day at a time. Counts only — this site is never sent a message, a name or
						who was in which room.
					</p>
				</div>

				<div class="tiles">
					<div class="tile">
						<p class="tile-figure">{formatCount(totals.messages)}</p>
						<p class="tile-label">messages</p>
						{#if messageLine}
							<svg
								class="spark"
								viewBox="0 0 100 28"
								preserveAspectRatio="none"
								role="img"
								aria-label={`Messages per day over ${totals.days} days, busiest day ${totals.busiestDayMessages}`}
							>
								<polyline points={messageLine} />
							</svg>
						{/if}
						{#if totals.busiestDayMessages}
							<p class="tile-note">
								{formatCount(totals.busiestDayMessages)} on the busiest day.
							</p>
						{/if}
					</div>

					<div class="tile">
						<p class="tile-figure">{voiceTotal ?? '—'}</p>
						<p class="tile-label">spent in voice</p>
						{#if totals.voicePeak}
							<p class="tile-note">
								{plural(totals.voicePeak, 'person', 'people')} at once, at the peak.
							</p>
						{/if}
					</div>

					<div class="tile">
						<p class="tile-figure">{netChange ?? 'Level'}</p>
						<p class="tile-label">{netChange ? 'members, net' : 'membership'}</p>
						{#if memberLine}
							<svg
								class="spark"
								viewBox="0 0 100 28"
								preserveAspectRatio="none"
								role="img"
								aria-label={`Net members gained per day over ${totals.days} days`}
							>
								<polyline points={memberLine} />
							</svg>
						{/if}
						<p class="tile-note">
							{plural(totals.joins, 'person', 'people')} joined, {formatCount(totals.leaves)} left.
						</p>
					</div>
				</div>
			</section>
		{/if}
	{/if}

	{#if !showsProfile}
		<aside class="page-cta">
			{#if !data.signedIn}
				<h2>See your own figures</h2>
				<p>
					Sign in with Discord and this page shows what you have done here alongside everything
					above — messages, time in voice, and where that puts you. Only you can see it.
				</p>
				<a class="cta-button" href="/api/auth/discord">Sign in with Discord</a>
				<p class="cta-note">
					No account needed beyond the Discord one you already have. If you are not in the server
					yet, <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">come in</a> first.
				</p>
			{:else if !data.discordLinked}
				<h2>Connect your Discord account</h2>
				<p>
					You are signed in, but this site does not know which Discord account is yours. Link it and
					your own figures appear here.
				</p>
				<a class="cta-button" href="/api/auth/discord?mode=link">Connect Discord</a>
			{:else if profile.available && !profile.member}
				<h2>You are not in the server yet</h2>
				<p>
					Your Discord account is connected, and it is not a member of {site.name}. Join and your
					own figures start appearing here.
				</p>
				<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
					Join on Discord
				</a>
			{:else}
				<h2>Your own figures are not available</h2>
				<p>
					Your Discord account is connected, but the server could not be asked about it just now.
					The figures above are unaffected.
				</p>
				<a class="cta-button" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
					Open Discord
				</a>
			{/if}
		</aside>
	{/if}
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

	.section-note {
		max-width: 46rem;
		margin: var(--spacing-lg) 0 0;
		line-height: 1.7;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.tiles {
		display: grid;
		gap: var(--spacing-lg);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		align-items: start;
	}

	.tile {
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.tile-figure {
		margin: 0;
		font-size: clamp(1.9rem, 4vw, 2.6rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	.tile-label {
		margin: var(--spacing-xs) 0 0;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.tile-note {
		margin: var(--spacing-sm) 0 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.tile-note a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.tile-note a:hover,
	.tile-note a:focus-visible {
		text-decoration: underline;
	}

	/* The line is decoration over a number that is already stated — it carries a
	   label for a screen reader and no axis, because an axis it cannot fit is
	   worse than none. */
	.spark {
		display: block;
		width: 100%;
		height: 1.75rem;
		margin-top: var(--spacing-md);
		overflow: visible;
	}

	.spark polyline {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.notice,
	.page-cta {
		max-width: 40rem;
		margin: 0 auto var(--spacing-2xl);
		padding: var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		text-align: center;
	}

	.page-cta {
		margin-bottom: 0;
	}

	.notice h2,
	.page-cta h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1.3rem;
	}

	.notice p,
	.page-cta p {
		margin: 0 0 var(--spacing-lg);
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.cta-note {
		margin: var(--spacing-md) 0 0;
		font-size: 0.9375rem;
	}

	.cta-note a {
		color: var(--color-primary);
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
