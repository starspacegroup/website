import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import type { GuildDirectory } from '$lib/server/guild-directory';

/**
 * The page itself. Locally there is no SpaceBot key, so the running site only
 * ever shows the fallback — these cover the populated states it cannot reach.
 */

/** No counts at all — the state an older SpaceBot leaves the page in. */
const noActivity = null;

const directory = (over: Partial<GuildDirectory> = {}): GuildDirectory => ({
	available: true,
	syncedAt: '2026-09-07 12:00:00',
	activityDays: null,
	timezone: null,
	categories: [
		{
			name: 'Lobby',
			channels: [
				{ id: '1', name: 'general', type: 'text', topic: 'Say hello', activity: noActivity },
				{ id: '2', name: 'ten-forward', type: 'voice', topic: null, activity: noActivity }
			]
		}
	],
	commands: [
		{ name: 'help', description: 'Get help', builtIn: true, options: [] },
		{ name: 'welcome', description: 'Greet somebody', builtIn: false, options: ['member'] }
	],
	...over
});

/**
 * The route's PageData also carries the layout's `user`, `hasAIProviders` and
 * `cmsPaletteItems`. This page reads none of them, so the prop is narrowed to
 * what it actually uses rather than restated in every case.
 */
const props = (over: Partial<GuildDirectory> = {}) =>
	({ data: { directory: directory(over) } }) as never;

const draw = (over: Partial<GuildDirectory> = {}) => render(Page, { props: props(over) });

describe('server guide', () => {
	it('lists the channels under their category, with their topics', () => {
		draw();
		expect(screen.getByRole('heading', { name: /channels/i })).toBeTruthy();
		expect(screen.getByText('Lobby')).toBeTruthy();
		expect(screen.getByText('general')).toBeTruthy();
		expect(screen.getByText('Say hello')).toBeTruthy();
	});

	it('says when the channel list was last read', () => {
		draw();
		expect(screen.getByText(/last read from the server on/i)).toBeTruthy();
	});

	it('separates SpaceBot’s commands from the ones made for this server', () => {
		const { container } = draw();
		const groups = [...container.querySelectorAll('.command-group')].map((el) => el.textContent);
		expect(groups).toEqual(['SpaceBot', 'Made for this server']);
		expect(screen.getByText('/help')).toBeTruthy();
		expect(screen.getByText('member')).toBeTruthy();
	});

	it('explains how to make a room only when /room exists', () => {
		const { container } = draw();
		expect(container.textContent).not.toMatch(/Making your own room/);

		const withRoom = render(
			Page,
			props({
				commands: [
					{ name: 'room', description: 'Make a room of your own', builtIn: true, options: [] }
				]
			})
		);
		expect(withRoom.container.textContent).toMatch(/Making your own room/);
		// The privacy line is the point of the section, not a footnote.
		expect(withRoom.container.textContent).toMatch(/deliberately not listed/i);
	});

	it('says the listing is unavailable rather than rendering an empty shell', () => {
		const { container } = draw({ available: false, categories: [], commands: [], syncedAt: null });
		expect(screen.getByRole('heading', { name: /not available right now/i })).toBeTruthy();
		// Never invent a channel when SpaceBot cannot say.
		expect(container.querySelector('.channels')).toBeNull();
		expect(container.querySelector('.commands')).toBeNull();
	});

	it('omits a section it has nothing for, without failing', () => {
		const { container } = draw({ commands: [] });
		expect(container.querySelector('.channels')).toBeTruthy();
		expect(container.querySelector('.commands')).toBeNull();
	});

	/** A directory whose channels carry counts, as SpaceBot now sends them. */
	const used = () =>
		directory({
			activityDays: 30,
			timezone: 'America/New_York',
			categories: [
				{
					name: 'Lobby',
					channels: [
						{
							id: '1',
							name: 'general',
							type: 'text',
							topic: 'Say hello',
							activity: {
								messages: 91,
								posters: 7,
								lastMessageAt: '2026-09-08 18:04:00',
								voiceSeconds: 0,
								voicePeople: 0,
								voiceSessions: 0,
								typicalStaySeconds: null,
								busiestHourUtc: null,
								lastVoiceAt: null,
								lobby: false
							}
						},
						{
							id: '2',
							name: 'ten-forward',
							type: 'voice',
							topic: null,
							activity: {
								messages: 0,
								posters: 0,
								lastMessageAt: null,
								voiceSeconds: 17936,
								voicePeople: 3,
								voiceSessions: 12,
								typicalStaySeconds: 1495,
								busiestHourUtc: 0,
								lastVoiceAt: '2026-09-08 20:11:00',
								lobby: false
							}
						},
						{
							id: '3',
							name: 'The Archive',
							type: 'voice',
							topic: null,
							activity: {
								messages: 0,
								posters: 0,
								lastMessageAt: null,
								voiceSeconds: 0,
								voicePeople: 0,
								voiceSessions: 0,
								typicalStaySeconds: null,
								busiestHourUtc: null,
								lastVoiceAt: null,
								lobby: true
							}
						}
					]
				}
			]
		});

	it('says how much a text channel is used, and how a voice one is', () => {
		const { container } = render(Page, { props: { data: { directory: used() } } as never });
		const text = container.textContent ?? '';

		expect(text).toMatch(/91 messages from 7 people in the last 30 days/);
		// The voice channel has no topic at all — its line is the whole answer to
		// "what is this for", which is the reason this page reads the counts.
		expect(text).toMatch(/3 people spent 5 hours here in the last 30 days/);
		expect(text).toMatch(/A visit is usually about 25 minutes/);
		expect(text).toMatch(/Busiest around 7 PM/);
	});

	it('states outright what the lobby channel is for', () => {
		const { container } = render(Page, { props: { data: { directory: used() } } as never });
		expect(container.querySelector('.channel-purpose')?.textContent).toMatch(/room of your own/);
	});

	it('prints no numbers when SpaceBot sent none', () => {
		// An older bot, or one that lost the scope. The page falls back to names
		// and topics rather than to a confident zero.
		const { container } = draw();
		expect(container.querySelector('.channel-activity')).toBeNull();
		expect(container.textContent).not.toMatch(/last 30 days/);
	});

	it('always offers the way in', () => {
		draw();
		const joins = screen.getAllByRole('link', { name: /join on discord/i });
		expect(joins.length).toBeGreaterThan(0);
		expect(joins[0].getAttribute('href')).toContain('discord');
	});
});
