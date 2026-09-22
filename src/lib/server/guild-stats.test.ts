import { describe, expect, it, vi } from 'vitest';
import { EMPTY_STATS, STATS_DAYS, fetchGuildStats } from './guild-stats';

/**
 * Reading the server's own figures off SpaceBot.
 *
 * The rule the whole module is built around: **a zero on a stats page is a
 * claim**. Every failure has to land on `available: false` so the page can say
 * the figures are missing, rather than on a well-formed object full of zeroes
 * that reads as a dead server.
 */

const ok = (body: unknown) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

const config = { apiUrl: 'https://bot.test', apiKey: 'sb_live_abc' };

const day = (over: Record<string, unknown> = {}) => ({
	period_start: '2026-09-20 00:00:00',
	period_end: '2026-09-21 00:00:00',
	member_joins: 4,
	member_leaves: 1,
	member_net_change: 3,
	message_count: 210,
	message_unique_users: 9,
	voice_total_seconds: 7200,
	voice_unique_users: 5,
	voice_peak_concurrent: 3,
	...over
});

const snapshot = (over: Record<string, unknown> = {}) => ({
	member_count: 120,
	online_count: 18,
	bot_count: 4,
	channel_count: 22,
	role_count: 9,
	emoji_count: 30,
	boost_count: 2,
	boost_level: 1,
	recorded_at: '2026-09-21 06:00:00',
	...over
});

describe('fetchGuildStats', () => {
	it('reads the snapshot and the daily rows', async () => {
		const fetcher = ok({ current: snapshot(), daily_stats: [day()] });
		const stats = await fetchGuildStats(config, fetcher);

		expect(stats.available).toBe(true);
		expect(stats.snapshot).toEqual({
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
		});
		expect(stats.days).toEqual([
			{
				day: '2026-09-20',
				joins: 4,
				leaves: 1,
				netChange: 3,
				messages: 210,
				posters: 9,
				voiceSeconds: 7200,
				voicePeople: 5,
				voicePeak: 3
			}
		]);
	});

	it('asks for the window it can actually get, with the key on the header', async () => {
		const fetcher = ok({ current: null, daily_stats: [] });
		await fetchGuildStats(config, fetcher);

		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`https://bot.test/api/v1/stats?days=${STATS_DAYS}`);
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sb_live_abc');
	});

	it('trims a trailing slash off the origin rather than doubling it', async () => {
		const fetcher = ok({ current: null, daily_stats: [] });
		await fetchGuildStats({ ...config, apiUrl: 'https://bot.test/' }, fetcher);
		const [url] = fetcher.mock.calls[0] as unknown as [string];
		expect(url).toContain('https://bot.test/api/v1/stats');
	});

	it('sorts days oldest first, however SpaceBot ordered them', async () => {
		const fetcher = ok({
			current: null,
			daily_stats: [
				day({ period_start: '2026-09-20 00:00:00' }),
				day({ period_start: '2026-09-18 00:00:00' }),
				day({ period_start: '2026-09-19 00:00:00' })
			]
		});
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.days.map((d) => d.day)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20']);
	});

	it('keeps one row per day when a day repeats', async () => {
		const fetcher = ok({
			current: null,
			daily_stats: [day({ message_count: 1 }), day({ message_count: 99 })]
		});
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.days).toHaveLength(1);
		expect(stats.days[0].messages).toBe(99);
	});

	it('drops a row that is not a day', async () => {
		const fetcher = ok({
			current: null,
			daily_stats: [day(), { period_start: 'sometime' }, null, 'nope', day({ period_start: null })]
		});
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.days).toHaveLength(1);
	});

	it('lets net change be negative, and never lets a count be', async () => {
		const fetcher = ok({
			current: null,
			daily_stats: [day({ member_net_change: -6, message_count: -3, voice_total_seconds: 'x' })]
		});
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.days[0].netChange).toBe(-6);
		expect(stats.days[0].messages).toBe(0);
		expect(stats.days[0].voiceSeconds).toBe(0);
	});

	it('reads an unusable net change as flat, and a blank timestamp as none', async () => {
		const fetcher = ok({
			current: snapshot({ recorded_at: '   ', online_count: 'lots' }),
			daily_stats: [day({ member_net_change: 'sideways' })]
		});
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.days[0].netChange).toBe(0);
		expect(stats.snapshot?.recordedAt).toBeNull();
		// A figure that will not parse is absent, not zero. "0 online" on a live
		// server is a worse answer than no answer.
		expect(stats.snapshot?.online).toBeNull();
	});

	it('reports people as unknown rather than guessed when the bot count is missing', async () => {
		const fetcher = ok({ current: snapshot({ bot_count: null }), daily_stats: [] });
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.snapshot?.bots).toBeNull();
		expect(stats.snapshot?.humans).toBeNull();
		expect(stats.snapshot?.members).toBe(120);
	});

	it('never prints a negative population from a snapshot that disagrees with itself', async () => {
		const fetcher = ok({ current: snapshot({ member_count: 3, bot_count: 10 }), daily_stats: [] });
		const stats = await fetchGuildStats(config, fetcher);
		expect(stats.snapshot?.humans).toBe(0);
	});

	it('treats a snapshot with no member count as no snapshot', async () => {
		for (const current of [{ online_count: 4 }, null, 'nope', 42]) {
			const fetcher = ok({ current, daily_stats: [day()] });
			const stats = await fetchGuildStats(config, fetcher);
			// The days still came through — half a page beats an error page.
			expect(stats.snapshot).toBeNull();
			expect(stats.available).toBe(true);
			expect(stats.days).toHaveLength(1);
		}
	});

	it('is unavailable without a key or a url', async () => {
		const fetcher = ok({ current: snapshot(), daily_stats: [] });
		expect(await fetchGuildStats({}, fetcher)).toEqual(EMPTY_STATS);
		expect(await fetchGuildStats({ apiUrl: 'https://bot.test' }, fetcher)).toEqual(EMPTY_STATS);
		expect(await fetchGuildStats({ apiKey: 'sb_live_abc' }, fetcher)).toEqual(EMPTY_STATS);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('is unavailable when SpaceBot refuses, is unreachable, or answers nonsense', async () => {
		const refused = vi.fn(async () => new Response('no', { status: 403 }));
		expect(await fetchGuildStats(config, refused)).toEqual(EMPTY_STATS);

		const unreachable = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		});
		expect(await fetchGuildStats(config, unreachable)).toEqual(EMPTY_STATS);

		const garbage = vi.fn(async () => new Response('<html>', { status: 200 }));
		expect(await fetchGuildStats(config, garbage)).toEqual(EMPTY_STATS);
	});

	it('answers available with nothing in it when SpaceBot has no rows yet', async () => {
		const fetcher = ok({ current: null, daily_stats: 'not an array' });
		const stats = await fetchGuildStats(config, fetcher);
		// Available and empty is a real state — a freshly connected bot — and it
		// is not the same as a failed read.
		expect(stats).toEqual({ snapshot: null, days: [], available: true });
	});
});
