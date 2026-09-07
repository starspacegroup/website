import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import type { GuildDirectory } from '$lib/server/guild-directory';

/**
 * The page itself. Locally there is no SpaceBot key, so the running site only
 * ever shows the fallback — these cover the populated states it cannot reach.
 */

const directory = (over: Partial<GuildDirectory> = {}): GuildDirectory => ({
	available: true,
	syncedAt: '2026-09-07 12:00:00',
	categories: [
		{
			name: 'Lobby',
			channels: [
				{ id: '1', name: 'general', type: 'text', topic: 'Say hello' },
				{ id: '2', name: 'ten-forward', type: 'voice', topic: null }
			]
		}
	],
	commands: [
		{ name: 'help', description: 'Get help', builtIn: true, options: [] },
		{ name: 'welcome', description: 'Greet somebody', builtIn: false, options: ['member'] }
	],
	...over
});

const draw = (over: Partial<GuildDirectory> = {}) =>
	render(Page, { props: { data: { directory: directory(over) } } });

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

		const withRoom = render(Page, {
			props: {
				data: {
					directory: directory({
						commands: [
							{ name: 'room', description: 'Make a room of your own', builtIn: true, options: [] }
						]
					})
				}
			}
		});
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

	it('always offers the way in', () => {
		draw();
		const joins = screen.getAllByRole('link', { name: /join on discord/i });
		expect(joins.length).toBeGreaterThan(0);
		expect(joins[0].getAttribute('href')).toContain('discord');
	});
});
