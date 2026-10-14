import { fail } from '@sveltejs/kit';
import {
	UNAVAILABLE_PROFILE,
	discordAccount,
	fetchMemberProfile,
	type MemberProfile
} from '$lib/server/member-profile';
import { getSpaceBotConfig } from '$lib/server/spacebot-connection';
import {
	MAX_PENDING_PER_USER,
	countPendingProjectSubmissionsForUser,
	createProjectSubmission,
	hasProjectSubmissionForUrl,
	listProjectSubmissionsForUser,
	type ProjectSubmission
} from '$lib/services/project-submissions';
import { validateProjectSubmission } from '$lib/utils/project-submission-validation';
import type { Actions, PageServerLoad } from './$types';

/**
 * The directory is checked-in data and renders with no database at all. This
 * file only decides what the "want your project here?" box at the bottom
 * offers, and takes the form when it offers one.
 *
 * Who may submit: somebody signed in through Discord whose account SpaceBot
 * says is a member of the server. The page is public, so this is the one
 * place a visitor's standing with the Discord server decides what they see —
 * and it is re-checked on the submit itself, not trusted from the render.
 *
 * - `signed-out` — no session. Offer sign-in.
 * - `unlinked` — a session with no Discord account on it. Offer linking.
 * - `not-member` — Discord says they are not in the server. Offer the invite.
 * - `unavailable` — SpaceBot could not be asked. Offer the invite; the form
 *   stays closed, because "could not check" is not "checked".
 * - `member` — the form.
 */
export type SubmitState = 'signed-out' | 'unlinked' | 'not-member' | 'unavailable' | 'member';

/** Everything the page needs about the current visitor. Fields the browser can act on, nothing more. */
export type SubmitPanel = {
	state: SubmitState;
	submissions: ProjectSubmission[];
	pendingLimit: number;
	atLimit: boolean;
};

async function standing(
	platform: App.Platform | undefined,
	userId: string
): Promise<{ state: SubmitState; discordUserId: string | null }> {
	const account = await discordAccount(platform?.env?.DB, userId);
	if (!account) return { state: 'unlinked', discordUserId: null };

	const config = await getSpaceBotConfig(platform);
	const profile: MemberProfile = await fetchMemberProfile(config, account.id).catch(
		() => UNAVAILABLE_PROFILE
	);
	if (!profile.available) return { state: 'unavailable', discordUserId: account.id };
	if (!profile.member) return { state: 'not-member', discordUserId: account.id };
	return { state: 'member', discordUserId: account.id };
}

const closed = (state: SubmitState): SubmitPanel => ({
	state,
	submissions: [],
	pendingLimit: MAX_PENDING_PER_USER,
	atLimit: false
});

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	// The nav and this panel are both per-visitor now, so nothing may store it.
	setHeaders({ 'cache-control': 'private, no-store' });

	const user = locals.user;
	if (!user) return { submit: closed('signed-out') };

	const { state } = await standing(platform, user.id);
	if (state !== 'member') return { submit: closed(state) };

	const db = platform?.env?.DB;
	const submissions = db
		? await listProjectSubmissionsForUser(db, user.id).catch(() => [] as ProjectSubmission[])
		: [];
	const pending = submissions.filter((s) => s.status === 'pending').length;

	return {
		submit: {
			state: 'member',
			submissions,
			pendingLimit: MAX_PENDING_PER_USER,
			atLimit: pending >= MAX_PENDING_PER_USER
		} satisfies SubmitPanel
	};
};

const EMPTY_VALUES = { name: '', url: '', description: '', notes: '' };

export const actions: Actions = {
	submit: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Sign in with Discord first.', values: EMPTY_VALUES });

		const db = platform?.env?.DB;
		if (!db) {
			return fail(500, {
				error: 'Submissions are not available right now.',
				values: EMPTY_VALUES
			});
		}

		const form = await request.formData();
		const result = validateProjectSubmission({
			name: form.get('name'),
			url: form.get('url'),
			description: form.get('description'),
			notes: form.get('notes')
		});
		// Echo the fields back so a typo does not cost the whole form.
		const values = {
			name: String(form.get('name') ?? ''),
			url: String(form.get('url') ?? ''),
			description: String(form.get('description') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		if (!result.ok) return fail(400, { error: result.error, values });

		// Checked again here, not carried over from the render. Membership can
		// end between the two, and a form post is the thing that must not trust
		// the page it came from.
		const { state, discordUserId } = await standing(platform, user.id);
		if (state !== 'member' || !discordUserId) {
			return fail(403, {
				error:
					state === 'unavailable'
						? 'The server could not be asked whether you are a member just now. Try again in a minute.'
						: 'Only members of the Discord server can submit a project.',
				values
			});
		}

		const pending = await countPendingProjectSubmissionsForUser(db, user.id);
		if (pending >= MAX_PENDING_PER_USER) {
			return fail(429, {
				error: `You already have ${MAX_PENDING_PER_USER} waiting for review. Once one is looked at you can send another.`,
				values
			});
		}
		if (await hasProjectSubmissionForUrl(db, user.id, result.value.url)) {
			return fail(409, { error: 'You have already submitted that link.', values });
		}

		await createProjectSubmission(db, { userId: user.id, discordUserId }, result.value);
		return { success: true, message: `Thanks — ${result.value.name} is in the queue for a look.` };
	}
};
