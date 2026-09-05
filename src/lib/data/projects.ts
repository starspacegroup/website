/**
 * The project directory shown at `/projects`, and the three entries the home
 * page features.
 *
 * This is deliberately a checked-in list rather than a CMS content type: it
 * changes a few times a year, it has to render on a clone that has never been
 * pointed at a D1 database, and a pull request is a fine review step for
 * "we shipped a thing".
 */

/** A coloured pill on a project card. */
export type ProjectTag = {
	label: string;
	/** Chooses the pill's colour token; see `.tag-*` in ProjectCard.svelte. */
	tone: 'made-here' | 'stack' | 'event';
};

export type Project = {
	/** Stable id — used as the list key and in tests. */
	id: string;
	name: string;
	description: string;
	url: string;
	/** True when the link leaves this site, which decides `target`/`rel`. */
	external: boolean;
	/** Path under `static/` for the card art, if there is any. */
	screenshot?: string;
	/** Path under `static/` for a small square mark shown beside the name. */
	logo?: string;
	tags: ProjectTag[];
};

const madeHere: ProjectTag = { label: 'Made at *Space', tone: 'made-here' };
const stack = (label: string): ProjectTag => ({ label, tone: 'stack' });

/** Newest and most active first — this is the order `/projects` renders. */
export const projects: Project[] = [
	{
		id: 'game',
		name: 'Game',
		description:
			'Navigate the sphere, convert the hostile, decode the hidden pattern. An arcade puzzle game where hostile ships become allied satellites and power-ups keep you alive — alone or together in real time, with a live leaderboard. Log in with Discord to play.',
		url: 'https://game.starspace.group/',
		external: true,
		logo: '/projects/game-logo.webp',
		screenshot: '/projects/game-screenshot.webp',
		tags: [madeHere, stack('Multiplayer'), stack('WebGL')]
	},
	{
		id: 'trill-symbiont',
		name: 'Trill Symbiont',
		description:
			'A shared generative ambient music experience: a drum sequencer, physics-based visuals synced to tempo, Circle of Fifths key synchronisation, and an interactive music grid with oscillator controls and evolving patterns.',
		url: 'https://trill-symbiont.starspace.group/',
		external: true,
		screenshot: '/projects/trill-symbiont-screenshot.webp',
		tags: [madeHere, stack('Web Audio API')]
	},
	{
		id: 'nebulakit',
		name: 'NebulaKit',
		description:
			'The SvelteKit + Cloudflare starter this very site is built on. Accounts, a command palette, adaptive theming, a D1-backed CMS, AI voice and text chat, and a test suite that gates every merge.',
		url: 'https://nebulakit.starspace.group/',
		external: true,
		screenshot: '/projects/nebulakit-screenshot.webp',
		tags: [madeHere, stack('SvelteKit'), stack('Cloudflare Workers')]
	},
	{
		id: 'athena',
		name: 'Athena',
		description:
			'A governance framework for organisations built to outlast their founders. Two configurable currencies — one earned by contribution, one anchored to the treasury — separate voting power from economic value. Wrap it in a Wyoming DAO LLC, or run it purely on-chain.',
		url: 'https://athena.starspace.group/',
		external: true,
		screenshot: '/projects/athena-screenshot.webp',
		tags: [madeHere, stack('Web3')]
	},
	{
		id: 'agapeverse',
		name: 'AgapeVerse.app',
		description:
			'An AI poem studio for the moments that matter. Describe the person and the occasion, read the poem seconds later, then edit it, print it, or send it by link — and wander the wall of poems other people wrote.',
		url: 'https://agapeverse.app/',
		external: true,
		logo: '/projects/agapeverse-logo.webp',
		screenshot: '/projects/agapeverse-screenshot.webp',
		tags: [
			madeHere,
			stack('Deno Fresh'),
			stack('Deno Deploy'),
			stack('Cloudflare AI Gateway'),
			stack('OpenAI')
		]
	},
	{
		id: 'reddisco',
		name: 'Reddisco.win',
		description:
			'Posting a Discord invite to Reddit, minus the busywork. Sign in and it lists the servers you can invite to, reads the server description for a post title, offers AI edits to that title, and fills both into the subreddit you pick. It never posts for you.',
		url: 'https://reddisco.win',
		external: true,
		screenshot: '/projects/reddisco-screenshot.webp',
		tags: [
			madeHere,
			stack('SvelteKit'),
			stack('Cloudflare Pages'),
			stack('Cloudflare Workers'),
			stack('Google Gemini')
		]
	},
	{
		id: 'spacetime-clock',
		name: 'Spacetime Clock',
		description:
			'A clock that reads the day and the time as degrees of a circle (0–359): the year starts at the last summer solstice, the day starts at solar noon.',
		url: 'https://spacetime-clock.pages.dev/',
		external: true,
		screenshot: '/projects/spacetime-clock-screenshot.webp',
		tags: [
			{ label: 'Solar Hackathon 2024', tone: 'event' },
			madeHere,
			stack('SvelteKit'),
			stack('Cloudflare Pages')
		]
	},
	{
		id: 'metadock',
		name: 'MetaDock',
		description:
			'A Windows workspace manager. Tile your browsers and native apps into one saved layout across every monitor, keep a sealed profile behind each one, and bring the whole arrangement back in a click.',
		url: 'https://www.metadock.net/',
		external: true,
		logo: '/projects/metadock-logo.webp',
		screenshot: '/projects/metadock-screenshot.webp',
		tags: [stack('Windows'), stack('C++'), stack('Qt')]
	}
];

/**
 * The home page shows a short shelf rather than the whole directory. Taken from
 * the top of the same list, so a new project leads both surfaces at once.
 */
export const featuredProjects = projects.slice(0, 3);
