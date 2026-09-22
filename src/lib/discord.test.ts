import { describe, expect, it, vi } from 'vitest';
import {
	DISCORD_INVITE,
	DISCORD_INVITE_API,
	DISCORD_INVITE_CODE,
	discordAvatarUrl,
	fetchGuildCounts
} from './discord';

/** A `Response`-shaped stub — only the two members fetchGuildCounts reads. */
const answer = (body: unknown, ok = true, status = 200) =>
	({ ok, status, json: async () => body }) as Response;

describe('Discord invite constants', () => {
	it('derives the invite and API urls from one code', () => {
		expect(DISCORD_INVITE).toBe(`https://discord.gg/${DISCORD_INVITE_CODE}`);
		expect(DISCORD_INVITE_API).toContain(DISCORD_INVITE_CODE);
	});

	it('pins the API to a version and asks for counts', () => {
		expect(DISCORD_INVITE_API).toContain('/api/v10/');
		expect(DISCORD_INVITE_API).toContain('with_counts=true');
	});
});

describe('fetchGuildCounts', () => {
	it('reads members and presence from the invite endpoint', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				answer({ approximate_member_count: 1234, approximate_presence_count: 87 })
			);

		await expect(fetchGuildCounts(fetcher as unknown as typeof fetch)).resolves.toEqual({
			members: 1234,
			online: 87
		});
		expect(fetcher).toHaveBeenCalledWith(DISCORD_INVITE_API);
	});

	it('keeps the member count when presence is missing', async () => {
		const fetcher = vi.fn().mockResolvedValue(answer({ approximate_member_count: 10 }));

		await expect(fetchGuildCounts(fetcher as unknown as typeof fetch)).resolves.toEqual({
			members: 10,
			online: null
		});
	});

	it('ignores a presence value that is not a number', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				answer({ approximate_member_count: 10, approximate_presence_count: 'lots' })
			);

		await expect(fetchGuildCounts(fetcher as unknown as typeof fetch)).resolves.toEqual({
			members: 10,
			online: null
		});
	});

	it('throws on a non-ok response rather than rendering a blank count', async () => {
		const fetcher = vi.fn().mockResolvedValue(answer({}, false, 429));

		await expect(fetchGuildCounts(fetcher as unknown as typeof fetch)).rejects.toThrow(
			'Discord answered 429'
		);
	});

	// A revoked invite still answers 200 with JSON — just without the count.
	it('throws when a 200 carries no member count', async () => {
		const fetcher = vi.fn().mockResolvedValue(answer({ code: 'xsQC6URzyQ' }));

		await expect(fetchGuildCounts(fetcher as unknown as typeof fetch)).rejects.toThrow(
			'no member count'
		);
	});
});

describe('discordAvatarUrl', () => {
	const USER = '123456789012345678';

	it('serves the account own picture', () => {
		expect(discordAvatarUrl(USER, 'abc123')).toBe(
			`https://cdn.discordapp.com/avatars/${USER}/abc123.png?size=128`
		);
	});

	it('asks for the gif of an animated avatar, not the still frame', () => {
		expect(discordAvatarUrl(USER, 'a_abc123')).toContain('a_abc123.gif');
	});

	it('takes the size it is given', () => {
		expect(discordAvatarUrl(USER, 'abc123', 256)).toContain('size=256');
	});

	it('falls back to the default Discord picked for that account', () => {
		// Same snowflake, same default, every time — it is a function of the id.
		const first = discordAvatarUrl(USER, null);
		expect(first).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
		expect(discordAvatarUrl(USER, undefined)).toBe(first);
		expect(discordAvatarUrl(USER, '')).toBe(first);
	});

	it('is null for an id that is not a snowflake', () => {
		// It goes straight into an `<img src>`, so a value this site did not write
		// does not get to build a URL.
		for (const id of ['', 'not-an-id', '../../admin', '1'.repeat(40)]) {
			expect(discordAvatarUrl(id, 'abc123')).toBeNull();
		}
	});

	it('is null for a hash that is not a hash', () => {
		for (const hash of ['../evil', 'a/b', 'x?y=z', 'a'.repeat(80)]) {
			expect(discordAvatarUrl(USER, hash)).toBeNull();
		}
	});
});
