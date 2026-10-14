import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Who gets the form. The directory above it is the same for everyone; the
 * box at the bottom opens only for a signed-in Discord account SpaceBot says
 * is in the server — and the post re-checks that, so a stale page cannot
 * submit on behalf of someone who has since left.
 */

const profileMocks = vi.hoisted(() => ({
	discordAccount: vi.fn(),
	fetchMemberProfile: vi.fn(),
	UNAVAILABLE_PROFILE: { available: false, member: false }
}));
const serviceMocks = vi.hoisted(() => ({
	MAX_PENDING_PER_USER: 3,
	countPendingProjectSubmissionsForUser: vi.fn(),
	createProjectSubmission: vi.fn(),
	hasProjectSubmissionForUrl: vi.fn(),
	listProjectSubmissionsForUser: vi.fn()
}));

vi.mock('$lib/server/member-profile', () => profileMocks);
vi.mock('$lib/services/project-submissions', () => serviceMocks);
vi.mock('$lib/server/spacebot-connection', () => ({
	getSpaceBotConfig: vi.fn(async () => ({ apiUrl: 'https://bot.test', apiKey: 'sb_live_x' }))
}));

import { actions, load, type SubmitPanel } from './+page.server';

const run = async (event: unknown) => (await load(event as never)) as { submit: SubmitPanel };

const user = { id: 'u1', login: 'ada', email: 'ada@example.com', isOwner: false };
const account = { id: '123456789012345678', avatar: null };
const member = { available: true, member: true };

const good = {
	name: 'Sortalizer',
	url: 'https://sortalizer.example.com/',
	description: 'Sorts the things you cannot be bothered to sort, in the browser.'
};

function loadEvent(opts: { user?: typeof user; db?: unknown } = {}) {
	const headers: Record<string, string> = {};
	return {
		event: {
			locals: { user: opts.user },
			platform: { env: { DB: 'db' in opts ? opts.db : {} } },
			setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
		},
		headers
	};
}

function actionEvent(
	fields: Record<string, string>,
	opts: { user?: typeof user; db?: unknown } = {}
) {
	const form = new Map(Object.entries(fields));
	return {
		request: { formData: async () => form },
		locals: { user: opts.user },
		platform: { env: { DB: 'db' in opts ? opts.db : {} } }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	profileMocks.discordAccount.mockResolvedValue(account);
	profileMocks.fetchMemberProfile.mockResolvedValue(member);
	serviceMocks.listProjectSubmissionsForUser.mockResolvedValue([]);
	serviceMocks.countPendingProjectSubmissionsForUser.mockResolvedValue(0);
	serviceMocks.hasProjectSubmissionForUrl.mockResolvedValue(false);
	serviceMocks.createProjectSubmission.mockResolvedValue({ id: 'sub-1' });
});

describe('projects load', () => {
	it('never lets the page be stored — the panel is per visitor', async () => {
		const { event, headers } = loadEvent();
		await run(event);
		expect(headers['cache-control']).toBe('private, no-store');
	});

	it('offers sign-in to a visitor with no session, without asking anyone anything', async () => {
		const data = await run(loadEvent().event);
		expect(data.submit.state).toBe('signed-out');
		expect(profileMocks.discordAccount).not.toHaveBeenCalled();
	});

	it('offers linking to a session with no Discord account', async () => {
		profileMocks.discordAccount.mockResolvedValue(null);
		const data = await run(loadEvent({ user }).event);
		expect(data.submit.state).toBe('unlinked');
		expect(profileMocks.fetchMemberProfile).not.toHaveBeenCalled();
	});

	it('offers the invite to a linked account that is not in the server', async () => {
		profileMocks.fetchMemberProfile.mockResolvedValue({ available: true, member: false });
		const data = await run(loadEvent({ user }).event);
		expect(data.submit.state).toBe('not-member');
	});

	it('keeps the form closed when SpaceBot could not be asked', async () => {
		profileMocks.fetchMemberProfile.mockResolvedValue({ available: false, member: false });
		const data = await run(loadEvent({ user }).event);
		expect(data.submit.state).toBe('unavailable');
	});

	it('keeps the form closed when the membership read throws', async () => {
		profileMocks.fetchMemberProfile.mockRejectedValue(new Error('boom'));
		const data = await run(loadEvent({ user }).event);
		expect(data.submit.state).toBe('unavailable');
	});

	it('opens the form for a member, with their own submissions', async () => {
		serviceMocks.listProjectSubmissionsForUser.mockResolvedValue([
			{ id: 'a', status: 'pending' },
			{ id: 'b', status: 'approved' }
		]);
		const data = await run(loadEvent({ user }).event);
		expect(data.submit).toMatchObject({
			state: 'member',
			pendingLimit: 3,
			atLimit: false,
			submissions: [{ id: 'a' }, { id: 'b' }]
		});
		expect(profileMocks.fetchMemberProfile).toHaveBeenCalledWith(
			{ apiUrl: 'https://bot.test', apiKey: 'sb_live_x' },
			account.id
		);
	});

	it('says so when a member has the maximum waiting', async () => {
		serviceMocks.listProjectSubmissionsForUser.mockResolvedValue([
			{ id: 'a', status: 'pending' },
			{ id: 'b', status: 'pending' },
			{ id: 'c', status: 'pending' }
		]);
		const data = await run(loadEvent({ user }).event);
		expect(data.submit.atLimit).toBe(true);
	});

	it('still opens the form for a member when the database is missing or fails', async () => {
		const noDb = await run(loadEvent({ user, db: undefined }).event);
		expect(noDb.submit).toMatchObject({ state: 'member', submissions: [] });

		serviceMocks.listProjectSubmissionsForUser.mockRejectedValue(new Error('d1 down'));
		const failing = await run(loadEvent({ user }).event);
		expect(failing.submit).toMatchObject({ state: 'member', submissions: [] });
	});
});

describe('projects submit action', () => {
	it('refuses a visitor with no session', async () => {
		const res = await actions.submit(actionEvent(good) as never);
		expect(res).toMatchObject({ status: 401 });
		expect(serviceMocks.createProjectSubmission).not.toHaveBeenCalled();
	});

	it('fails with 500 when there is no database', async () => {
		const res = await actions.submit(actionEvent(good, { user, db: undefined }) as never);
		expect(res).toMatchObject({ status: 500 });
	});

	it('rejects bad input before asking about membership, and echoes the fields back', async () => {
		const res = await actions.submit(actionEvent({ ...good, url: 'nope' }, { user }) as never);
		expect(res).toMatchObject({ status: 400, data: { values: { url: 'nope', name: good.name } } });
		expect(profileMocks.discordAccount).not.toHaveBeenCalled();
	});

	it('refuses a session with no Discord account', async () => {
		profileMocks.discordAccount.mockResolvedValue(null);
		const res = await actions.submit(actionEvent(good, { user }) as never);
		expect(res).toMatchObject({ status: 403 });
		expect(serviceMocks.createProjectSubmission).not.toHaveBeenCalled();
	});

	it('refuses an account that is not in the server, even if the page said otherwise', async () => {
		profileMocks.fetchMemberProfile.mockResolvedValue({ available: true, member: false });
		const res = await actions.submit(actionEvent(good, { user }) as never);
		expect(res).toMatchObject({
			status: 403,
			data: { error: expect.stringContaining('Only members') }
		});
	});

	it('fails closed, with a different message, when membership cannot be checked', async () => {
		profileMocks.fetchMemberProfile.mockResolvedValue({ available: false, member: false });
		const res = await actions.submit(actionEvent(good, { user }) as never);
		expect(res).toMatchObject({
			status: 403,
			data: { error: expect.stringContaining('could not be asked') }
		});
		expect(serviceMocks.createProjectSubmission).not.toHaveBeenCalled();
	});

	it('stops a member who already has the maximum waiting', async () => {
		serviceMocks.countPendingProjectSubmissionsForUser.mockResolvedValue(3);
		const res = await actions.submit(actionEvent(good, { user }) as never);
		expect(res).toMatchObject({ status: 429 });
		expect(serviceMocks.createProjectSubmission).not.toHaveBeenCalled();
	});

	it('stops the same link being sent twice', async () => {
		serviceMocks.hasProjectSubmissionForUrl.mockResolvedValue(true);
		const res = await actions.submit(actionEvent(good, { user }) as never);
		expect(res).toMatchObject({ status: 409 });
		expect(serviceMocks.createProjectSubmission).not.toHaveBeenCalled();
	});

	it('creates the submission for a member, tied to the Discord id that was checked', async () => {
		const res = await actions.submit(
			actionEvent({ ...good, notes: ' first release ' }, { user }) as never
		);
		expect(res).toMatchObject({ success: true, message: expect.stringContaining('Sortalizer') });
		expect(serviceMocks.createProjectSubmission).toHaveBeenCalledWith(
			{},
			{ userId: 'u1', discordUserId: account.id },
			{ ...good, notes: 'first release' }
		);
	});
});
