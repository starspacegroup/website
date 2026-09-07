import { fetchGuildCounts } from '$lib/discord';
import { fetchHumanMemberCount } from '$lib/member-stats';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberCount from './MemberCount.svelte';

// The component short-circuits to a fake number in dev so the invite endpoint
// is not hammered by hot reloads; the tests want the real path.
vi.mock('$app/environment', () => ({ dev: false, browser: true }));
vi.mock('$lib/discord', () => ({ fetchGuildCounts: vi.fn() }));
vi.mock('$lib/member-stats', () => ({ fetchHumanMemberCount: vi.fn() }));

const counts = vi.mocked(fetchGuildCounts);
const humans = vi.mocked(fetchHumanMemberCount);

/** Let the mount-time promise settle and the DOM catch up. */
async function settle() {
	await Promise.resolve();
	await tick();
}

describe('MemberCount', () => {
	beforeEach(() => {
		counts.mockReset();
		// The default for the older cases, which predate the human figure: no
		// SpaceBot answer, so the count falls back to Discord's total.
		humans.mockReset();
		humans.mockResolvedValue(null);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	/**
	 * Discord's invite endpoint counts every bot in the server as a member.
	 * SpaceBot knows the difference, so the number prefers its figure and keeps
	 * Discord only for presence — and for the days SpaceBot cannot answer.
	 */
	describe('people rather than accounts', () => {
		it('prefers SpaceBot’s human count over Discord’s total', async () => {
			counts.mockResolvedValue({ members: 358, online: 38 });
			humans.mockResolvedValue(340);
			render(MemberCount);
			await settle();
			await settle();

			expect(screen.getByText('340')).toBeInTheDocument();
			expect(screen.queryByText('358')).not.toBeInTheDocument();
			// Presence still comes from Discord; SpaceBot does not have it.
			expect(screen.getByText('38 online now')).toBeInTheDocument();
		});

		it('falls back to Discord’s total when SpaceBot cannot say', async () => {
			counts.mockResolvedValue({ members: 358, online: 38 });
			humans.mockResolvedValue(null);
			render(MemberCount);
			await settle();
			await settle();

			expect(screen.getByText('358')).toBeInTheDocument();
		});

		it('still shows the number when Discord fails but SpaceBot answers', async () => {
			// Losing presence should not cost the count as well.
			counts.mockRejectedValue(new Error('429'));
			humans.mockResolvedValue(340);
			render(MemberCount);
			await settle();
			await settle();

			expect(screen.getByText('340')).toBeInTheDocument();
			expect(screen.queryByText(/online now/)).not.toBeInTheDocument();
		});
	});

	it('shows a spinner until Discord answers, then the count and presence', async () => {
		let resolve!: (value: { members: number; online: number | null }) => void;
		counts.mockReturnValue(new Promise((r) => (resolve = r)));
		render(MemberCount);

		expect(screen.getByLabelText('Loading the member count')).toBeInTheDocument();

		resolve({ members: 12345, online: 678 });
		await settle();
		await settle();

		expect(screen.getByText('12,345')).toBeInTheDocument();
		expect(screen.getByText('678 online now')).toBeInTheDocument();
		expect(screen.queryByLabelText('Loading the member count')).not.toBeInTheDocument();
	});

	it('keeps the presence row in the flow while loading, so the copy below does not jump', () => {
		counts.mockReturnValue(new Promise(() => undefined));
		const { container } = render(MemberCount);
		expect(container.querySelector('.member-online')).toBeInTheDocument();
	});

	it('leaves the presence row empty when Discord omits it', async () => {
		counts.mockResolvedValue({ members: 50, online: null });
		render(MemberCount);
		await settle();
		await settle();

		expect(screen.getByText('50')).toBeInTheDocument();
		expect(screen.queryByText(/online now/)).not.toBeInTheDocument();
	});

	it('shows a dash, with a spoken explanation, when the request fails', async () => {
		counts.mockRejectedValue(new Error('429'));
		render(MemberCount);
		await settle();
		await settle();

		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.getByText('Member count unavailable right now')).toHaveClass('sr-only');
		expect(console.error).toHaveBeenCalled();
	});

	it('announces the number politely and takes a custom label', async () => {
		counts.mockResolvedValue({ members: 7, online: null });
		render(MemberCount, { props: { label: 'People here' } });
		// Twice: the count waits on Discord and SpaceBot together now.
		await settle();
		await settle();

		expect(screen.getByText('People here')).toBeInTheDocument();
		expect(screen.getByText('7').closest('[aria-live="polite"]')).not.toBeNull();
	});
});
