import { fetchGuildCounts } from '$lib/discord';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberCount from './MemberCount.svelte';

// The component short-circuits to a fake number in dev so the invite endpoint
// is not hammered by hot reloads; the tests want the real path.
vi.mock('$app/environment', () => ({ dev: false, browser: true }));
vi.mock('$lib/discord', () => ({ fetchGuildCounts: vi.fn() }));

const counts = vi.mocked(fetchGuildCounts);

/** Let the mount-time promise settle and the DOM catch up. */
async function settle() {
	await Promise.resolve();
	await tick();
}

describe('MemberCount', () => {
	beforeEach(() => {
		counts.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
		await settle();

		expect(screen.getByText('People here')).toBeInTheDocument();
		expect(screen.getByText('7').closest('[aria-live="polite"]')).not.toBeNull();
	});
});
