import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { MAX_ATTEMPTS, throttleStore } from '../../src/lib/server/login-throttle';
import { createSqliteD1 } from '../helpers/sqlite-d1';

vi.mock('../../src/lib/services/account-merge', () => ({
	mergeAccounts: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../src/lib/utils/user-auth-state', () => ({
	getUserAuthState: vi.fn().mockResolvedValue({})
}));
const verifyPassword = vi.hoisted(() => vi.fn());
const hashPassword = vi.hoisted(() => vi.fn(async () => 'dummy-hash'));
vi.mock('../../src/lib/utils/passwords', () => ({ verifyPassword, hashPassword }));

/**
 * Merging an account checks that account's password. It must be limited as sign-in is: without the
 * limit a signed-in visitor could guess passwords here for ever and take over the account they hit.
 * Ported from the Pinfool fork (c661c73, 54209aa), plus: an unknown account spends a hash too, and
 * a property over guess sequences. The counters are the sign-in throttle's, in D1.
 */
function setup(withPassword = true) {
	// A real database: the route's own lookup and the throttle's counters both run as SQL.
	const db = createSqliteD1();
	const victim = (present: boolean) =>
		present
			? db
					.prepare(
						`INSERT OR IGNORE INTO users (id, email, name, is_admin, password_hash) VALUES ('victim', 'ada@example.com', 'Ada', 1, 'hash')`
					)
					.run()
			: db.prepare(`DELETE FROM users WHERE id = 'victim'`).run();
	const ready = victim(withPassword);
	const counters = async () =>
		(
			await db.prepare('SELECT key FROM login_throttle ORDER BY key').all<{ key: string }>()
		).results.map((r) => r.key);
	const attempt = async (password: string) => {
		await ready;
		const { POST } = await import('../../src/routes/api/auth/merge/+server');
		return POST({
			locals: { user: { id: 'attacker', email: 'attacker@example.com' } },
			platform: { env: { DB: db } },
			request: new Request('http://localhost/api/auth/merge', {
				method: 'POST',
				headers: { 'cf-connecting-ip': '203.0.113.9' },
				body: JSON.stringify({ email: 'ada@example.com', password })
			})
		} as never);
	};
	return { attempt, counters, victim };
}

describe('POST /api/auth/merge password guessing', () => {
	beforeEach(() => verifyPassword.mockReset());

	it('refuses further guesses after the sign-in limit, without checking the password', async () => {
		const { attempt } = setup();
		verifyPassword.mockResolvedValue(false);
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await expect(attempt(`guess-${i}`)).rejects.toMatchObject({ status: 401 });
		}
		expect(verifyPassword).toHaveBeenCalledTimes(MAX_ATTEMPTS);
		// Even the right password is refused now, and the password is not looked at.
		verifyPassword.mockResolvedValue(true);
		await expect(attempt('the-right-one')).rejects.toMatchObject({ status: 429 });
		expect(verifyPassword).toHaveBeenCalledTimes(MAX_ATTEMPTS);
	});

	it('counts a guess at an account that has no password too, and spends a hash on it', async () => {
		const { attempt, counters } = setup(false);
		verifyPassword.mockResolvedValue(false);
		await expect(attempt('x')).rejects.toMatchObject({ status: 401 });
		expect((await counters()).length).toBe(2);
		// Same work as a wrong password, so timing does not reveal whether the email exists.
		expect(verifyPassword).toHaveBeenCalledWith('x', 'dummy-hash');
	});

	it('clears the count for that email when the password is right (as sign-in does)', async () => {
		const { attempt, counters } = setup();
		verifyPassword.mockResolvedValue(false);
		await expect(attempt('wrong')).rejects.toMatchObject({ status: 401 });
		expect(await counters()).toContain('login_attempts:email:ada@example.com');
		verifyPassword.mockResolvedValue(true);
		const res = await attempt('right');
		expect(res.status).toBe(200);
		expect(await counters()).toEqual(['login_attempts:ip:203.0.113.9']);
	});

	it('property: one address never gets more than MAX_ATTEMPTS password checks', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.boolean(), { minLength: 1, maxLength: MAX_ATTEMPTS * 2 }),
				async (knownAccount) => {
					verifyPassword.mockReset();
					verifyPassword.mockResolvedValue(false);
					const { attempt, victim } = setup(false);
					for (const known of knownAccount) {
						await victim(known);
						await attempt('guess').catch(() => {});
					}
					expect(verifyPassword.mock.calls.length).toBe(
						Math.min(knownAccount.length, MAX_ATTEMPTS)
					);
				}
			),
			{ numRuns: 30 }
		);
	});
});

describe('the throttle counters in D1', () => {
	it('keeps a value until it expires, replaces it, deletes it, and clears expired ones', async () => {
		const db = createSqliteD1();
		const store = throttleStore(db)!;
		expect(throttleStore(undefined)).toBeUndefined();
		expect(await store.get('k')).toBeNull();
		await store.put('k', '3', { expirationTtl: 900 });
		expect(await store.get('k')).toBe('3');
		await store.put('k', '4:99', { expiration: Math.floor(Date.now() / 1000) + 60 });
		expect(await store.get('k')).toBe('4:99');
		await store.delete('k');
		expect(await store.get('k')).toBeNull();
		// An expired counter reads as absent, and is removed when the next one is written.
		await db
			.prepare(`INSERT INTO login_throttle (key, value, expires_at) VALUES ('old', '8', 1)`)
			.run();
		expect(await store.get('old')).toBeNull();
		await store.put('new', '1');
		const keys = await db.prepare('SELECT key FROM login_throttle').all<{ key: string }>();
		expect(keys.results.map((r) => r.key)).toEqual(['new']);
	});
});
