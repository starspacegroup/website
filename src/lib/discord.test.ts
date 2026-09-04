import { describe, expect, it, vi } from 'vitest';
import {
	DISCORD_INVITE,
	DISCORD_INVITE_API,
	DISCORD_INVITE_CODE,
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
