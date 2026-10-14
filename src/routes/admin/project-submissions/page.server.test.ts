import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
	listProjectSubmissions: vi.fn(),
	countProjectSubmissions: vi.fn(),
	reviewProjectSubmission: vi.fn(),
	isSubmissionStatus: (v: unknown) => v === 'pending' || v === 'approved' || v === 'rejected'
}));
vi.mock('$lib/services/project-submissions', () => serviceMocks);

import { actions, load } from './+page.server';

type Loaded = {
	status: string | null;
	total: number;
	pending: number;
	page: number;
	totalPages: number;
};
const run = async (event: unknown) => (await load(event as never)) as Loaded;

const admin = { id: 'admin-1', isAdmin: true };

function loadEvent(opts: { user?: unknown; query?: Record<string, string>; db?: unknown } = {}) {
	const search = new URLSearchParams(opts.query ?? {});
	return {
		locals: { user: opts.user },
		platform: { env: { DB: 'db' in opts ? opts.db : {} } },
		url: new URL(`http://localhost/admin/project-submissions?${search}`)
	};
}

function actionEvent(fields: Record<string, string>, opts: { user?: unknown; db?: unknown } = {}) {
	return {
		request: { formData: async () => new Map(Object.entries(fields)) },
		locals: { user: opts.user },
		platform: { env: { DB: 'db' in opts ? opts.db : {} } }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	serviceMocks.listProjectSubmissions.mockResolvedValue([{ id: 'sub-1', status: 'pending' }]);
	serviceMocks.countProjectSubmissions.mockResolvedValue(4);
	serviceMocks.reviewProjectSubmission.mockResolvedValue(true);
});

describe('admin project submissions load', () => {
	it('refuses anyone who is not an admin', async () => {
		await expect(load(loadEvent() as never)).rejects.toMatchObject({ status: 401 });
		await expect(load(loadEvent({ user: { id: 'u' } }) as never)).rejects.toMatchObject({
			status: 403
		});
	});

	it('throws 500 without a database', async () => {
		await expect(load(loadEvent({ user: admin, db: undefined }) as never)).rejects.toMatchObject({
			status: 500
		});
	});

	it('lists everything by default, with the pending count alongside', async () => {
		const data = await run(loadEvent({ user: admin }));
		expect(data).toMatchObject({ total: 4, pending: 4, page: 1, totalPages: 1, status: null });
		expect(serviceMocks.listProjectSubmissions).toHaveBeenCalledWith(
			{},
			{
				limit: 50,
				offset: 0,
				status: undefined
			}
		);
	});

	it('filters by a known status and ignores an unknown one', async () => {
		const known = await run(loadEvent({ user: admin, query: { status: 'rejected' } }));
		expect(known.status).toBe('rejected');
		expect(serviceMocks.listProjectSubmissions).toHaveBeenLastCalledWith(
			{},
			expect.objectContaining({ status: 'rejected' })
		);

		const unknown = await run(loadEvent({ user: admin, query: { status: 'spam' } }));
		expect(unknown.status).toBeNull();
	});

	it('pages', async () => {
		serviceMocks.countProjectSubmissions.mockResolvedValue(120);
		const data = await run(loadEvent({ user: admin, query: { page: '3' } }));
		expect(data).toMatchObject({ page: 3, totalPages: 3 });
		expect(serviceMocks.listProjectSubmissions).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ offset: 100 })
		);
	});
});

describe('admin project submissions actions', () => {
	it('refuses a non-admin on both decisions', async () => {
		await expect(actions.approve(actionEvent({ id: 'sub-1' }) as never)).rejects.toMatchObject({
			status: 401
		});
		await expect(
			actions.reject(actionEvent({ id: 'sub-1' }, { user: { id: 'u' } }) as never)
		).rejects.toMatchObject({ status: 403 });
	});

	it('throws 500 without a database', async () => {
		await expect(
			actions.approve(actionEvent({ id: 'sub-1' }, { user: admin, db: undefined }) as never)
		).rejects.toMatchObject({ status: 500 });
	});

	it('needs an id', async () => {
		const res = await actions.approve(actionEvent({}, { user: admin }) as never);
		expect(res).toMatchObject({ status: 400 });
	});

	it('approves with the reviewer and a trimmed note', async () => {
		const res = await actions.approve(
			actionEvent({ id: 'sub-1', note: '  Nice one  ' }, { user: admin }) as never
		);
		expect(res).toEqual({ reviewed: 'sub-1', status: 'approved' });
		expect(serviceMocks.reviewProjectSubmission).toHaveBeenCalledWith({}, 'sub-1', {
			status: 'approved',
			reviewerId: 'admin-1',
			note: 'Nice one'
		});
	});

	it('rejects with no note stored as null, and caps a long one', async () => {
		await actions.reject(actionEvent({ id: 'sub-1', note: '' }, { user: admin }) as never);
		expect(serviceMocks.reviewProjectSubmission).toHaveBeenLastCalledWith({}, 'sub-1', {
			status: 'rejected',
			reviewerId: 'admin-1',
			note: null
		});

		await actions.reject(
			actionEvent({ id: 'sub-1', note: 'x'.repeat(600) }, { user: admin }) as never
		);
		const note = serviceMocks.reviewProjectSubmission.mock.lastCall?.[2].note as string;
		expect(note).toHaveLength(500);
	});

	it('reports a second decision on the same row as a conflict', async () => {
		serviceMocks.reviewProjectSubmission.mockResolvedValue(false);
		const res = await actions.approve(actionEvent({ id: 'sub-1' }, { user: admin }) as never);
		expect(res).toMatchObject({ status: 409 });
	});
});
