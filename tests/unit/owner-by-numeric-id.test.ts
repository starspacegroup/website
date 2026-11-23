import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { numericOwnerId, resolveOwnerStatus } from '../../src/lib/utils/auth-identity';

const DISCORD_OWNER = '293484886726279168';
const GITHUB_OWNER = '1234567';

function platformWith(env: Record<string, unknown>, links: Record<string, string> = {}) {
	return {
		env: {
			...env,
			DB: {
				prepare: () => ({
					bind: (_userId: string, provider: string) => ({
						first: async () =>
							links[provider] !== undefined ? { provider_account_id: links[provider] } : null
					})
				})
			}
		}
	} as unknown as App.Platform;
}

describe('B9: owner is matched by numeric account id only', () => {
	it('a github login equal to any configured value never makes an owner', async () => {
		await fc.assert(
			fc.asyncProperty(fc.string({ minLength: 1, maxLength: 39 }), async (login) => {
				const kv = {
					get: async (k: string) =>
						k === 'github_owner_username' ? login : k === 'github_owner_id' ? null : null
				};
				const platform = platformWith({ GITHUB_OWNER_ID: login, KV: kv });
				const isOwner = await resolveOwnerStatus(platform, { id: 'user-x', github_login: login });
				// Only a purely numeric GITHUB_OWNER_ID equal to the user id may match.
				expect(isOwner).toBe(numericOwnerId(login) === 'user-x');
			})
		);
	});

	it('a Discord link matches only the exact configured snowflake', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.oneof(
					fc.stringMatching(/^\d{15,21}$/),
					fc.constantFrom(
						DISCORD_OWNER + '0',
						DISCORD_OWNER.slice(1),
						' ' + DISCORD_OWNER + 'x',
						'davis9001',
						'',
						DISCORD_OWNER.replace(/8$/, '9')
					)
				),
				async (linked) => {
					const platform = platformWith({ DISCORD_OWNER_ID: DISCORD_OWNER }, { discord: linked });
					const isOwner = await resolveOwnerStatus(platform, { id: 'u1', github_login: null });
					expect(isOwner).toBe(linked === DISCORD_OWNER);
				}
			)
		);
	});

	it('a malformed DISCORD_OWNER_ID elevates nobody', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.string().filter((s) => !/^\s*\d{15,21}\s*$/.test(s)),
				async (bad) => {
					const platform = platformWith({ DISCORD_OWNER_ID: bad }, { discord: bad });
					expect(await resolveOwnerStatus(platform, { id: bad, github_login: bad })).toBe(false);
				}
			)
		);
	});

	it('the numeric GitHub owner id still matches by user id or linked account', async () => {
		expect(
			await resolveOwnerStatus(platformWith({ GITHUB_OWNER_ID: GITHUB_OWNER }), {
				id: GITHUB_OWNER,
				github_login: 'anyone'
			})
		).toBe(true);
		expect(
			await resolveOwnerStatus(platformWith({ GITHUB_OWNER_ID: GITHUB_OWNER }, { github: GITHUB_OWNER }), {
				id: 'u2',
				github_login: null
			})
		).toBe(true);
		const kv = { get: async (k: string) => (k === 'github_owner_id' ? GITHUB_OWNER : null) };
		expect(
			await resolveOwnerStatus(platformWith({ KV: kv }, { github: GITHUB_OWNER }), {
				id: 'u3',
				github_login: null
			})
		).toBe(true);
	});
});
