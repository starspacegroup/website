import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { D1Database } from '@cloudflare/workers-types';
import {
	CHECKOUT_LIMITS,
	FORM_LIMITS,
	hitLimits,
	limitRequest,
	OAUTH_START_LIMITS,
	pruneLimits,
	retryAfter,
	SIGNUP_LIMITS,
	tooManyRequests,
	windowStart,
	withinLimit,
	type RequestLimit
} from '../../src/lib/server/request-limit';
import { createSqliteD1 } from '../helpers/sqlite-d1';

// Ported from the Pinfool fork (29c7464 / 2086998): the same properties, on the real
// migrations, against the Dafny-compiled core (dafny/RequestLimit.dfy).

let db: D1Database;
beforeEach(() => {
	db = createSqliteD1();
});

const T0 = Date.UTC(2026, 10, 19, 12, 0, 0);

describe('fixed windows (Dafny core)', () => {
	it('puts a time in exactly one window, which starts at or before it and ends after it', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 4_000_000_000_000 }),
				fc.integer({ min: 1, max: 172_800 }),
				(nowMs, size) => {
					const start = windowStart(nowMs, size);
					const now = Math.floor(nowMs / 1000);
					expect(start % size).toBe(0);
					expect(start).toBeLessThanOrEqual(now);
					expect(start + size).toBeGreaterThan(now);
				}
			)
		);
	});

	it('allows exactly `max` hits', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 1000 }), (max) => {
				expect(withinLimit(max, max)).toBe(true);
				expect(withinLimit(max + 1, max)).toBe(false);
				expect(withinLimit(1, max)).toBe(true);
			})
		);
	});

	it('a refusal waits more than 0 and at most one window; an allowed hit waits 0', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 50 }),
				fc.integer({ min: 1, max: 40 }),
				fc.integer({ min: 0, max: 4_000_000_000_000 }),
				fc.integer({ min: 1, max: 86_400 }),
				(hits, max, nowMs, size) => {
					const wait = retryAfter(hits, max, nowMs, size);
					if (hits <= max) expect(wait).toBe(0);
					else {
						expect(wait).toBeGreaterThan(0);
						expect(wait).toBeLessThanOrEqual(size);
					}
				}
			)
		);
	});
});

describe('hitLimits', () => {
	const five: RequestLimit[] = [{ scope: 't', max: 5, windowSeconds: 600 }];

	it('allows exactly max hits in a window, for any max and any number of tries', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 1, max: 12 }),
				fc.integer({ min: 1, max: 30 }),
				async (max, tries) => {
					const fresh = createSqliteD1();
					const limit = [{ scope: 'p', max, windowSeconds: 600 }];
					let allowed = 0;
					for (let i = 0; i < tries; i++) {
						if ((await hitLimits(fresh, limit, '203.0.113.7', { nowMs: T0 + i * 1000 })).allowed)
							allowed++;
					}
					expect(allowed).toBe(Math.min(max, tries));
				}
			),
			{ numRuns: 25 }
		);
	});

	it('counts each address and each scope on its own', async () => {
		for (let i = 0; i < 5; i++) await hitLimits(db, five, 'a', { nowMs: T0 });
		expect((await hitLimits(db, five, 'a', { nowMs: T0 })).allowed).toBe(false);
		expect((await hitLimits(db, five, 'b', { nowMs: T0 })).allowed).toBe(true);
		const other = [{ scope: 'other', max: 5, windowSeconds: 600 }];
		expect((await hitLimits(db, other, 'a', { nowMs: T0 })).allowed).toBe(true);
	});

	it('lets the address in again when the window ends, and says how long that is', async () => {
		for (let i = 0; i < 5; i++) await hitLimits(db, five, 'a', { nowMs: T0 });
		const refused = await hitLimits(db, five, 'a', { nowMs: T0 + 60_000 });
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfter).toBe(540);
		expect((await hitLimits(db, five, 'a', { nowMs: T0 + 600_000 })).allowed).toBe(true);
	});

	it('applies every limit: the short one and the daily one', async () => {
		const [short, day] = CHECKOUT_LIMITS;
		let now = T0;
		let allowed = 0;
		// Stay under the short limit by spreading out; the daily one must still stop it.
		for (let i = 0; i < day.max + 10; i++) {
			if ((await hitLimits(db, CHECKOUT_LIMITS, 'a', { nowMs: now })).allowed) allowed++;
			now += (short.windowSeconds * 1000) / short.max + 1000;
		}
		expect(allowed).toBe(day.max);
	});

	it('stores a hash, never the address', async () => {
		await hitLimits(db, five, '203.0.113.7', { nowMs: T0 });
		const rows = await db.prepare('SELECT who FROM request_limits').all<{ who: string }>();
		expect(rows.results[0].who).toMatch(/^[0-9a-f]{64}$/);
		expect(rows.results[0].who).not.toContain('203');
	});

	it('allows the request when the counter cannot be reached, or there is no database', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = {
			prepare: () => {
				throw new Error('D1 down');
			}
		} as unknown as D1Database;
		expect(await hitLimits(broken, five, 'a', { nowMs: T0 })).toEqual({
			allowed: true,
			retryAfter: 0
		});
		expect(await hitLimits(undefined, five, 'a')).toEqual({ allowed: true, retryAfter: 0 });
		errors.mockRestore();
	});

	it('a refusing rate-limit binding stops it before any D1 write; a broken one falls back', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const refuse = { limit: vi.fn(async () => ({ success: false })) };
		expect(await hitLimits(db, five, 'a', { nowMs: T0, binding: refuse })).toEqual({
			allowed: false,
			retryAfter: 60
		});
		expect(refuse.limit).toHaveBeenCalledWith({ key: 't:a' });
		const n = await db.prepare('SELECT COUNT(*) AS n FROM request_limits').first<{ n: number }>();
		expect(n?.n).toBe(0);

		const broken = { limit: vi.fn(async () => Promise.reject(new Error('binding down'))) };
		expect((await hitLimits(db, five, 'a', { nowMs: T0, binding: broken })).allowed).toBe(true);
		const pass = { limit: vi.fn(async () => ({ success: true })) };
		expect((await hitLimits(db, five, 'a', { nowMs: T0, binding: pass })).allowed).toBe(true);
		errors.mockRestore();
	});
});

describe('pruneLimits', () => {
	it('removes windows older than two days and keeps the rest', async () => {
		const limit = [{ scope: 't', max: 5, windowSeconds: 600 }];
		await hitLimits(db, limit, 'old', { nowMs: T0 - 3 * 86_400_000 });
		await hitLimits(db, limit, 'new', { nowMs: T0 });
		await pruneLimits(db, T0);
		const rows = await db
			.prepare('SELECT COUNT(*) AS n FROM request_limits')
			.first<{ n: number }>();
		expect(rows?.n).toBe(1);
		await expect(pruneLimits({} as D1Database, T0)).resolves.toBeUndefined();
	});
});

describe('limitRequest and tooManyRequests', () => {
	it('counts the client address and prunes after the response', async () => {
		const waitUntil = vi.fn();
		const req = () =>
			new Request('https://site.example/x', { headers: { 'cf-connecting-ip': '198.51.100.9' } });
		const limits = [{ scope: 'lr', max: 1, windowSeconds: 600 }];
		expect(
			(await limitRequest({ env: { DB: db }, context: { waitUntil } }, limits, req())).allowed
		).toBe(true);
		expect(waitUntil).toHaveBeenCalledTimes(1);
		const refused = await limitRequest({ env: { DB: db } }, limits, req());
		expect(refused.allowed).toBe(false);
		expect((await limitRequest(undefined, limits, req())).allowed).toBe(true);

		const res = tooManyRequests(refused);
		expect(res.status).toBe(429);
		expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
		expect(tooManyRequests({ allowed: false, retryAfter: 0 }).headers.get('retry-after')).toBe('1');
	});

	it('ships sane limits for every public write', () => {
		for (const set of [CHECKOUT_LIMITS, FORM_LIMITS, SIGNUP_LIMITS, OAUTH_START_LIMITS]) {
			for (const l of set) {
				expect(l.max).toBeGreaterThan(0);
				expect(l.windowSeconds).toBeGreaterThan(0);
			}
			expect(new Set(set.map((l) => l.scope)).size).toBe(set.length);
		}
	});
});

describe('the public writes use it', () => {
	const exhaust = async (limits: readonly RequestLimit[], ip: string) => {
		for (let i = 0; i < limits[0].max; i++) await hitLimits(db, limits, ip);
	};
	const contactBody = {
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		message: 'Hello, I have a question about when the next release ships.'
	};

	it('the contact form', async () => {
		const { actions } = await import('../../src/routes/contact/+page.server');
		const send = (ip: string) =>
			actions.default({
				platform: { env: { DB: db } },
				request: new Request('https://site.example/contact', {
					method: 'POST',
					headers: { 'cf-connecting-ip': ip, 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams(contactBody)
				})
			} as never);
		expect(await send('198.51.100.30')).toMatchObject({ success: true });
		await exhaust(FORM_LIMITS, '198.51.100.31');
		expect(await send('198.51.100.31')).toMatchObject({ status: 429 });
	});

	it('the contact JSON endpoint', async () => {
		const { POST } = await import('../../src/routes/api/contact-form-submissions/+server');
		const send = (ip: string) =>
			POST({
				platform: { env: { DB: db } },
				request: new Request('https://site.example/api/contact-form-submissions', {
					method: 'POST',
					headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' },
					body: JSON.stringify(contactBody)
				})
			} as never);
		expect((await send('198.51.100.40')).status).toBe(201);
		await exhaust(FORM_LIMITS, '198.51.100.41');
		expect((await send('198.51.100.41')).status).toBe(429);
		const saved = await db
			.prepare('SELECT COUNT(*) AS n FROM contact_form_submissions')
			.first<{ n: number }>();
		expect(saved?.n).toBe(1);
	});

	it('sign-up', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');
		await exhaust(SIGNUP_LIMITS, '198.51.100.50');
		const res = await POST({
			platform: { env: { DB: db } },
			url: new URL('https://site.example/api/auth/signup'),
			request: new Request('https://site.example/api/auth/signup', {
				method: 'POST',
				headers: { 'cf-connecting-ip': '198.51.100.50', 'content-type': 'application/json' },
				body: JSON.stringify({
					name: 'Ada',
					email: 'ada@example.com',
					password: 'Correct-Horse-9!',
					confirmPassword: 'Correct-Horse-9!'
				})
			})
		} as never);
		expect(res.status).toBe(429);
		const users = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
		expect(users?.n).toBe(0);
	});

	it.each(['github', 'discord'])('starting a %s sign-in', async (provider) => {
		const { GET } = await import(`../../src/routes/api/auth/${provider}/+server.ts`);
		await exhaust(OAUTH_START_LIMITS, '198.51.100.60');
		const start = () =>
			GET({
				platform: { env: { DB: db, [`${provider.toUpperCase()}_CLIENT_ID`]: 'client-id' } },
				url: new URL(`https://site.example/api/auth/${provider}`),
				cookies: { get: () => undefined, set: () => {} },
				locals: {},
				request: new Request(`https://site.example/api/auth/${provider}`, {
					headers: { 'cf-connecting-ip': '198.51.100.60' }
				})
			} as never);
		await expect(start()).rejects.toMatchObject({ status: 429 });
		const rows = await db
			.prepare('SELECT COUNT(*) AS n FROM oauth_transactions')
			.first<{ n: number }>();
		expect(rows?.n).toBe(0);
	});
});
