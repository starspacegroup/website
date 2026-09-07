<script lang="ts">
	import { page } from '$app/stores';
	import MemberCount from '$lib/components/MemberCount.svelte';
	import HeroSky from '$lib/components/HeroSky.svelte';
	import MemberTrend from '$lib/components/MemberTrend.svelte';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import VoiceChannel from '$lib/components/VoiceChannel.svelte';
	import { featuredProjects } from '$lib/data/projects';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';
	import { onMount } from 'svelte';

	let toastMessage = '';
	let showToast = false;

	// Error message mapping
	const errorMessages: Record<string, string> = {
		forbidden: 'You do not have permission to access that page.',
		unauthorized: 'Please log in to access that page.',
		oauth_failed: 'Authentication failed. Please try again.'
	};

	onMount(() => {
		// Check for error in URL and show toast
		const errorCode = $page.url.searchParams.get('error');
		if (errorCode && errorMessages[errorCode]) {
			toastMessage = errorMessages[errorCode];
			showToast = true;

			// Clear the error from URL
			const url = new URL(window.location.href);
			url.searchParams.delete('error');
			window.history.replaceState({}, '', url);

			// Auto-hide toast after 5 seconds
			setTimeout(() => {
				showToast = false;
			}, 5000);
		}
	});

	function dismissToast() {
		showToast = false;
	}
</script>

<SharingMeta
	title={site.name}
	description={site.description}
	image="/og-image.png"
	imageAlt={`${site.name} — ${site.tagline}`}
	imageWidth={1200}
	imageHeight={630}
/>

<section class="hero">
	<HeroSky />
	<div class="container hero-container">
		<div class="hero-content">
			<div class="hero-copy">
				<!-- Mark and words are one lockup on a wide screen and a stack on a
				     phone. The glow is the wrapper's own ::before, so it stays behind
				     the star either way — the share card puts its nebula there too. -->
				<div class="hero-lockup">
					<div class="hero-mark-wrap">
						<img
							class="hero-mark"
							src="/brand/starspace-mark.webp"
							alt=""
							width="160"
							height="160"
							decoding="async"
							fetchpriority="high"
						/>
					</div>

					<div class="hero-heading">
						<h1 class="main-title">{site.name}</h1>
						<p class="hero-tagline">Work, create and collaborate — with chaos and fun.</p>
					</div>
				</div>

				<p class="subtitle">
					An inclusive digital coworking space on Discord, where everyone is welcome. Work around
					makers, creators, artists and trailblazers who are creativity and productivity driven.
				</p>

				<div class="hero-actions">
					<a class="hero-join" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path
								d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5c1.6.4 3 1 4.4 1.9a16.6 16.6 0 0 0-14.9 0c1.3-.9 2.8-1.6 4.4-1.9L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.9 8.6.1 12.7.5 16.7A19.9 19.9 0 0 0 6.6 20l1.3-2c-1-.4-2-.9-2.9-1.6l.7-.5a14.2 14.2 0 0 0 12.6 0l.7.5c-.9.7-1.9 1.2-2.9 1.6l1.3 2a19.9 19.9 0 0 0 6.1-3.3c.5-4.7-.8-8.8-3.2-12.3zM8.5 14.3c-1.2 0-2.2-1.1-2.2-2.4 0-1.4 1-2.5 2.2-2.5s2.2 1.1 2.2 2.5c0 1.3-1 2.4-2.2 2.4zm7 0c-1.2 0-2.2-1.1-2.2-2.4 0-1.4 1-2.5 2.2-2.5s2.2 1.1 2.2 2.5c0 1.3-1 2.4-2.2 2.4z"
							/>
						</svg>
						Join on Discord
					</a>
					<a class="hero-secondary" href="/projects">See what we build</a>
				</div>
			</div>

			<!-- Everything live about the server, in one column: how many people are
			     here, the month behind that number, and the room itself. Grouping the
			     proof together leaves the left column as identity, promise and ask,
			     and it gives the right column the height to stand beside them.

			     It sits after the buttons in the source, which is also where it lands
			     on a phone: the ask reaches the first screen, and the proof is the
			     first thing under it. -->
			<div class="hero-aside">
				<div class="hero-count">
					<MemberCount />
					<MemberTrend />
				</div>

				<div class="hero-demo">
					<VoiceChannel />
				</div>
			</div>
		</div>
	</div>

	<!-- A 100vh hero has to say there is more under it. Wide screens only: on a
	     phone the page already scrolls past the fold on its own. -->
	<a class="hero-scroll" href="#what-this-is">
		<span>What this place is</span>
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path
				d="M4.5 7l4.5 4.5L13.5 7"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</a>
</section>

<!-- What this place actually is -->
<section class="features" id="what-this-is">
	<div class="features-shell">
		<div class="features-header">
			<h2 class="features-title">A coworking space that happens to be a Discord server</h2>
			<p class="features-subtitle">
				No desks, no badge, no commute. Voice channels you can sit in while you work, people who
				will read your code at midnight, and a habit of shipping the thing.
			</p>
		</div>

		<div class="features-grid">
			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<circle cx="20" cy="20" r="15" stroke="var(--color-primary)" stroke-width="2.5" />
							<circle cx="14" cy="17" r="3.5" fill="var(--color-secondary)" />
							<circle cx="26" cy="17" r="3.5" fill="var(--color-secondary)" />
							<path
								d="M13 26c2 2.5 4.5 3.5 7 3.5s5-1 7-3.5"
								stroke="var(--color-primary)"
								stroke-width="2.5"
								stroke-linecap="round"
							/>
						</svg>
					</div>
					<h3 class="feature-title">Body doubling that works</h3>
				</div>
				<p class="feature-description">
					Drop into a focus channel and work next to someone. It is the oldest productivity trick
					there is, and it is the reason people keep coming back at the same hour every day.
				</p>
			</div>

			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<path
								d="M8 30V14l7-6 7 6v16"
								stroke="var(--color-primary)"
								stroke-width="2.5"
								stroke-linejoin="round"
							/>
							<path
								d="M22 30V20l5-4 5 4v10"
								stroke="var(--color-secondary)"
								stroke-width="2.5"
								stroke-linejoin="round"
							/>
							<path
								d="M5 30h30"
								stroke="var(--color-primary)"
								stroke-width="2.5"
								stroke-linecap="round"
							/>
						</svg>
					</div>
					<h3 class="feature-title">Build in public, in a small room</h3>
				</div>
				<p class="feature-description">
					Post the ugly first version. Someone will try it within the hour and tell you what broke.
					Most of the projects on this site started as one message in one channel.
				</p>
			</div>

			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<path
								d="M20 6l4.2 11.6L36 20l-9.8 7.2L29 38l-9-6.6L11 38l2.8-10.8L4 20l11.8-2.4z"
								stroke="var(--color-primary)"
								stroke-width="2.5"
								stroke-linejoin="round"
							/>
							<path d="M20 13l2 8h-4z" fill="var(--color-secondary)" />
						</svg>
					</div>
					<div class="feature-heading">
						<h3 class="feature-title">Hackathons and jams</h3>
						<span class="feature-soon">Coming soon</span>
					</div>
				</div>
				<p class="feature-description">
					Weekend events with a theme, a deadline and a demo at the end. We have run one, and they
					are not a regular thing yet. The next is announced in the server first.
				</p>
			</div>

			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<circle cx="20" cy="20" r="14" stroke="var(--color-primary)" stroke-width="2.5" />
							<path
								d="M6 20h28M20 6c4.5 5 4.5 23 0 28M20 6c-4.5 5-4.5 23 0 28"
								stroke="var(--color-secondary)"
								stroke-width="2.5"
							/>
						</svg>
					</div>
					<h3 class="feature-title">Everyone is welcome</h3>
				</div>
				<p class="feature-description">
					Every timezone, every skill level, every discipline. Beginners get answers rather than
					links to the manual, and nobody has to prove they belong before they can ask.
				</p>
			</div>

			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<rect
								x="5"
								y="8"
								width="30"
								height="21"
								rx="3"
								stroke="var(--color-primary)"
								stroke-width="2.5"
							/>
							<path
								d="M14 34h12M20 29v5"
								stroke="var(--color-primary)"
								stroke-width="2.5"
								stroke-linecap="round"
							/>
							<path
								d="M13 22l5-6 4 5 5-7"
								stroke="var(--color-secondary)"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</div>
					<h3 class="feature-title">Show and tell</h3>
				</div>
				<p class="feature-description">
					A channel for what you made this week, however small and however broken. It is the
					deadline that is not a deadline, and it is why things get finished.
				</p>
			</div>

			<div class="feature-card">
				<div class="feature-header">
					<div class="feature-icon">
						<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
							<path
								d="M12 18V13a8 8 0 0 1 15.4-3"
								stroke="var(--color-secondary)"
								stroke-width="2.5"
								stroke-linecap="round"
							/>
							<rect
								x="8"
								y="18"
								width="24"
								height="16"
								rx="3"
								stroke="var(--color-primary)"
								stroke-width="2.5"
							/>
							<circle cx="20" cy="26" r="2.5" fill="var(--color-secondary)" />
						</svg>
					</div>
					<h3 class="feature-title">Free, and open</h3>
				</div>
				<p class="feature-description">
					No application, no fee, no minimum hours. Click the invite, read the rules, say hello in
					whatever channel looks like your kind of trouble.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- Featured projects -->
<section class="shelf">
	<div class="shelf-shell">
		<div class="shelf-header">
			<div>
				<h2 class="shelf-title">Made here, lately</h2>
				<p class="shelf-subtitle">A few of the things the community has shipped.</p>
			</div>
			<a class="shelf-link" href="/projects">All projects →</a>
		</div>

		<div class="shelf-grid">
			{#each featuredProjects as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
	</div>
</section>

<!-- The ask -->
<section class="closing">
	<div class="closing-shell">
		<div class="closing-card closing-card-accent">
			<h2>Pull up a chair</h2>
			<p>The server is free, it is open, and someone is almost certainly in a channel right now.</p>
			<a class="hero-join" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5c1.6.4 3 1 4.4 1.9a16.6 16.6 0 0 0-14.9 0c1.3-.9 2.8-1.6 4.4-1.9L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.9 8.6.1 12.7.5 16.7A19.9 19.9 0 0 0 6.6 20l1.3-2c-1-.4-2-.9-2.9-1.6l.7-.5a14.2 14.2 0 0 0 12.6 0l.7.5c-.9.7-1.9 1.2-2.9 1.6l1.3 2a19.9 19.9 0 0 0 6.1-3.3c.5-4.7-.8-8.8-3.2-12.3zM8.5 14.3c-1.2 0-2.2-1.1-2.2-2.4 0-1.4 1-2.5 2.2-2.5s2.2 1.1 2.2 2.5c0 1.3-1 2.4-2.2 2.4zm7 0c-1.2 0-2.2-1.1-2.2-2.4 0-1.4 1-2.5 2.2-2.5s2.2 1.1 2.2 2.5c0 1.3-1 2.4-2.2 2.4z"
					/>
				</svg>
				Join on Discord
			</a>
		</div>
	</div>
</section>

<!-- Toast Notification -->
{#if showToast}
	<div class="toast toast-error" role="alert" aria-live="polite">
		<span class="toast-message">{toastMessage}</span>
		<button class="toast-dismiss" on:click={dismissToast} aria-label="Dismiss notification">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path
					d="M4 4l8 8M12 4l-8 8"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
{/if}

<style>
	/* The hero is the share card, alive.

	   It once carried a "cosmic background" — five turbulence-filtered nebulae,
	   drifting planets, a comet, blobs — that fought the mark and said nothing
	   about the place, and it was stripped back to the mark, the name and the
	   way in. What is here now is the brand's own night from
	   brand/og-image.svg, no more: the navy sky, one coral glow behind the star,
	   a seeded starfield (HeroSky.svelte), the carved-wood mark large and lit,
	   and the same words. Everything is markup and CSS, so it paints before
	   hydration; the only motion is a staggered entrance, a slow float on the
	   mark and a quarter of the stars breathing, and all of it stops under
	   prefers-reduced-motion.

	   The composition is two columns that each earn their side. Left: who this
	   is, what it offers, and the way in. Right: everything live — the member
	   count, the month behind it, and #Ten Forward itself. */
	.hero {
		/* The same night in both themes, like the card. The count, the trend and
		   the voice panel read the sky's palette through the token names they use
		   everywhere else — nothing inside knows it is standing in the dark. The
		   values live in app.css beside the theme tokens. */
		--color-background: var(--hero-background);
		--color-surface: var(--hero-surface);
		--color-surface-hover: var(--hero-surface-hover);
		--color-text: var(--hero-text);
		--color-text-secondary: var(--hero-text-secondary);
		--color-border: var(--hero-border);
		--color-primary: var(--hero-primary);
		--color-primary-hover: var(--hero-primary-hover);
		--color-secondary: var(--hero-secondary);
		--color-secondary-hover: var(--hero-secondary-hover);
		--color-success: var(--hero-success);

		/* The measure of the live column, and of the voice panel inside it. One
		   value drives the grid track and both halves, so they cannot disagree. */
		--hero-panel-width: 26rem;

		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Horizontal padding is the shared .container's, not the hero's. */
		padding-block: clamp(2.5rem, 6vh, 4.5rem) clamp(3rem, 7vh, 5rem);
		/* Under the sky, so nothing pale shows through before it paints. */
		background: var(--hero-sky-deep);
		color: var(--color-text);
	}

	/* The horizon: a hairline of coral where the night meets the page. */
	.hero::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--hero-glow) 45%, transparent),
			transparent
		);
	}

	/* Wider than the rest of the page — the hero should feel expansive where a
	   section of cards does not — but still a centred column, not full bleed.
	   Pinned to the edges of a large monitor the two halves end up a third of a
	   screen apart with nothing between them, which reads as two designs rather
	   than one. */
	.hero-container {
		position: relative;
		max-width: 90rem;
	}

	.hero-content {
		display: grid;
		gap: var(--spacing-2xl);
		text-align: center;
	}

	/* The entrance is a CSS animation, not a class toggled from onMount, so
	   with JavaScript off, blocked or merely slow the hero is still the first
	   thing on the site. Each piece follows the last by a beat, in the order it
	   is read, and the panel arrives once the words have. */
	.hero-mark-wrap,
	.hero-heading,
	.subtitle,
	.hero-actions,
	.hero-count,
	.hero-demo,
	.hero-scroll {
		animation: hero-in 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}

	.hero-heading {
		animation-delay: 90ms;
	}

	.subtitle {
		animation-delay: 180ms;
	}

	.hero-actions {
		animation-delay: 260ms;
	}

	.hero-count {
		animation-delay: 360ms;
	}

	.hero-demo {
		animation-duration: 0.9s;
		animation-delay: 460ms;
	}

	.hero-scroll {
		animation-delay: 700ms;
	}

	@keyframes hero-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.hero-lockup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	/* The carved-wood star, straight from brand/starspace-mark.png via
	   `bun run build:brand` — the same file the nav and footer use, so it is
	   already in cache by the time anyone scrolls. Large, lit from behind by
	   the card's coral nebula, thrown forward by its shadow, and drifting the
	   way a thing does when nothing is holding it down. */
	.hero-mark-wrap {
		position: relative;
		z-index: 0;
		flex: none;
		width: fit-content;
	}

	.hero-mark-wrap::before {
		content: '';
		position: absolute;
		inset: -75%;
		z-index: -1;
		border-radius: 50%;
		background: radial-gradient(
			closest-side,
			color-mix(in srgb, var(--hero-glow) 38%, transparent),
			color-mix(in srgb, var(--hero-glow) 12%, transparent) 55%,
			transparent
		);
	}

	.hero-mark {
		display: block;
		width: clamp(112px, 12vw, 216px);
		height: auto;
		aspect-ratio: 1;
		filter: drop-shadow(0 18px 28px var(--hero-mark-shadow));
		animation: hero-float 6s ease-in-out infinite alternate;
	}

	@keyframes hero-float {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-8px);
		}
	}

	.main-title {
		margin: 0 0 var(--spacing-xs);
		font-size: clamp(2.75rem, 5vw + 1rem, 6.5rem);
		font-weight: 800;
		line-height: 1;
		/* The wordmark opens on an asterisk, which carries no visual left edge.
		   Pulling it back by its own side bearing puts the stem of the S — what
		   the eye actually reads as the start of the line — over the mark's
		   left edge and over everything below it. */
		margin-left: -0.06em;
		letter-spacing: -0.035em;
		color: var(--color-text);
		text-shadow: 0 0 48px var(--hero-title-glow);
	}

	.hero-tagline {
		margin: 0;
		font-size: clamp(1.125rem, 1vw + 0.85rem, 1.75rem);
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: -0.01em;
		text-wrap: balance;
		color: var(--color-text);
	}

	.subtitle {
		max-width: 40rem;
		margin: 0 auto var(--spacing-lg);
		font-size: clamp(0.95rem, 0.35vw + 0.9rem, 1.1875rem);
		line-height: 1.7;
		text-wrap: pretty;
		color: var(--color-text-secondary);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-md);
	}

	@media (max-width: 519px) {
		.hero-actions {
			flex-direction: column;
		}

		.hero-join,
		.hero-secondary {
			justify-content: center;
		}
	}

	/* Discord's own blurple, not a theme token — people recognise the button
	   before they read it, and it has to look the same in both themes. */
	.hero-join {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.95rem 1.9rem;
		border-radius: var(--radius-md);
		background: #5865f2;
		color: #ffffff;
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		box-shadow: 0 10px 30px rgb(88 101 242 / 0.35);
		transition:
			background var(--transition-fast),
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.hero-join:hover,
	.hero-join:focus-visible {
		background: #4752c4;
		transform: translateY(-2px);
		box-shadow: 0 14px 34px rgb(88 101 242 / 0.45);
	}

	/* Glass on the night: the surface token is translucent inside the hero, so
	   the stars show through the button the way they do through the panel. */
	.hero-secondary {
		display: inline-flex;
		align-items: center;
		padding: 0.95rem 1.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		backdrop-filter: blur(8px);
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}

	.hero-secondary:hover,
	.hero-secondary:focus-visible {
		border-color: var(--color-primary);
		background: var(--color-surface-hover);
	}

	/* The live column. Its two halves are the same width and share a left edge,
	   with a rule between them, so the count reads as the panel's headline
	   rather than as a stray number above a card. */
	.hero-aside {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-lg);
	}

	.hero-count,
	.hero-demo {
		width: 100%;
		max-width: var(--hero-panel-width, 26rem);
	}

	/* The voice panel is a translucent card, so the sky reads through it; the
	   blur keeps the stars from cutting through the tiles. */
	.hero-demo {
		--vc-max-width: 100%;

		backdrop-filter: blur(10px);
	}

	/* Centred under the whole hero rather than on the copy's rail: the rail
	   moves with the viewport once the content is a centred column, and a cue
	   that drifts is worse than one that simply sits in the middle. */
	.hero-scroll {
		position: absolute;
		bottom: var(--spacing-xl);
		left: 50%;
		transform: translateX(-50%);
		display: none;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.hero-scroll:hover,
	.hero-scroll:focus-visible {
		color: var(--color-text);
	}

	.hero-scroll svg {
		animation: hero-nudge 2.4s ease-in-out infinite;
	}

	@keyframes hero-nudge {
		0%,
		60%,
		100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(3px);
		}
	}

	@media (min-width: 1024px) {
		.hero {
			/* Fill the first screen. 64px is the nav's height. */
			min-height: calc(100vh - 64px);
			min-height: calc(100svh - 64px);
		}

		.hero-content {
			/* The live column is a fixed measure; the copy takes what is left and
			   caps itself, so extra width on a large screen opens the gap between
			   the two rather than stretching either. */
			grid-template-columns: minmax(0, 1fr) minmax(0, var(--hero-panel-width));
			align-items: center;
			gap: clamp(2.5rem, 5vw, 6rem);
			text-align: left;
		}

		/* The mark hangs in the margin and the words share one rail: the name,
		   the promise, the copy and the buttons all start on the same line,
		   which is also the nav logo's. The lockup stops generating a box so
		   its two halves can take their places in this grid directly. */
		.hero-copy {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			column-gap: clamp(1.5rem, 2.5vw, 2.75rem);
			row-gap: var(--spacing-xl);
			align-content: start;
			max-width: 56rem;
		}

		.hero-lockup {
			display: contents;
		}

		.hero-mark-wrap {
			grid-column: 1;
			grid-row: 1 / span 3;
			align-self: start;
		}

		.hero-heading,
		.subtitle,
		.hero-actions {
			grid-column: 2;
			min-width: 0;
		}

		.subtitle {
			margin: 0;
		}

		.hero-aside {
			margin-left: 0;
		}

		.hero-actions,
		.hero-aside {
			align-items: flex-start;
			justify-content: flex-start;
		}

		.hero-count {
			--member-count-align: left;
			--member-count-justify: flex-start;
			--member-trend-inline: 0;
			--member-number-size: clamp(3rem, 3.4vw, 4.5rem);

			/* The rule belongs to the count, so it only exists where the two
			   halves are actually stacked in a column. */
			padding-bottom: var(--spacing-lg);
			border-bottom: 1px solid var(--color-border);
		}

		.hero-scroll {
			display: inline-flex;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-mark-wrap,
		.hero-heading,
		.subtitle,
		.hero-actions,
		.hero-count,
		.hero-demo,
		.hero-scroll,
		.hero-mark,
		.hero-scroll svg {
			animation: none;
		}

		.hero-join:hover,
		.hero-join:focus-visible {
			transform: none;
		}
	}

	/* Featured project shelf */
	.shelf {
		padding: var(--spacing-2xl) var(--spacing-md);
		background: var(--color-background);
	}

	.shelf-shell {
		max-width: var(--layout-feature-grid-max-width);
		margin: 0 auto;
	}

	.shelf-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
	}

	.shelf-title {
		margin: 0;
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.shelf-subtitle {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
	}

	.shelf-link {
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.shelf-link:hover,
	.shelf-link:focus-visible {
		text-decoration: underline;
	}

	.shelf-grid {
		display: grid;
		gap: var(--spacing-lg);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
	}

	/* Closing band: the ask */
	.closing {
		padding: var(--spacing-2xl) var(--spacing-md) calc(var(--spacing-2xl) * 1.5);
		background: var(--color-background);
	}

	.closing-shell {
		max-width: 44rem;
		margin: 0 auto;
	}

	.closing-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-2xl) var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		text-align: center;
	}

	.closing-card-accent {
		border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 10%, var(--color-surface)),
			var(--color-surface)
		);
	}

	.closing-card h2 {
		margin: 0;
		font-size: 1.6rem;
		letter-spacing: -0.01em;
	}

	.closing-card p {
		margin: 0 0 var(--spacing-sm);
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-content {
			animation: none;
		}

		.hero-join:hover,
		.hero-join:focus-visible {
			transform: none;
		}
	}

	/* Features Section */
	.features {
		position: relative;
		padding: var(--spacing-6xl) 0;
		padding-bottom: calc(var(--spacing-6xl) * 3);
		background: linear-gradient(
			180deg,
			var(--color-background) 0%,
			var(--color-surface) 50%,
			var(--color-background) 100%
		);
		overflow: hidden;
	}

	/* Subtle background pattern */
	.features::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: radial-gradient(
			circle at 20% 30%,
			color-mix(in srgb, var(--color-primary) 3%, transparent) 0%,
			transparent 50%
		);
		pointer-events: none;
	}

	.features-shell {
		width: 100%;
		max-width: var(--layout-feature-grid-max-width);
		margin: 0 auto;
		padding: 0 var(--spacing-xl);
		box-sizing: border-box;
		position: relative;
		z-index: 1;
	}

	.features-header {
		text-align: center;
		padding-top: 4rem;
		padding-bottom: 4rem;
		max-width: 900px;
		margin-left: auto;
		margin-right: auto;
		position: relative;
		z-index: 1;
	}

	.features-title {
		font-size: 3rem;
		font-weight: 800;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
		letter-spacing: -0.03em;
		background: linear-gradient(
			135deg,
			var(--color-text) 0%,
			color-mix(in srgb, var(--color-primary) 80%, var(--color-text)) 100%
		);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 2px 20px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.features-subtitle {
		font-size: 1.25rem;
		color: var(--color-text-secondary);
		line-height: 1.7;
		font-weight: 400;
		max-width: 640px;
		margin: 0 auto;
	}

	.features-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-xl);
		width: 100%;
		margin: 0 0 var(--spacing-4xl);
		position: relative;
		box-sizing: border-box;
	}

	.feature-card {
		position: relative;
		padding: var(--spacing-2xl);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		background: var(--color-surface);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		cursor: default;
	}

	/* Gradient overlay on hover */
	.feature-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 5%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 5%, transparent) 100%
		);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	.feature-card:hover::before {
		opacity: 1;
	}

	.feature-card:hover {
		transform: translateY(-8px) scale(1.02);
		border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
		box-shadow:
			0 20px 40px color-mix(in srgb, var(--color-primary) 15%, transparent),
			0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent) inset;
	}

	/* Shine effect on hover */
	.feature-card::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: linear-gradient(
			45deg,
			transparent 30%,
			color-mix(in srgb, var(--color-text) 5%, transparent) 50%,
			transparent 70%
		);
		transform: rotate(45deg) translate(-100%, -100%);
		transition: transform 0.6s ease;
		pointer-events: none;
	}

	.feature-card:hover::after {
		transform: rotate(45deg) translate(100%, 100%);
	}

	.feature-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-md);
	}

	.feature-icon {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 15%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 10%, transparent) 100%
		);
		border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
		border-radius: 12px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		z-index: 1;
	}

	.feature-icon svg {
		width: 28px;
		height: 28px;
	}

	.feature-card:hover .feature-icon {
		transform: scale(1.08) rotate(3deg);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 25%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 20%, transparent) 100%
		);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.feature-icon svg {
		filter: drop-shadow(0 2px 4px color-mix(in srgb, var(--color-primary) 20%, transparent));
		transition: filter 0.3s ease;
	}

	.feature-card:hover .feature-icon svg {
		filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--color-primary) 40%, transparent));
	}

	/* One card describes something the community intends to run rather than
	   something it already does. The heading wraps so the pill can sit beside
	   the title without the icon's gap pushing it to the far edge, and the copy
	   says so in words as well — the pill alone is easy to miss. Take both out
	   together on the day the first jam is scheduled. */
	.feature-heading {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.feature-soon {
		display: inline-block;
		padding: 0.15rem 0.55rem;
		border: 1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
		color: var(--color-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	.feature-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
		position: relative;
		z-index: 1;
		transition: color 0.3s ease;
	}

	.feature-card:hover .feature-title {
		color: var(--color-primary);
	}

	.feature-description {
		font-size: 1rem;
		color: var(--color-text-secondary);
		line-height: 1.7;
		position: relative;
		z-index: 1;
	}

	/* Tablet: 2 columns */
	@media (min-width: 769px) {
		.features-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.features {
			padding-top: var(--spacing-6xl);
		}
	}

	/* Desktop: 3 columns */
	@media (min-width: 1400px) {
		.features-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Large desktop: more padding */
	@media (min-width: 1440px) {
		.features-shell {
			padding: 0 var(--spacing-2xl);
		}
	}

	/* Mobile: 1 column (base styles) */
	@media (max-width: 768px) {
		.features {
			padding-top: var(--spacing-3xl);
			padding-bottom: var(--spacing-3xl);
		}

		.features-title {
			font-size: 2.25rem;
		}

		.features-subtitle {
			font-size: 1.0625rem;
		}

		.features-grid {
			gap: var(--spacing-lg);
		}

		.feature-card {
			padding: var(--spacing-xl);
		}

		.feature-icon {
			width: 64px;
			height: 64px;
		}

		.feature-title {
			font-size: 1.25rem;
		}

		.feature-description {
			font-size: 0.938rem;
		}
	}

	@media (max-width: 480px) {
		.features-title {
			font-size: 1.75rem;
		}

		.features-subtitle {
			font-size: 0.938rem;
		}

		.feature-card {
			padding: var(--spacing-lg);
		}

		.feature-icon {
			width: 56px;
			height: 56px;
			margin-bottom: var(--spacing-lg);
		}

		.feature-icon svg {
			width: 32px;
			height: 32px;
		}

		.feature-title {
			font-size: 1.125rem;
		}

		.feature-description {
			font-size: 0.875rem;
			line-height: 1.6;
		}
	}

	/* Toast Notification */
	.toast {
		position: fixed;
		top: var(--spacing-lg);
		right: var(--spacing-lg);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		animation: slideIn 0.3s ease-out;
	}

	.toast-error {
		background-color: var(--color-error);
		color: var(--color-background);
	}

	.toast-message {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.toast-dismiss {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: var(--spacing-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.8;
		transition: opacity var(--transition-fast);
	}

	.toast-dismiss:hover {
		opacity: 1;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(100%);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
