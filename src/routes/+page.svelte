<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MemberCount from '$lib/components/MemberCount.svelte';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { featuredProjects } from '$lib/data/projects';
	import { DISCORD_INVITE } from '$lib/discord';
	import { site } from '$lib/site.config';
	import { openCommandPalette } from '$lib/stores/commandPalette';
	import { onMount } from 'svelte';

	let mounted = false;
	let searchInput = '';
	let focusedOption = -1;
	let toastMessage = '';
	let showToast = false;

	// Error message mapping
	const errorMessages: Record<string, string> = {
		forbidden: 'You do not have permission to access that page.',
		unauthorized: 'Please log in to access that page.',
		oauth_failed: 'Authentication failed. Please try again.'
	};

	onMount(() => {
		mounted = true;

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

	function handleAction(action: string) {
		if (action === 'projects') goto('/projects');
		else if (action === 'sister-spaces') goto('/sister-spaces');
		else if (action === 'chat') goto('/chat');
	}

	function handleSearchFocus() {
		openCommandPalette();
	}

	function handleSearchClick() {
		openCommandPalette();
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		// Open command palette on any key press
		openCommandPalette();
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

<div class="hero">
	<!-- Cosmic Background -->
	<div class="cosmic-bg">
		<!-- New Nebula Flow - Left Side -->
		<div class="nebula-flow-left">
			<svg class="nebula-waves-svg" viewBox="0 0 400 1200" preserveAspectRatio="xMidYMid slice">
				<defs>
					<!-- Radial gradients for nebula clouds -->
					<radialGradient id="nebula-gradient-1" cx="50%" cy="30%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.8" />
						<stop offset="30%" style="stop-color: var(--color-primary); stop-opacity: 0.6" />
						<stop offset="60%" style="stop-color: var(--color-secondary); stop-opacity: 0.4" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-2" cx="40%" cy="50%">
						<stop offset="0%" style="stop-color: var(--color-primary); stop-opacity: 0.7" />
						<stop offset="25%" style="stop-color: var(--color-secondary); stop-opacity: 0.65" />
						<stop offset="55%" style="stop-color: var(--color-primary); stop-opacity: 0.5" />
						<stop offset="100%" style="stop-color: var(--color-secondary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-3" cx="60%" cy="40%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.75" />
						<stop offset="35%" style="stop-color: var(--color-primary); stop-opacity: 0.55" />
						<stop offset="70%" style="stop-color: var(--color-secondary); stop-opacity: 0.3" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-4" cx="45%" cy="60%">
						<stop offset="0%" style="stop-color: var(--color-primary); stop-opacity: 0.65" />
						<stop offset="30%" style="stop-color: var(--color-secondary); stop-opacity: 0.5" />
						<stop offset="60%" style="stop-color: var(--color-primary); stop-opacity: 0.35" />
						<stop offset="100%" style="stop-color: var(--color-secondary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-5" cx="55%" cy="35%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.7" />
						<stop offset="40%" style="stop-color: var(--color-primary); stop-opacity: 0.45" />
						<stop offset="75%" style="stop-color: var(--color-secondary); stop-opacity: 0.25" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>

					<!-- Turbulence for organic texture (reduced octaves - imperceptible with heavy blur) -->
					<filter id="nebula-filter-1">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.008 0.012"
							numOctaves="3"
							seed="1"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="40"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="35" />
					</filter>
					<filter id="nebula-filter-2">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.01 0.015"
							numOctaves="2"
							seed="5"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="50"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="45" />
					</filter>
					<filter id="nebula-filter-3">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.012 0.01"
							numOctaves="3"
							seed="10"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="35"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="40" />
					</filter>
					<filter id="nebula-filter-4">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.009 0.014"
							numOctaves="3"
							seed="15"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="45"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="50" />
					</filter>
					<filter id="nebula-filter-5">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.011 0.008"
							numOctaves="2"
							seed="20"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="38"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="42" />
					</filter>

					<!-- Glow effect -->
					<filter id="glow-intense">
						<feGaussianBlur stdDeviation="20" result="blur" />
						<feComposite in="blur" in2="blur" operator="over" result="glow1" />
						<feComposite in="glow1" in2="blur" operator="over" result="glow2" />
						<feMerge>
							<feMergeNode in="glow2" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				<!-- Organic nebula cloud shapes -->
				<!-- Layer 1: Deep background -->
				<path
					class="nebula-cloud nebula-1"
					d="M-50,0 C20,80 40,180 60,280 C80,380 70,480 90,580 C110,680 130,780 140,880 C145,930 150,1000 160,1100 L400,1200 L400,0 Z"
					fill="url(#nebula-gradient-1)"
					filter="url(#nebula-filter-1)"
				/>

				<!-- Layer 2: Mid layer with curves -->
				<path
					class="nebula-cloud nebula-2"
					d="M-30,50 C30,120 50,220 80,320 C100,400 90,500 110,600 C130,700 120,800 140,900 C150,960 160,1050 170,1150 L400,1200 L400,0 Z"
					fill="url(#nebula-gradient-2)"
					filter="url(#nebula-filter-2)"
				/>

				<!-- Layer 3: Flowing organic shape -->
				<path
					class="nebula-cloud nebula-3"
					d="M-40,100 Q60,200 80,350 T120,600 Q140,750 160,900 T190,1100 L400,1150 L400,50 Z"
					fill="url(#nebula-gradient-3)"
					filter="url(#nebula-filter-3)"
				/>

				<!-- Layer 4: Wispy tendrils -->
				<path
					class="nebula-cloud nebula-4"
					d="M-20,150 C40,230 70,330 100,450 S130,650 150,770 C165,850 175,950 185,1050 L400,1100 L400,100 Z"
					fill="url(#nebula-gradient-4)"
					filter="url(#nebula-filter-4)"
				/>

				<!-- Layer 5: Front wispy layer -->
				<path
					class="nebula-cloud nebula-5"
					d="M0,200 Q90,300 110,450 T160,700 Q180,850 200,1000 L400,1050 L400,150 Z"
					fill="url(#nebula-gradient-5)"
					filter="url(#nebula-filter-5)"
				/>

				<!-- Bright glowing wisps -->
				<ellipse
					class="nebula-glow glow-1"
					cx="120"
					cy="250"
					rx="150"
					ry="180"
					fill="url(#nebula-gradient-1)"
					filter="url(#glow-intense)"
					opacity="0.6"
				/>
				<ellipse
					class="nebula-glow glow-2"
					cx="140"
					cy="550"
					rx="130"
					ry="160"
					fill="url(#nebula-gradient-2)"
					filter="url(#glow-intense)"
					opacity="0.5"
				/>
				<ellipse
					class="nebula-glow glow-3"
					cx="110"
					cy="850"
					rx="140"
					ry="170"
					fill="url(#nebula-gradient-3)"
					filter="url(#glow-intense)"
					opacity="0.55"
				/>
			</svg>

			<!-- Stars within the nebula -->
			<div class="nebula-star" style="top: 8%; left: 12%;"></div>
			<div class="nebula-star small" style="top: 15%; left: 18%;"></div>
			<div class="nebula-star large" style="top: 22%; left: 8%;"></div>
			<div class="nebula-star" style="top: 35%; left: 14%;"></div>
			<div class="nebula-star small" style="top: 42%; left: 6%;"></div>
			<div class="nebula-star" style="top: 48%; left: 16%;"></div>
			<div class="nebula-star large" style="top: 58%; left: 10%;"></div>
			<div class="nebula-star small" style="top: 65%; left: 20%;"></div>
			<div class="nebula-star" style="top: 72%; left: 7%;"></div>
			<div class="nebula-star small" style="top: 82%; left: 15%;"></div>
			<div class="nebula-star large" style="top: 90%; left: 11%;"></div>
		</div>
		<!-- Wavy colored background blobs -->
		<div class="wavy-blob wavy-blob-left"></div>
		<div class="wavy-blob wavy-blob-bottom"></div>

		<!-- Animated nebula clouds -->
		<div class="nebula nebula-left"></div>
		<div class="nebula-overlay nebula-left-overlay"></div>

		<!-- Four-pointed stars scattered throughout -->
		<div class="star-sparkle" style="top: 8%; left: 18%; animation-delay: 0s;"></div>
		<div class="star-sparkle" style="top: 15%; left: 52%; animation-delay: 1.5s;"></div>
		<div class="star-sparkle large" style="top: 18%; right: 15%; animation-delay: 0.8s;"></div>
		<div class="star-sparkle" style="top: 35%; left: 25%; animation-delay: 2s;"></div>
		<div class="star-sparkle large" style="top: 50%; left: 8%; animation-delay: 1.2s;"></div>
		<div class="star-sparkle" style="bottom: 25%; left: 15%; animation-delay: 2.5s;"></div>
		<div class="star-sparkle large" style="bottom: 15%; right: 8%; animation-delay: 0.3s;"></div>
		<div class="star-sparkle" style="top: 45%; right: 12%; animation-delay: 1.8s;"></div>

		<!-- Small dots for depth -->
		<div class="stars-layer"></div>
		<div class="stars-layer-2"></div>

		<!-- Planets with enhanced detail -->
		<div class="planet planet-left"></div>
		<div class="planet planet-right"></div>

		<!-- Comet/shooting star -->
		<div class="comet"></div>
	</div>

	<div class="container">
		<div class="hero-content" class:mounted>
			<!-- Main Title -->
			<h1 class="main-title">{site.name}</h1>

			<p class="hero-tagline">Work, create and collaborate — with chaos and fun.</p>

			<!-- The count is the short, striking part, so on a phone it sits above
			     the body copy rather than below five lines of it. -->
			<div class="hero-count">
				<MemberCount />
			</div>

			<p class="subtitle">
				{site.name} is an inclusive digital coworking space on Discord, where everyone is
				welcome. Work around makers, creators, artists, visionaries and trailblazers who are
				creativity and productivity driven. 🤘 🚀
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

			<!-- Command Palette Style Search -->
			<div class="command-palette">
				<div class="search-box">
					<svg
						class="search-icon"
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none" />
						<path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
					<input
						type="text"
						placeholder="Start typing or ask something..."
						bind:value={searchInput}
						on:focus={handleSearchFocus}
						on:click={handleSearchClick}
						on:keydown={handleSearchKeydown}
						aria-label="Search or ask a question"
						readonly
					/>
				</div>

				<div class="command-options">
					<button
						class="command-option"
						class:focused={focusedOption === 0}
						on:click={() => handleAction('projects')}
						on:mouseenter={() => (focusedOption = 0)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect x="2" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
							<rect x="11" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
							<rect x="2" y="12" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.8" />
							<rect x="11" y="12" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.8" />
						</svg>
						<span>Projects</span>
					</button>

					<button
						class="command-option"
						class:focused={focusedOption === 1}
						on:click={() => handleAction('sister-spaces')}
						on:mouseenter={() => (focusedOption = 1)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M10 18s6-5.2 6-9.4A6 6 0 0 0 4 8.6C4 12.8 10 18 10 18z"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linejoin="round"
							/>
							<circle cx="10" cy="8.5" r="2.2" stroke="currentColor" stroke-width="1.8" />
						</svg>
						<span>Sister spaces</span>
					</button>

					<button
						class="command-option ask"
						class:focused={focusedOption === 2}
						on:click={() => handleAction('chat')}
						on:mouseenter={() => (focusedOption = 2)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" />
							<path
								d="M10 6v4M10 14h.01"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
						<span>Ask something...</span>
						<div class="ai-indicator">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<rect
									x="4"
									y="8"
									width="3"
									height="8"
									rx="1.5"
									fill="currentColor"
									class="bar bar-1"
								/>
								<rect
									x="10.5"
									y="4"
									width="3"
									height="16"
									rx="1.5"
									fill="currentColor"
									class="bar bar-2"
								/>
								<rect
									x="17"
									y="10"
									width="3"
									height="4"
									rx="1.5"
									fill="currentColor"
									class="bar bar-3"
								/>
							</svg>
						</div>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- What this place actually is -->
<section class="features">
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
							<path d="M5 30h30" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" />
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
					<h3 class="feature-title">Hackathons and jams</h3>
				</div>
				<p class="feature-description">
					Weekend events with a theme, a deadline and a demo at the end. Spacetime Clock came out of
					one. So did half the arguments about how a clock should work.
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
							<path d="M14 34h12M20 29v5" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" />
							<path d="M13 22l5-6 4 5 5-7" stroke="var(--color-secondary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
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

<!-- Sister spaces + the ask -->
<section class="closing">
	<div class="closing-shell">
		<div class="closing-card">
			<h2>Sister spaces</h2>
			<p>
				Making things is physical too. We are allied with workshops that have the lathes, the laser
				cutters and the soldering stations we do not.
			</p>
			<a class="closing-link" href="/sister-spaces">Visit a sister space →</a>
		</div>

		<div class="closing-card closing-card-accent">
			<h2>Pull up a chair</h2>
			<p>
				The server is free, it is open, and someone is almost certainly in a channel right now.
			</p>
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
	.hero {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-background) 100%);
		padding: var(--spacing-2xl) var(--spacing-md);
	}

	/* Fade-out effect at the bottom of hero */
	.hero::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 200px;
		background: linear-gradient(180deg, transparent 0%, var(--color-background) 100%);
		pointer-events: none;
		z-index: 1;
	}

	/* Cosmic Background Elements */
	.cosmic-bg {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
		z-index: 0;
		pointer-events: none;
		/* PERF: Isolate paint/layout from rest of page */
		contain: layout style paint;
	}

	/* Wavy colored background blobs */
	.wavy-blob {
		position: absolute;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-secondary) 80%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 70%, transparent) 50%,
			color-mix(in srgb, var(--color-secondary) 60%, transparent) 100%
		);
		border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
		filter: blur(60px);
		animation: blob-float 20s ease-in-out infinite;
		/* PERF: Promote to compositor layer for GPU-accelerated transforms */
		will-change: transform;
	}

	.wavy-blob-left {
		top: 5%;
		left: -10%;
		width: 500px;
		height: 600px;
		opacity: 0.7;
	}

	.wavy-blob-bottom {
		bottom: -15%;
		right: -10%;
		width: 600px;
		height: 500px;
		opacity: 0.6;
		background: linear-gradient(
			225deg,
			color-mix(in srgb, var(--color-error) 70%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 60%, transparent) 50%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 100%
		);
		border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%;
		animation: blob-float 25s ease-in-out infinite reverse;
	}

	@keyframes blob-float {
		0%,
		100% {
			transform: translate(0, 0) rotate(0deg);
			border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
		}
		25% {
			transform: translate(20px, -30px) rotate(5deg);
			border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%;
		}
		50% {
			transform: translate(-20px, -50px) rotate(-5deg);
			border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%;
		}
		75% {
			transform: translate(30px, -20px) rotate(3deg);
			border-radius: 60% 40% 40% 60% / 60% 60% 40% 40%;
		}
	}

	/* New Nebula Flow - Left Side (like the image) */
	.nebula-flow-left {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		opacity: 0.42;
		pointer-events: none;
		/* Gradient mask to fade out on right edge */
		-webkit-mask-image: linear-gradient(
			to right,
			rgba(0, 0, 0, 1) 0%,
			rgba(0, 0, 0, 1) 30%,
			rgba(0, 0, 0, 0.6) 50%,
			rgba(0, 0, 0, 0.2) 70%,
			rgba(0, 0, 0, 0) 85%
		);
		mask-image: linear-gradient(
			to right,
			rgba(0, 0, 0, 1) 0%,
			rgba(0, 0, 0, 1) 30%,
			rgba(0, 0, 0, 0.6) 50%,
			rgba(0, 0, 0, 0.2) 70%,
			rgba(0, 0, 0, 0) 85%
		);
	}

	.nebula-waves-svg {
		position: absolute;
		left: -120px;
		top: 0;
		width: calc(100% + 240px);
		height: 100%;
		mix-blend-mode: screen;
		/* PERF: Animate the entire SVG container instead of individual filtered
		   elements. The GPU transforms the cached raster bitmap (near-zero cost)
		   instead of recomputing 8 SVG filter chains per frame. */
		will-change: transform;
		animation: nebula-container-drift 38s ease-in-out infinite;
	}

	/*
	 * PERF: Individual nebula-cloud and nebula-glow elements are NO LONGER
	 * animated. SVG filters (feTurbulence + feDisplacementMap + feGaussianBlur)
	 * are extremely expensive to recompute per-frame on the CPU.
	 *
	 * Instead, the entire SVG container (.nebula-waves-svg) is animated as one
	 * unit. The browser rasterizes the filtered SVG ONCE, caches the bitmap,
	 * and the GPU simply transforms the cached texture each frame.
	 *
	 * This eliminates ~480 filter recomputations/sec (8 filters × 60fps)
	 * and replaces them with a single GPU-composited transform.
	 */
	.nebula-cloud {
		/* Static - no animation; filters render once and are cached */
		transform-origin: center center;
	}

	/* Glowing ellipses are also static - part of the cached SVG bitmap */
	.nebula-glow {
		/* No animation - rendered once with filter and cached */
		transform-origin: center center;
	}

	/* Container-level drift animation replaces per-element nebula animations */
	@keyframes nebula-container-drift {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		25% {
			transform: translate(15px, -20px) scale(1.04);
		}
		50% {
			transform: translate(-10px, -28px) scale(0.97);
		}
		75% {
			transform: translate(20px, -12px) scale(1.02);
		}
	}

	/* Stars within nebula */
	.nebula-star {
		position: absolute;
		width: 4px;
		height: 4px;
		background: var(--color-text);
		border-radius: 50%;
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-text) 90%, transparent);
		animation: nebula-star-twinkle 3s ease-in-out infinite;
		z-index: 1;
		will-change: transform, opacity;
	}

	.nebula-star.small {
		width: 2.5px;
		height: 2.5px;
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--color-text) 80%, transparent);
	}

	.nebula-star.large {
		width: 5px;
		height: 5px;
		box-shadow: 0 0 16px 3px color-mix(in srgb, var(--color-text) 95%, transparent);
	}

	@keyframes nebula-star-twinkle {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.3);
		}
	}

	/* Enhanced Nebula clouds with layering */
	.nebula {
		position: absolute;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0.3;
		animation: float 25s ease-in-out infinite;
		will-change: transform;
	}

	.nebula-left {
		top: -5%;
		left: -15%;
		width: 600px;
		height: 700px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-secondary) 50%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 35%, transparent) 30%,
			color-mix(in srgb, var(--color-primary) 20%, transparent) 60%,
			transparent 100%
		);
	}

	.nebula-overlay {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
		will-change: transform;
	}

	.nebula-left-overlay {
		top: 5%;
		left: -5%;
		width: 400px;
		height: 500px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-secondary) 30%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 15%, transparent) 50%,
			transparent 100%
		);
		animation: float 20s ease-in-out infinite;
		animation-delay: -5s;
	}

	/* Four-pointed sparkle stars */
	.star-sparkle {
		position: absolute;
		width: 12px;
		height: 12px;
		animation: sparkle 3s ease-in-out infinite;
		will-change: transform, opacity;
	}

	.star-sparkle::before,
	.star-sparkle::after {
		content: '';
		position: absolute;
		background: var(--color-text);
		box-shadow: 0 0 8px color-mix(in srgb, var(--color-text) 80%, transparent);
	}

	.star-sparkle::before {
		width: 12px;
		height: 2px;
		top: 5px;
		left: 0;
	}

	.star-sparkle::after {
		width: 2px;
		height: 12px;
		top: 0;
		left: 5px;
	}

	.star-sparkle.large {
		width: 16px;
		height: 16px;
	}

	.star-sparkle.large::before {
		width: 16px;
		height: 2.5px;
		top: 6.75px;
		left: 0;
	}

	.star-sparkle.large::after {
		width: 2.5px;
		height: 16px;
		top: 0;
		left: 6.75px;
	}

	/* Small dot stars for depth */
	.stars-layer,
	.stars-layer-2 {
		position: absolute;
		width: 100%;
		height: 100%;
		background-image:
			radial-gradient(
				2px 2px at 15% 20%,
				color-mix(in srgb, var(--color-text) 80%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 40% 15%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 65% 25%,
				color-mix(in srgb, var(--color-text) 70%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 80% 35%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 25% 45%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				2px 2px at 90% 50%,
				color-mix(in srgb, var(--color-text) 70%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 35% 60%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 70% 70%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 20% 80%,
				color-mix(in srgb, var(--color-text) 80%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 55% 85%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			);
		background-size: 100% 100%;
		animation: twinkle 4s ease-in-out infinite;
	}

	.stars-layer-2 {
		animation-delay: -2s;
		opacity: 0.7;
	}

	/* Chat bubble decoration */

	/* Planets with enhanced realism */
	.planet {
		position: absolute;
		border-radius: 50%;
		will-change: transform;
	}

	.planet-left {
		top: 10%;
		left: 3%;
		width: 180px;
		height: 180px;
		background: radial-gradient(
			circle at 30% 30%,
			color-mix(in srgb, var(--color-secondary) 40%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 50%, transparent) 25%,
			color-mix(in srgb, var(--color-secondary) 60%, transparent) 50%,
			color-mix(in srgb, var(--color-secondary) 40%, transparent) 100%
		);
		box-shadow:
			inset -25px -25px 50px color-mix(in srgb, var(--color-background) 50%, transparent),
			0 0 40px color-mix(in srgb, var(--color-secondary) 30%, transparent);
		animation: float 30s ease-in-out infinite;
		filter: blur(0.5px);
	}

	.planet-right {
		bottom: 8%;
		right: 2%;
		width: 240px;
		height: 240px;
		background: radial-gradient(
			circle at 35% 35%,
			color-mix(in srgb, var(--color-error) 30%, transparent) 0%,
			color-mix(in srgb, var(--color-error) 40%, transparent) 20%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 40%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 60%,
			color-mix(in srgb, var(--color-error) 40%, transparent) 100%
		);
		box-shadow:
			inset -35px -35px 70px color-mix(in srgb, var(--color-background) 60%, transparent),
			0 0 50px color-mix(in srgb, var(--color-error) 25%, transparent);
		animation: float 35s ease-in-out infinite reverse;
		filter: blur(0.5px);
	}

	/* Comet/shooting star effect */
	.comet {
		position: absolute;
		top: 30%;
		right: 20%;
		width: 3px;
		height: 3px;
		background: var(--color-text);
		border-radius: 50%;
		box-shadow: 0 0 10px 2px color-mix(in srgb, var(--color-text) 80%, transparent);
		animation: comet 8s linear infinite;
		opacity: 0;
		will-change: transform, opacity;
	}

	.comet::after {
		content: '';
		position: absolute;
		top: 0;
		right: 3px;
		width: 100px;
		height: 2px;
		background: linear-gradient(to left, var(--color-text), transparent);
		opacity: 0.7;
	}

	/* Content */
	.container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
	}

	.hero-content {
		position: relative;
		text-align: center;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 2;
	}

	.hero-content.mounted {
		opacity: 1;
		transform: translateY(0);
	}

	/* A scrim between the nebula and the copy. The artwork is painted from the
	   brand accent, which is a mid-luminance coral — close enough to the body
	   text that on a phone, where the nebula fills the whole viewport, the two
	   cancelled out. This keeps the hero readable however loud the art gets,
	   in either theme, instead of tuning opacities per breakpoint forever. */
	.hero-content::before {
		content: '';
		position: absolute;
		inset: -6% -10%;
		z-index: -1;
		border-radius: 50%;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-background) 88%, transparent) 0%,
			color-mix(in srgb, var(--color-background) 66%, transparent) 45%,
			transparent 78%
		);
		filter: blur(24px);
		pointer-events: none;
	}

	.main-title {
		font-size: 3.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
		letter-spacing: -0.03em;
		text-shadow: 0 2px 20px color-mix(in srgb, var(--color-secondary) 30%, transparent);
	}

	@media (min-width: 768px) {
		.main-title {
			font-size: 5.5rem;
		}
	}

	@media (min-width: 1024px) {
		.main-title {
			font-size: 7rem;
		}
	}

	.subtitle {
		max-width: 42rem;
		margin: 0 auto var(--spacing-2xl);
		font-size: 1.125rem;
		color: var(--color-text);
		line-height: 1.7;
		font-weight: 400;
		opacity: 0.88;
	}

	@media (min-width: 768px) {
		.subtitle {
			font-size: 1.35rem;
			margin-bottom: 3rem;
		}
	}

	.hero-tagline {
		margin: calc(var(--spacing-lg) * -0.5) 0 var(--spacing-lg);
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--color-text);
	}

	@media (min-width: 768px) {
		.hero-tagline {
			font-size: 1.7rem;
		}
	}

	.hero-count {
		margin-bottom: var(--spacing-lg);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-2xl);
	}

	/* Discord's own blurple, not a theme token — people recognise the button
	   before they read it, and it has to look the same in both themes. */
	.hero-join {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1.6rem;
		border-radius: var(--radius-md);
		background: #5865f2;
		color: #ffffff;
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		box-shadow: 0 8px 24px color-mix(in srgb, #5865f2 35%, transparent);
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.hero-join:hover,
	.hero-join:focus-visible {
		background: #4752c4;
		transform: translateY(-2px);
	}

	.hero-secondary {
		display: inline-flex;
		align-items: center;
		padding: 0.85rem 1.6rem;
		border: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-surface) 55%, transparent);
		backdrop-filter: blur(12px);
		color: var(--color-text);
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}

	.hero-secondary:hover,
	.hero-secondary:focus-visible {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
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

	/* Closing pair: sister spaces, and the ask */
	.closing {
		padding: var(--spacing-2xl) var(--spacing-md) calc(var(--spacing-2xl) * 1.5);
		background: var(--color-background);
	}

	.closing-shell {
		display: grid;
		gap: var(--spacing-lg);
		max-width: var(--layout-feature-grid-max-width);
		margin: 0 auto;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
	}

	.closing-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-sm);
		padding: var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
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

	.closing-link {
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: none;
	}

	.closing-link:hover,
	.closing-link:focus-visible {
		text-decoration: underline;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-join:hover,
		.hero-join:focus-visible {
			transform: none;
		}
	}

	/* Command Palette - Enhanced glass morphism */
	.command-palette {
		background: color-mix(in srgb, var(--color-surface) 50%, transparent);
		backdrop-filter: blur(24px);
		border: 1px solid color-mix(in srgb, var(--color-secondary) 25%, transparent);
		border-radius: 20px;
		padding: var(--spacing-lg);
		max-width: 720px;
		margin: 0 auto;
		box-shadow:
			0 24px 80px color-mix(in srgb, var(--color-background) 60%, transparent),
			0 0 0 1px color-mix(in srgb, var(--color-text) 5%, transparent) inset;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		background: color-mix(in srgb, var(--color-surface) 70%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-secondary) 15%, transparent);
		border-radius: 12px;
		padding: var(--spacing-md) var(--spacing-lg);
		margin-bottom: var(--spacing-md);
		transition: all var(--transition-base);
		min-width: 0;
		overflow: hidden;
	}

	.search-box:focus-within {
		border-color: color-mix(in srgb, var(--color-secondary) 40%, transparent);
		background: color-mix(in srgb, var(--color-surface) 85%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary) 10%, transparent);
	}

	.search-icon {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.search-box input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text);
		font-size: 0.875rem;
		outline: none;
		font-weight: 400;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search-box input::placeholder {
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Command Options */
	.command-options {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.command-option {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 10px;
		padding: var(--spacing-md) var(--spacing-lg);
		color: var(--color-text);
		text-align: left;
		font-size: 0.875rem;
		font-weight: 400;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		min-width: 0;
		flex-wrap: nowrap;
		overflow: hidden;
	}

	.command-option:hover,
	.command-option.focused {
		background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
		border-color: color-mix(in srgb, var(--color-secondary) 30%, transparent);
		transform: translateX(2px);
	}

	.command-option:active {
		transform: translateX(2px) scale(0.98);
	}

	.option-icon {
		color: var(--color-text-secondary);
		flex-shrink: 0;
		transition: color var(--transition-fast);
	}

	.command-option:hover .option-icon,
	.command-option.focused .option-icon {
		color: var(--color-text);
	}

	.command-option span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* AI Indicator - Enhanced styling */
	.command-option.ask {
		position: relative;
	}

	.ai-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		min-width: 40px;
		flex-shrink: 0;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-secondary) 80%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 80%, transparent) 100%
		);
		border-radius: 10px;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--color-secondary) 30%, transparent);
		transition: all var(--transition-fast);
	}

	.command-option.ask:hover .ai-indicator,
	.command-option.ask.focused .ai-indicator {
		background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%);
		box-shadow: 0 6px 20px color-mix(in srgb, var(--color-secondary) 50%, transparent);
		transform: scale(1.05);
	}

	.ai-indicator svg {
		width: 22px;
		height: 22px;
		color: var(--color-background);
	}

	.bar {
		animation: pulse 1.4s ease-in-out infinite;
		transform-origin: center bottom;
	}

	.bar-1 {
		animation-delay: 0s;
	}

	.bar-2 {
		animation-delay: 0.2s;
	}

	.bar-3 {
		animation-delay: 0.4s;
	}

	/* Animations */
	@keyframes float {
		0%,
		100% {
			transform: translateY(0) translateX(0) rotate(0deg);
		}
		33% {
			transform: translateY(-25px) translateX(15px) rotate(2deg);
		}
		66% {
			transform: translateY(-10px) translateX(-10px) rotate(-2deg);
		}
	}

	@keyframes sparkle {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(0.8) rotate(0deg);
		}
		50% {
			opacity: 1;
			transform: scale(1) rotate(180deg);
		}
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.9;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scaleY(1);
		}
		50% {
			opacity: 0.5;
			transform: scaleY(0.5);
		}
	}

	@keyframes comet {
		0% {
			opacity: 0;
			transform: translate(0, 0);
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-400px, 400px);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.hero {
			padding: var(--spacing-xl) var(--spacing-md);
		}

		.main-title {
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 0.938rem;
			margin-bottom: var(--spacing-xl);
		}

		.nebula-flow-left {
			opacity: 0.38;
		}

		.nebula-waves-svg {
			left: -80px;
			width: calc(100% + 160px);
		}

		.planet-left {
			width: 120px;
			height: 120px;
			left: -5%;
			top: 5%;
		}

		.planet-right {
			width: 160px;
			height: 160px;
			right: -5%;
		}

		.nebula-left {
			width: 400px;
			height: 450px;
		}

		.nebula-left-overlay {
			width: 300px;
			height: 350px;
		}

		.star-sparkle {
			width: 10px;
			height: 10px;
		}

		.star-sparkle::before {
			width: 10px;
			height: 1.5px;
			top: 4.25px;
		}

		.star-sparkle::after {
			width: 1.5px;
			height: 10px;
			left: 4.25px;
		}

		.star-sparkle.large {
			width: 12px;
			height: 12px;
		}

		.star-sparkle.large::before {
			width: 12px;
			height: 2px;
			top: 5px;
		}

		.star-sparkle.large::after {
			width: 2px;
			height: 12px;
			left: 5px;
		}

		.command-palette {
			padding: var(--spacing-md);
			max-width: 90%;
		}

		.search-box {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.search-box input {
			font-size: 0.938rem;
		}

		.command-option {
			padding: var(--spacing-sm) var(--spacing-md);
			font-size: 0.875rem;
		}

		.ai-indicator {
			width: 36px;
			height: 36px;
		}

		.ai-indicator svg {
			width: 20px;
			height: 20px;
		}
	}

	@media (max-width: 480px) {
		.main-title {
			font-size: 2rem;
		}

		.subtitle {
			font-size: 0.875rem;
			line-height: 1.6;
		}

		.command-palette {
			padding: var(--spacing-sm);
			border-radius: 16px;
		}

		.search-box {
			padding: var(--spacing-xs) var(--spacing-sm);
			border-radius: 10px;
		}

		.search-box input {
			font-size: 0.875rem;
		}

		.search-icon {
			width: 16px;
			height: 16px;
		}

		.command-option {
			padding: var(--spacing-xs) var(--spacing-sm);
			font-size: 0.813rem;
			gap: var(--spacing-sm);
		}

		.option-icon {
			width: 16px;
			height: 16px;
		}

		.ai-indicator {
			width: 32px;
			height: 32px;
		}

		.ai-indicator svg {
			width: 18px;
			height: 18px;
		}

		.nebula-flow-left {
			opacity: 0.34;
		}

		.nebula-waves-svg {
			left: -60px;
			width: calc(100% + 120px);
		}

		.comet {
			display: none;
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
