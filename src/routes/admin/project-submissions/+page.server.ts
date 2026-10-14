import { error, fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth-guards';
import {
	countProjectSubmissions,
	isSubmissionStatus,
	listProjectSubmissions,
	reviewProjectSubmission,
	type ProjectSubmissionStatus
} from '$lib/services/project-submissions';
import type { Actions, PageServerLoad } from './$types';

/**
 * The review queue for `/projects` submissions.
 *
 * Approving does not publish: the directory is checked-in data, so the
 * reviewer still adds the card in `src/lib/data/projects.ts`. What this page
 * records is the decision, which is what the member sees on `/projects`.
 */
const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const requested = url.searchParams.get('status');
	const status: ProjectSubmissionStatus | undefined = isSubmissionStatus(requested)
		? requested
		: undefined;
	const offset = (page - 1) * PAGE_SIZE;

	const [submissions, total, pending] = await Promise.all([
		listProjectSubmissions(db, { limit: PAGE_SIZE, offset, status }),
		countProjectSubmissions(db, { status }),
		countProjectSubmissions(db, { status: 'pending' })
	]);

	return {
		submissions,
		total,
		pending,
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		status: status ?? null
	};
};

const REVIEW_NOTE_MAX = 500;

async function decide(status: 'approved' | 'rejected', event: Parameters<Actions[string]>[0]) {
	const user = requireAdmin(event.locals);
	const db = event.platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const form = await event.request.formData();
	const id = form.get('id');
	if (typeof id !== 'string' || !id) return fail(400, { error: 'Which submission?' });

	const rawNote = form.get('note');
	const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, REVIEW_NOTE_MAX) : '';

	const changed = await reviewProjectSubmission(db, id, {
		status,
		reviewerId: user.id,
		note: note || null
	});
	if (!changed) return fail(409, { error: 'That one has already been reviewed.' });
	return { reviewed: id, status };
}

export const actions: Actions = {
	approve: (event) => decide('approved', event),
	reject: (event) => decide('rejected', event)
};
