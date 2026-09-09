import { describe, expect, it, vi } from 'vitest';
import {
	DIRECTORY_CACHE_SECONDS,
	EMPTY_DIRECTORY,
	fetchGuildDirectory,
	RENDERABLE_TYPES
} from './guild-directory';

/**
 * What the server guide will and will not print. The rule throughout: if
 * SpaceBot cannot say it, this site does not say it — the page never invents a
 * channel, and never renders one it cannot label.
 */

const CONFIG = { apiUrl: 'https://bot.test', apiKey: 'sb_live_abc' };

const channelsBody = (over: Record<string, unknown> = {}) => ({
	guild_id: 'g1',
	synced_at: '2026-09-07 12:00:00',
	count: 2,
	categories: [
		{
			category: 'Lobby',
			category_id: 'c1',
			channels: [
				{ id: '1', name: 'general', type: 'text', topic: 'Say hello' },
				{ id: '2', name: 'ten-forward', type: 'voice', topic: null }
			]
		}
	],
	...over
});

const commandsBody = (over: Record<string, unknown> = {}) => ({
	guild_id: 'g1',
	total: 2,
	commands: [
		{ name: 'help', description: 'Get help', is_built_in: true, options: [] },
		{
			name: 'room',
			description: 'Make a room of your own',
			is_built_in: true,
			options: [{ name: 'preset' }, { name: 'name' }]
		}
	],
	...over
});

/** A fetch that answers each SpaceBot path from a map. */
function fetcherFor(routes: Record<string, unknown | Response>) {
	return vi.fn(async (url: string | URL) => {
		const path = new URL(String(url)).pathname;
		const answer = routes[path];
		if (answer === undefined) return new Response('nope', { status: 404 });
		if (answer instanceof Response) return answer;
		return new Response(JSON.stringify(answer), { status: 200 });
	}) as unknown as typeof fetch;
}

const bothOk = () =>
	fetcherFor({ '/api/v1/channels': channelsBody(), '/api/v1/commands': commandsBody() });

describe('fetchGuildDirectory', () => {
	it('reads channels and commands from SpaceBot', async () => {
		const directory = await fetchGuildDirectory(CONFIG, bothOk());

		expect(directory.available).toBe(true);
		expect(directory.syncedAt).toBe('2026-09-07 12:00:00');
		expect(directory.categories).toHaveLength(1);
		expect(directory.categories[0].name).toBe('Lobby');
		expect(directory.categories[0].channels.map((c) => c.name)).toEqual(['general', 'ten-forward']);
		expect(directory.commands.map((c) => c.name)).toEqual(['help', 'room']);
	});

	it('sends the key as a bearer token and asks for JSON', async () => {
		const fetcher = bothOk();
		await fetchGuildDirectory(CONFIG, fetcher);

		const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init.headers.Authorization).toBe('Bearer sb_live_abc');
		expect(init.headers.accept).toBe('application/json');
	});

	it('carries a command’s parameter names, in order', async () => {
		const directory = await fetchGuildDirectory(CONFIG, bothOk());
		const room = directory.commands.find((command) => command.name === 'room');
		expect(room?.options).toEqual(['preset', 'name']);
		expect(room?.builtIn).toBe(true);
	});

	/**
	 * The live server guide listed /promote and /spam — moderator tools — next
	 * to a /test and a /testing left half-finished behind an admin permission.
	 * SpaceBot already recorded why none of them belonged there; the page just
	 * was not reading it.
	 */
	describe('what a member can actually type', () => {
		const only = async (commands: unknown[]) => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody(),
					'/api/v1/commands': commandsBody({ commands })
				})
			);
			return directory.commands.map((command) => command.name);
		};

		it('drops a command nobody is allowed to run', async () => {
			// 8192 is Manage Messages — /promote and /spam, verbatim.
			expect(
				await only([
					{ name: 'voice-ping', description: 'Ping the channel', default_member_permissions: null },
					{
						name: 'promote',
						description: 'Add the Passenger role',
						default_member_permissions: '8192'
					},
					{ name: 'spam', description: 'Time out a spammer', default_member_permissions: 8192 }
				])
			).toEqual(['voice-ping']);
		});

		it("treats '0' as the strictest setting, not the loosest", async () => {
			// Discord reads '0' as "nobody by default until an admin grants it".
			// Read as a falsy bitfield it would look like no restriction at all.
			expect(
				await only([{ name: 'test', description: 'Say hi', default_member_permissions: '0' }])
			).toEqual([]);
		});

		it('drops a disabled command, however it is spelled', async () => {
			// SQLite sends 0; a merged built-in override sends false.
			expect(
				await only([
					{ name: 'ping', description: 'Check the bot', enabled: 0 },
					{ name: 'info', description: 'Bot information', enabled: false },
					{ name: 'stats', description: 'Server stats', enabled: 1 }
				])
			).toEqual(['stats']);
		});

		it('keeps a command SpaceBot said nothing restrictive about', async () => {
			// An absent field is not a restriction. The page does not invent one
			// any more than it invents a command.
			expect(
				await only([
					{ name: 'love', description: 'Shows love' },
					{ name: 'verse', description: 'Generate a poem', default_member_permissions: '' }
				])
			).toEqual(['love', 'verse']);
		});
	});

	it('marks a server’s own commands as not built in', async () => {
		const directory = await fetchGuildDirectory(
			CONFIG,
			fetcherFor({
				'/api/v1/channels': channelsBody(),
				'/api/v1/commands': commandsBody({
					commands: [{ name: 'welcome', description: 'Greet somebody' }]
				})
			})
		);
		expect(directory.commands[0].builtIn).toBe(false);
		expect(directory.commands[0].options).toEqual([]);
	});

	describe('refuses to render what it cannot label', () => {
		it('drops a channel with no name or no id', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{
								category: 'Lobby',
								channels: [
									{ id: '1', name: 'general', type: 'text' },
									{ id: '2', name: '   ', type: 'text' },
									{ name: 'no id', type: 'text' }
								]
							}
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels.map((c) => c.name)).toEqual(['general']);
		});

		it('drops a channel type it has no way to draw', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{
								category: 'Lobby',
								channels: [
									{ id: '1', name: 'general', type: 'text' },
									{ id: '2', name: 'mystery', type: 'other' },
									{ id: '3', name: 'category-ish', type: 'category' }
								]
							}
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels.map((c) => c.name)).toEqual(['general']);
		});

		it('accepts every type it advertises as renderable', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{
								category: null,
								channels: RENDERABLE_TYPES.map((type, index) => ({
									id: String(index),
									name: type,
									type
								}))
							}
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels).toHaveLength(RENDERABLE_TYPES.length);
		});

		it('drops a command with no description, which a list cannot use', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody(),
					'/api/v1/commands': commandsBody({
						commands: [
							{ name: 'help', description: 'Get help' },
							{ name: 'silent' },
							{ description: 'no name' }
						]
					})
				})
			);
			expect(directory.commands.map((c) => c.name)).toEqual(['help']);
		});

		it('drops a category whose channels were all unusable', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{ category: 'Empty', channels: [{ id: '9', name: 'x', type: 'nonsense' }] },
							{ category: 'Lobby', channels: [{ id: '1', name: 'general', type: 'text' }] }
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories.map((c) => c.name)).toEqual(['Lobby']);
		});

		it('treats an empty topic as absent rather than printing a blank line', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{
								category: 'Lobby',
								channels: [{ id: '1', name: 'general', type: 'text', topic: '  ' }]
							}
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels[0].topic).toBeNull();
		});
	});

	describe('fails to nothing', () => {
		it('returns an unavailable directory with no credentials', async () => {
			const fetcher = vi.fn();
			expect(await fetchGuildDirectory({}, fetcher as unknown as typeof fetch)).toEqual(
				EMPTY_DIRECTORY
			);
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('returns an unavailable directory when SpaceBot is unreachable', async () => {
			const fetcher = vi.fn(async () => {
				throw new Error('offline');
			}) as unknown as typeof fetch;
			expect(await fetchGuildDirectory(CONFIG, fetcher)).toEqual(EMPTY_DIRECTORY);
		});

		it('returns an unavailable directory when both calls are refused', async () => {
			const directory = await fetchGuildDirectory(CONFIG, fetcherFor({}));
			expect(directory.available).toBe(false);
		});

		it('renders the half it could get when one scope is missing', async () => {
			// A key with channels:read and no commands:read is a real state, and
			// half a page beats an error page.
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody(),
					'/api/v1/commands': new Response('{"error":"Insufficient scope"}', { status: 403 })
				})
			);
			expect(directory.available).toBe(true);
			expect(directory.categories).toHaveLength(1);
			expect(directory.commands).toEqual([]);
		});

		it('survives a body that is not JSON', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': new Response('<html>', { status: 200 }),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories).toEqual([]);
			expect(directory.commands).toHaveLength(2);
		});

		it('survives a body of the wrong shape', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': { categories: 'not an array' },
					'/api/v1/commands': { commands: { nope: true } }
				})
			);
			expect(directory).toMatchObject({ available: true, categories: [], commands: [] });
		});

		it('steps over junk in the channels, commands and options arrays', async () => {
			// SpaceBot would not send these, but this layer is the reason a bad
			// deploy on the other side cannot put `null` on a public page.
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							{
								category: 'Lobby',
								channels: [null, 'nope', 7, { id: '1', name: 'general', type: 'text' }]
							}
						]
					}),
					'/api/v1/commands': commandsBody({
						commands: [
							null,
							'nope',
							{ name: 'help', description: 'Get help', options: [null, 'x', { name: 'topic' }] }
						]
					})
				})
			);

			expect(directory.categories[0].channels.map((c) => c.name)).toEqual(['general']);
			expect(directory.commands.map((c) => c.name)).toEqual(['help']);
			expect(directory.commands[0].options).toEqual(['topic']);
		});

		it('steps over a category that is not an object, or has no channels', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({
						categories: [
							null,
							'nope',
							{ category: 'Broken', channels: 'not an array' },
							{ category: 'Lobby', channels: [{ id: '1', name: 'general', type: 'text' }] }
						]
					}),
					'/api/v1/commands': commandsBody()
				})
			);

			expect(directory.categories.map((c) => c.name)).toEqual(['Lobby']);
		});

		it('still asks when the runtime has no AbortSignal.timeout', async () => {
			// Older workers runtimes have no timeout helper. Losing the deadline is
			// acceptable; refusing to make the request is not.
			const original = (AbortSignal as { timeout?: unknown }).timeout;
			try {
				delete (AbortSignal as { timeout?: unknown }).timeout;
				const directory = await fetchGuildDirectory(CONFIG, bothOk());
				expect(directory.available).toBe(true);
				expect(directory.categories).toHaveLength(1);
			} finally {
				(AbortSignal as { timeout?: unknown }).timeout = original;
			}
		});

		it('reports a null sync time rather than inventing one', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': channelsBody({ synced_at: null }),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.syncedAt).toBeNull();
		});
	});

	describe('how a channel is used', () => {
		const withActivity = (activity: unknown) =>
			channelsBody({
				activity_days: 30,
				timezone: 'America/New_York',
				categories: [
					{
						category: 'Lobby',
						category_id: 'c1',
						channels: [{ id: '1', name: 'general', type: 'text', topic: null, activity }]
					}
				]
			});

		it('asks SpaceBot for the usage window it intends to label', async () => {
			const fetcher = bothOk();
			await fetchGuildDirectory(CONFIG, fetcher);
			const asked = (fetcher as unknown as { mock: { calls: [string][] } }).mock.calls.map((call) =>
				String(call[0])
			);
			expect(asked.some((url) => url.includes('/api/v1/channels?activity=30'))).toBe(true);
		});

		it('carries the window and the server timezone the answer came with', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': withActivity({ messages: 4, posters: 2, lobby: false }),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.activityDays).toBe(30);
			expect(directory.timezone).toBe('America/New_York');
		});

		it('reads the counts a channel came with', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': withActivity({
						messages: 91,
						posters: 7,
						lastMessageAt: '2026-09-08 18:04:00',
						voiceSeconds: 17936,
						voicePeople: 3,
						voiceSessions: 12,
						typicalStaySeconds: 1495,
						busiestHourUtc: 20,
						lastVoiceAt: '2026-09-08 20:11:00',
						lobby: true
					}),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels[0].activity).toEqual({
				messages: 91,
				posters: 7,
				lastMessageAt: '2026-09-08 18:04:00',
				voiceSeconds: 17936,
				voicePeople: 3,
				voiceSessions: 12,
				typicalStaySeconds: 1495,
				busiestHourUtc: 20,
				lastVoiceAt: '2026-09-08 20:11:00',
				lobby: true
			});
		});

		it('keeps "not recorded" apart from "nothing happened"', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': withActivity({ messages: null, posters: null, lobby: false }),
					'/api/v1/commands': commandsBody()
				})
			);
			const activity = directory.categories[0].channels[0].activity;
			expect(activity?.messages).toBeNull();
			// A voice count that was simply absent is zero, which is what it means:
			// SpaceBot sends every channel, so a missing voice figure is no voice.
			expect(activity?.voiceSeconds).toBe(0);
		});

		it('says nothing about a channel SpaceBot said nothing about', async () => {
			// An older SpaceBot that never heard of `?activity` omits the field, and
			// the page must fall back to name and topic rather than to guesses.
			const directory = await fetchGuildDirectory(CONFIG, bothOk());
			expect(directory.categories[0].channels[0].activity).toBeNull();
			expect(directory.activityDays).toBeNull();
			expect(directory.timezone).toBeNull();
		});

		it('drops an hour that is not an hour', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': withActivity({ busiestHourUtc: 47, lobby: false }),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels[0].activity?.busiestHourUtc).toBeNull();
		});

		it('treats anything but true as not a lobby', async () => {
			const directory = await fetchGuildDirectory(
				CONFIG,
				fetcherFor({
					'/api/v1/channels': withActivity({ lobby: 'yes' }),
					'/api/v1/commands': commandsBody()
				})
			);
			expect(directory.categories[0].channels[0].activity?.lobby).toBe(false);
		});
	});

	it('caches for a day', () => {
		expect(DIRECTORY_CACHE_SECONDS).toBe(86_400);
	});
});
