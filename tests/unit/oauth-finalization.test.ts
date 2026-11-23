import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/db', async () => {
	const actual =
		await vi.importActual<typeof import('../../src/lib/utils/db')>('../../src/lib/utils/db');
	return {
		...actual,
		createAuthSession: vi.fn(async (_db: unknown, user: { id: string }) => `token-for-${user.id}`),
		replaceAuthSession: vi.fn(async (_db: unknown, user: { id: string }) => `token-for-${user.id}`)
	};
});

describe('OAuth login finalization', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('crypto', webcrypto as Crypto);
		vi.stubEnv('DEV', true);
	});

	it.each([
		['owner', identity({ id: '424242', github_login: 'owner' }), { GITHUB_OWNER_ID: '424242' }, '/admin', true],
		[
			'user whose github login equals a non-numeric GITHUB_OWNER_ID',
			identity({ github_login: 'owner' }),
			{ GITHUB_OWNER_ID: 'owner' },
			'/',
			false
		],
		['admin', identity({ is_admin: 1 }), {}, '/admin', false],
		['normal user', identity(), {}, '/', false],
		[
			'standalone Discord user',
			identity({ id: 'discord_42', github_login: null }),
			{ GITHUB_OWNER_ID: '424242' },
			'/',
			false
		]
	] as const)('finalizes a %s consistently', async (_label, user, env, destination, marksOwner) => {
		const kv = kvNamespace();
		const db = userDatabase(user);
		const { finalizeOAuthLogin } = await import('../../src/lib/server/oauth-finalization');
		const response = await finalizeOAuthLogin({
			db: db as never,
			platform: { env: { DB: db, KV: kv, SESSION_SECRET: 'secret', ...env } } as never,
			url: new URL('https://example.com/callback'),
			userId: user.id
		});

		expect(response.headers.get('Location')).toBe(`https://example.com${destination}`);
		expect(response.headers.get('Set-Cookie')).toContain('session=');
		expect(kv.put).toHaveBeenCalledTimes(marksOwner ? 1 : 0);
	});

	it('marks a Discord login only when its canonical account is the configured GitHub owner', async () => {
		const kv = kvNamespace();
		const user = identity({ id: 'account-1', github_login: 'owner' });
		// users row first, then the linked github oauth_accounts row
		const db = {
			prepare: vi.fn((sql: string) => ({
				bind: vi.fn(() => ({
					first: vi
						.fn()
						.mockResolvedValue(
							sql.includes('oauth_accounts') ? { provider_account_id: '424242' } : user
						)
				}))
			}))
		};
		const { finalizeOAuthLogin } = await import('../../src/lib/server/oauth-finalization');
		const response = await finalizeOAuthLogin({
			db: db as never,
			platform: {
				env: { DB: db, KV: kv, SESSION_SECRET: 'secret', GITHUB_OWNER_ID: '424242' }
			} as never,
			url: new URL('https://example.com/callback'),
			userId: user.id
		});

		expect(response.headers.get('Location')).toBe('https://example.com/admin');
		expect(kv.put).toHaveBeenCalledWith('admin_first_login_completed', 'true');
	});

	it('uses the link-success redirect and replaces the initiating session', async () => {
		const user = identity({ is_admin: 1 });
		const db = userDatabase(user);
		const { replaceAuthSession } = await import('../../src/lib/utils/db');
		const { finalizeOAuthLogin } = await import('../../src/lib/server/oauth-finalization');
		const response = await finalizeOAuthLogin({
			db: db as never,
			platform: {
				env: { DB: db, KV: kvNamespace(), SESSION_SECRET: 'secret' }
			} as never,
			url: new URL('https://example.com/callback'),
			userId: user.id,
			currentSessionToken: 'old-token',
			linkedProvider: 'discord'
		});

		expect(response.headers.get('Location')).toBe('https://example.com/profile?linked=discord');
		expect(replaceAuthSession).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ id: user.id }),
			'old-token',
			7
		);
	});
});

function identity(overrides: Record<string, unknown> = {}) {
	return {
		id: 'user-1',
		email: 'user@example.com',
		name: 'OAuth User',
		github_login: null,
		github_avatar_url: null,
		is_admin: 0,
		...overrides
	};
}

function userDatabase(user: ReturnType<typeof identity>) {
	return {
		prepare: vi.fn(() => ({
			bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(user) }))
		}))
	};
}

function kvNamespace() {
	return {
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined)
	};
}

import '../helpers/server-response';
