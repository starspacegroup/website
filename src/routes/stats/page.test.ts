import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import type { GuildStats } from '$lib/server/guild-stats';
import type { MemberProfile } from '$lib/server/member-profile';
import { UNAVAILABLE_PROFILE } from '$lib/server/member-profile';

/**
 * The four states of `/stats`, which is really one public page plus one panel
 * that four different people should see four different things in place of.
 *
 * The invariant worth pinning: a visitor who is not signed in, or is not in the
 * Discord server, still gets the whole public page — the sign-in is an offer,
 * never a wall.
 */

const day = (over: Record<string, number | string> = {}) => ({
	day: '2026-09-20',
	joins: 4,
	leaves: 1,
	netChange: 3,
	messages: 210,
	posters: 9,
	voiceSeconds: 7200,
	voicePeople: 5,
	voicePeak: 3,
	...over
});

const stats = (over: Partial<GuildStats> = {}): GuildStats => ({
	available: true,
	snapshot: {
		members: 120,
		online: 18,
		bots: 4,
		humans: 116,
		channels: 22,
		roles: 9,
		emoji: 30,
		boosts: 2,
		boostLevel: 1,
		recordedAt: '2026-09-21 06:00:00'
	},
	days: [day({ day: '2026-09-19' }), day()],
	...over
});

const member = (over: Partial<MemberProfile> = {}): MemberProfile => ({
	...UNAVAILABLE_PROFILE,
	available: true,
	member: true,
	joinedAt: '2026-01-04 12:00:00',
	unrecordedChannels: 0,
	activity: {
		messages: 12,
		channels: 3,
		lastMessageAt: '2026-09-20 10:00:00',
		voiceSeconds: 7200,
		voiceSessions: 4,
		voiceChannels: 2,
		lastVoiceAt: '2026-09-19 22:00:00',
		commands: 7
	},
	recorded: {
		messages: 40,
		channels: 5,
		lastMessageAt: '2026-09-20 10:00:00',
		voiceSeconds: 36000,
		voiceSessions: 11,
		voiceChannels: 3,
		lastVoiceAt: '2026-09-19 22:00:00',
		commands: 20
	},
	standing: { messageRank: 4, messagePopulation: 37, voiceRank: 2, voicePopulation: 11 },
	...over
});

/** The route's PageData also carries the layout's props; this page reads none. */
const draw = (data: Record<string, unknown>) =>
	render(Page, {
		props: {
			data: {
				stats: stats(),
				profile: UNAVAILABLE_PROFILE,
				signedIn: false,
				discordLinked: false,
				...data
			}
		} as never
	});

describe('server stats', () => {
	it('gives a signed-out visitor the server figures and an offer', () => {
		draw({});

		expect(screen.getByRole('heading', { name: 'The server right now' })).toBeTruthy();
		expect(screen.getByText('116')).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'See your own figures' })).toBeTruthy();
		// An offer, not a wall: the figures are on the page above it.
		expect(screen.queryByRole('heading', { name: /^You, in the last/ })).toBeNull();
	});

	it('sends a signed-out visitor to Discord sign-in, not to a password form', () => {
		draw({});
		const link = screen.getByRole('link', { name: 'Sign in with Discord' });
		expect(link.getAttribute('href')).toBe('/api/auth/discord');
	});

	it('offers to link Discord to somebody signed in another way', () => {
		draw({ signedIn: true, discordLinked: false });

		expect(screen.getByRole('heading', { name: 'Connect your Discord account' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Connect Discord' }).getAttribute('href')).toBe(
			'/api/auth/discord?mode=link'
		);
	});

	it('invites a linked account that is not in the server', () => {
		draw({
			signedIn: true,
			discordLinked: true,
			profile: member({ member: false, joinedAt: null })
		});

		expect(screen.getByRole('heading', { name: 'You are not in the server yet' })).toBeTruthy();
		expect(screen.queryByRole('heading', { name: /^You, in the last/ })).toBeNull();
	});

	it('shows a member their own figures, with the field they are ranked in', () => {
		draw({ signedIn: true, discordLinked: true, profile: member() });

		expect(screen.getByRole('heading', { name: 'You, in the last 30 days' })).toBeTruthy();
		expect(screen.getByText('12')).toBeTruthy();
		// A rank is never printed without the size of the field it is in.
		expect(screen.getByText(/4th of 37/)).toBeTruthy();
		expect(screen.getByText(/You joined on January 4, 2026/)).toBeTruthy();
		// The offer is gone once it has been taken.
		expect(screen.queryByRole('heading', { name: 'See your own figures' })).toBeNull();
	});

	it('leaves no space in front of a comma or a full stop', () => {
		// Every composed sentence on this page was once assembled from inline
		// {#if} blocks, and Svelte collapses the newline before a block into a
		// space — so they all rendered as "3rd of 41 , ahead of 93%".
		const { container } = draw({ signedIn: true, discordLinked: true, profile: member() });
		// Normalised, because textContent also runs separate <p>s together and a
		// gap between two of those is not a gap inside a sentence.
		const text = (container.textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain('4th of 37 who posted, ahead of 89%.');
		expect(text).toContain('40 messages, and 10 hours in voice.');
		expect(text).toContain('From the most recent snapshot, taken');
		expect(text).not.toMatch(/ [,.]/);
	});

	it('stops offering the sign-in to somebody who has taken it', () => {
		const { container } = draw({ signedIn: true, discordLinked: true, profile: member() });
		expect(container.textContent).not.toMatch(/Sign in with Discord to see your own figures/);
	});

	it('says which channels are not counted, rather than reporting a low total', () => {
		draw({ signedIn: true, discordLinked: true, profile: member({ unrecordedChannels: 2 }) });
		expect(screen.getByText(/2 channels in the server are not logged at all/)).toBeTruthy();
	});

	it('explains itself when SpaceBot cannot be reached', () => {
		draw({ stats: stats({ available: false, snapshot: null, days: [] }) });

		expect(screen.getByRole('heading', { name: /figures are not available/ })).toBeTruthy();
		// Never a wall of zeroes: a zero on a stats page is a claim.
		expect(screen.queryByRole('heading', { name: 'The server right now' })).toBeNull();
	});

	it('keeps a member own panel when only the server figures failed', () => {
		draw({
			signedIn: true,
			discordLinked: true,
			profile: member(),
			stats: stats({ available: false, snapshot: null, days: [] })
		});

		expect(screen.getByRole('heading', { name: 'You, in the last 30 days' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: /figures are not available/ })).toBeTruthy();
	});

	it('labels the window by the days it has, not the days it asked for', () => {
		draw({ stats: stats({ days: [day({ day: '2026-09-19' }), day()] }) });
		expect(screen.getByRole('heading', { name: 'The last 2 days' })).toBeTruthy();
	});

	it('says members rather than people when the bot count is unknown', () => {
		draw({
			stats: stats({
				snapshot: { ...stats().snapshot!, bots: null, humans: null }
			})
		});
		expect(screen.getByText('members')).toBeTruthy();
		expect(screen.getByText('120')).toBeTruthy();
	});
});
