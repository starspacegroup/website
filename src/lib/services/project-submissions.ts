/**
 * Project submissions: a member's request to be listed on `/projects`.
 *
 * Service pattern as in `contact.ts`: every function takes a `D1Database`
 * first, rows are snake_case and mapped to the camelCase domain type. The
 * membership check that gates a submission is the caller's job — this file
 * trusts the ids it is given, so nothing here is reachable from a request
 * without going through `/projects`'s action or an admin route.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ProjectSubmissionInput } from '$lib/utils/project-submission-validation';

export type ProjectSubmissionStatus = 'pending' | 'approved' | 'rejected';

export const PROJECT_SUBMISSION_STATUSES: readonly ProjectSubmissionStatus[] = [
	'pending',
	'approved',
	'rejected'
];

export interface ProjectSubmission {
	id: string;
	userId: string;
	discordUserId: string;
	name: string;
	url: string;
	description: string;
	notes: string | null;
	status: ProjectSubmissionStatus;
	reviewNote: string | null;
	reviewedBy: string | null;
	reviewedAt: string | null;
	createdAt: string;
}

interface ProjectSubmissionRow {
	id: string;
	user_id: string;
	discord_user_id: string;
	name: string;
	url: string;
	description: string;
	notes: string | null;
	status: string;
	review_note: string | null;
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_at: string;
}

/** How many a person may have waiting at once. Enough to list real work, not a queue flood. */
export const MAX_PENDING_PER_USER = 3;

export function isSubmissionStatus(value: unknown): value is ProjectSubmissionStatus {
	return PROJECT_SUBMISSION_STATUSES.includes(value as ProjectSubmissionStatus);
}

function rowToSubmission(row: ProjectSubmissionRow): ProjectSubmission {
	return {
		id: row.id,
		userId: row.user_id,
		discordUserId: row.discord_user_id,
		name: row.name,
		url: row.url,
		description: row.description,
		notes: row.notes ?? null,
		status: isSubmissionStatus(row.status) ? row.status : 'pending',
		reviewNote: row.review_note ?? null,
		reviewedBy: row.reviewed_by ?? null,
		reviewedAt: row.reviewed_at ?? null,
		createdAt: row.created_at
	};
}

export async function createProjectSubmission(
	db: D1Database,
	owner: { userId: string; discordUserId: string },
	input: ProjectSubmissionInput
): Promise<ProjectSubmission> {
	const id = crypto.randomUUID();
	const row = await db
		.prepare(
			'INSERT INTO project_submissions (id, user_id, discord_user_id, name, url, description, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
		)
		.bind(
			id,
			owner.userId,
			owner.discordUserId,
			input.name,
			input.url,
			input.description,
			input.notes
		)
		.first<ProjectSubmissionRow>();
	if (!row) throw new Error('Failed to create project submission');
	return rowToSubmission(row);
}

/** Everything one person has sent, newest first — what "your submissions" shows them. */
export async function listProjectSubmissionsForUser(
	db: D1Database,
	userId: string
): Promise<ProjectSubmission[]> {
	const result = await db
		.prepare('SELECT * FROM project_submissions WHERE user_id = ? ORDER BY created_at DESC')
		.bind(userId)
		.all<ProjectSubmissionRow>();
	return (result.results ?? []).map(rowToSubmission);
}

export async function countPendingProjectSubmissionsForUser(
	db: D1Database,
	userId: string
): Promise<number> {
	const row = await db
		.prepare(
			"SELECT COUNT(*) as count FROM project_submissions WHERE user_id = ? AND status = 'pending'"
		)
		.bind(userId)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/** True when this person already has this link waiting or listed. */
export async function hasProjectSubmissionForUrl(
	db: D1Database,
	userId: string,
	url: string
): Promise<boolean> {
	const row = await db
		.prepare(
			"SELECT id FROM project_submissions WHERE user_id = ? AND url = ? AND status != 'rejected' LIMIT 1"
		)
		.bind(userId, url)
		.first<{ id: string }>();
	return Boolean(row);
}

export interface ListProjectSubmissionsOptions {
	limit?: number;
	offset?: number;
	status?: ProjectSubmissionStatus;
}

/** Admin: newest first, optionally one status. */
export async function listProjectSubmissions(
	db: D1Database,
	options: ListProjectSubmissionsOptions = {}
): Promise<ProjectSubmission[]> {
	const { limit = 50, offset = 0, status } = options;
	const statement = status
		? db
				.prepare(
					'SELECT * FROM project_submissions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
				)
				.bind(status, limit, offset)
		: db
				.prepare('SELECT * FROM project_submissions ORDER BY created_at DESC LIMIT ? OFFSET ?')
				.bind(limit, offset);
	const result = await statement.all<ProjectSubmissionRow>();
	return (result.results ?? []).map(rowToSubmission);
}

export async function countProjectSubmissions(
	db: D1Database,
	options: { status?: ProjectSubmissionStatus } = {}
): Promise<number> {
	const statement = options.status
		? db
				.prepare('SELECT COUNT(*) as count FROM project_submissions WHERE status = ?')
				.bind(options.status)
		: db.prepare('SELECT COUNT(*) as count FROM project_submissions');
	const row = await statement.first<{ count: number }>();
	return row?.count ?? 0;
}

export async function getProjectSubmission(
	db: D1Database,
	id: string
): Promise<ProjectSubmission | null> {
	const row = await db
		.prepare('SELECT * FROM project_submissions WHERE id = ?')
		.bind(id)
		.first<ProjectSubmissionRow>();
	return row ? rowToSubmission(row) : null;
}

/**
 * Record a decision. Only a pending submission can be reviewed; a second
 * decision on the same row is a no-op, which is what keeps two admins
 * clicking at once from flipping it back and forth.
 */
export async function reviewProjectSubmission(
	db: D1Database,
	id: string,
	decision: { status: 'approved' | 'rejected'; reviewerId: string; note: string | null }
): Promise<boolean> {
	const result = await db
		.prepare(
			"UPDATE project_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ? WHERE id = ? AND status = 'pending'"
		)
		.bind(decision.status, decision.reviewerId, decision.note, id)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}
