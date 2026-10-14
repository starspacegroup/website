import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	MAX_PENDING_PER_USER,
	countPendingProjectSubmissionsForUser,
	countProjectSubmissions,
	createProjectSubmission,
	getProjectSubmission,
	hasProjectSubmissionForUrl,
	isSubmissionStatus,
	listProjectSubmissions,
	listProjectSubmissionsForUser,
	reviewProjectSubmission
} from './project-submissions';

interface MockHandlers {
	first?: (sql: string, args: unknown[]) => unknown;
	all?: (sql: string, args: unknown[]) => { results: unknown[] };
	run?: (sql: string, args: unknown[]) => unknown;
}

type Call = { sql: string; args: unknown[] };

/** Minimal D1 stand-in: prepare().bind()?.first()/all()/run(), recording each call. */
function makeDb(handlers: MockHandlers, calls: Call[] = []) {
	return {
		prepare(sql: string) {
			let args: unknown[] = [];
			const stmt = {
				bind(...a: unknown[]) {
					args = a;
					return stmt;
				},
				first: async () => {
					calls.push({ sql, args });
					return handlers.first ? handlers.first(sql, args) : undefined;
				},
				all: async () => {
					calls.push({ sql, args });
					return handlers.all ? handlers.all(sql, args) : { results: [] };
				},
				run: async () => {
					calls.push({ sql, args });
					return handlers.run ? handlers.run(sql, args) : { meta: { changes: 1 } };
				}
			};
			return stmt;
		}
	} as unknown as D1Database;
}

const row = (over: Record<string, unknown> = {}) => ({
	id: 'sub-1',
	user_id: 'u1',
	discord_user_id: '123456789012345678',
	name: 'Sortalizer',
	url: 'https://sortalizer.example.com/',
	description: 'Sorts the things you cannot be bothered to sort.',
	notes: null,
	status: 'pending',
	review_note: null,
	reviewed_by: null,
	reviewed_at: null,
	created_at: '2026-10-13 12:00:00',
	...over
});

const input = {
	name: 'Sortalizer',
	url: 'https://sortalizer.example.com/',
	description: 'Sorts the things you cannot be bothered to sort.',
	notes: null
};

describe('project submissions service', () => {
	it('knows its three statuses and nothing else', () => {
		expect(isSubmissionStatus('pending')).toBe(true);
		expect(isSubmissionStatus('approved')).toBe(true);
		expect(isSubmissionStatus('rejected')).toBe(true);
		expect(isSubmissionStatus('published')).toBe(false);
		expect(isSubmissionStatus(null)).toBe(false);
	});

	it('creates a submission with a fresh id and the owner it was given', async () => {
		const calls: Call[] = [];
		const db = makeDb({ first: (_sql, args) => row({ id: args[0] }) }, calls);
		const created = await createProjectSubmission(
			db,
			{ userId: 'u1', discordUserId: '123456789012345678' },
			input
		);
		expect(calls[0].sql).toContain('INSERT INTO project_submissions');
		expect(calls[0].args.slice(1)).toEqual([
			'u1',
			'123456789012345678',
			input.name,
			input.url,
			input.description,
			null
		]);
		expect(created).toMatchObject({
			id: calls[0].args[0],
			userId: 'u1',
			status: 'pending',
			reviewNote: null,
			reviewedAt: null
		});
	});

	it('throws when the insert returns nothing', async () => {
		const db = makeDb({ first: () => null });
		await expect(
			createProjectSubmission(db, { userId: 'u1', discordUserId: '1234567' }, input)
		).rejects.toThrow('Failed to create project submission');
	});

	it('maps an unknown status back to pending rather than inventing one', async () => {
		const db = makeDb({ first: () => row({ status: 'weird' }) });
		const found = await getProjectSubmission(db, 'sub-1');
		expect(found?.status).toBe('pending');
	});

	it('returns null for a submission that does not exist', async () => {
		const db = makeDb({ first: () => null });
		expect(await getProjectSubmission(db, 'nope')).toBeNull();
	});

	it("lists one person's submissions newest first, by their user id", async () => {
		const calls: Call[] = [];
		const db = makeDb({ all: () => ({ results: [row(), row({ id: 'sub-2' })] }) }, calls);
		const mine = await listProjectSubmissionsForUser(db, 'u1');
		expect(mine.map((s) => s.id)).toEqual(['sub-1', 'sub-2']);
		expect(calls[0].sql).toContain('WHERE user_id = ?');
		expect(calls[0].sql).toContain('ORDER BY created_at DESC');
		expect(calls[0].args).toEqual(['u1']);
	});

	it('counts only the pending ones for the per-person limit', async () => {
		const calls: Call[] = [];
		const db = makeDb({ first: () => ({ count: 2 }) }, calls);
		expect(await countPendingProjectSubmissionsForUser(db, 'u1')).toBe(2);
		expect(calls[0].sql).toContain("status = 'pending'");
		expect(MAX_PENDING_PER_USER).toBeGreaterThan(0);
	});

	it('treats a missing count as zero', async () => {
		const db = makeDb({ first: () => undefined });
		expect(await countPendingProjectSubmissionsForUser(db, 'u1')).toBe(0);
		expect(await countProjectSubmissions(db)).toBe(0);
	});

	it('spots a link the person already sent, unless it was rejected', async () => {
		const calls: Call[] = [];
		const db = makeDb({ first: () => ({ id: 'sub-1' }) }, calls);
		expect(await hasProjectSubmissionForUrl(db, 'u1', input.url)).toBe(true);
		expect(calls[0].sql).toContain("status != 'rejected'");
		expect(calls[0].args).toEqual(['u1', input.url]);
		expect(await hasProjectSubmissionForUrl(makeDb({ first: () => null }), 'u1', input.url)).toBe(
			false
		);
	});

	it('lists everything for an admin, or one status when asked', async () => {
		const calls: Call[] = [];
		const db = makeDb({ all: () => ({ results: [row()] }) }, calls);
		await listProjectSubmissions(db);
		expect(calls[0].sql).not.toContain('WHERE');
		expect(calls[0].args).toEqual([50, 0]);

		await listProjectSubmissions(db, { status: 'approved', limit: 10, offset: 20 });
		expect(calls[1].sql).toContain('WHERE status = ?');
		expect(calls[1].args).toEqual(['approved', 10, 20]);
	});

	it('counts everything, or one status', async () => {
		const calls: Call[] = [];
		const db = makeDb({ first: () => ({ count: 7 }) }, calls);
		expect(await countProjectSubmissions(db)).toBe(7);
		expect(calls[0].args).toEqual([]);
		expect(await countProjectSubmissions(db, { status: 'pending' })).toBe(7);
		expect(calls[1].args).toEqual(['pending']);
	});

	it('records a decision only on a pending row, and says whether it did', async () => {
		const calls: Call[] = [];
		const db = makeDb({ run: () => ({ meta: { changes: 1 } }) }, calls);
		const changed = await reviewProjectSubmission(db, 'sub-1', {
			status: 'approved',
			reviewerId: 'admin-1',
			note: 'Lovely'
		});
		expect(changed).toBe(true);
		expect(calls[0].sql).toContain("WHERE id = ? AND status = 'pending'");
		expect(calls[0].args).toEqual(['approved', 'admin-1', 'Lovely', 'sub-1']);

		const again = await reviewProjectSubmission(
			makeDb({ run: () => ({ meta: { changes: 0 } }) }),
			'sub-1',
			{
				status: 'rejected',
				reviewerId: 'admin-1',
				note: null
			}
		);
		expect(again).toBe(false);
	});

	it('treats a run with no meta as nothing changed', async () => {
		const db = makeDb({ run: () => ({}) });
		expect(
			await reviewProjectSubmission(db, 'sub-1', {
				status: 'approved',
				reviewerId: 'a',
				note: null
			})
		).toBe(false);
	});
});
