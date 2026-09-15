import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import Page from './+page.svelte';
import { badgeSnippets, badgeSvgUrl } from '$lib/badge';

/**
 * The builder page.
 *
 * `$app/stores` is mocked in tests/setup.ts with `http://localhost` as the URL,
 * which is what the page derives every snippet from — the assertions below use
 * the same origin rather than restating one.
 */
const ORIGIN = 'http://localhost';

const preview = () => screen.getByRole('img') as HTMLImageElement;
const pick = async (name: RegExp) => await fireEvent.click(screen.getByRole('radio', { name }));

describe('badge page', () => {
	it('opens on the wording most people want, over the dark ground', () => {
		render(Page);
		expect(preview().src).toBe(badgeSvgUrl(ORIGIN, 'building', 'dark'));
	});

	it('previews the real endpoint rather than a drawing of it', () => {
		// The point of the preview is that it is the same bytes a README gets. A
		// hand-built copy here would drift from the badge without failing anything.
		render(Page);
		expect(preview().src).toContain('/badge.svg?');
		expect(preview().alt).toBe('Currently being built at *Space');
	});

	it('changes the wording, the preview and the snippets together', async () => {
		render(Page);
		await pick(/Member of/);

		expect(preview().src).toBe(badgeSvgUrl(ORIGIN, 'member', 'dark'));
		expect(preview().alt).toBe('Member of *Space');
		expect(screen.getByText(/For a personal site or a profile/)).toBeTruthy();
	});

	it('changes the ground', async () => {
		render(Page);
		await pick(/^Light$/);
		expect(preview().src).toBe(badgeSvgUrl(ORIGIN, 'building', 'light'));
	});

	it('offers every form, each with its own copy button', () => {
		const { container } = render(Page);
		for (const heading of ['Markdown', 'HTML', 'Web component', 'React', 'Svelte', 'Vue']) {
			expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
		}
		expect(container.querySelectorAll('.copy')).toHaveLength(6);
	});

	it('shows the snippets the module builds, for the current selection', async () => {
		const { container } = render(Page);
		await pick(/^Light$/);

		const expected = badgeSnippets({ variant: 'building', theme: 'light', origin: ORIGIN });
		const shown = [...container.querySelectorAll('pre code')].map((node) => node.textContent);
		expect(shown).toContain(expected.markdown);
		expect(shown).toContain(expected.webComponent);
	});

	it('copies a snippet, and says so', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

		const { container } = render(Page);
		const [first] = container.querySelectorAll('.copy');
		await fireEvent.click(first);

		expect(writeText).toHaveBeenCalledWith(
			badgeSnippets({ variant: 'building', theme: 'dark', origin: ORIGIN }).markdown
		);
		expect(screen.getByText('Copied')).toBeTruthy();

		vi.unstubAllGlobals();
	});

	it('says nothing when the clipboard refuses', async () => {
		// An insecure origin, or the reader declining. The snippet is on screen and
		// selectable either way, so the page should not claim a copy that failed.
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

		const { container } = render(Page);
		await fireEvent.click(container.querySelector('.copy') as HTMLButtonElement);

		expect(screen.queryByText('Copied')).toBeNull();

		vi.unstubAllGlobals();
	});

	it('links the image endpoint on its own, for anyone who only wants the URL', () => {
		const { container } = render(Page);
		const link = [...container.querySelectorAll('a')].find((a) =>
			a.getAttribute('href')?.includes('/badge.svg')
		);
		expect(link?.getAttribute('href')).toBe(badgeSvgUrl(ORIGIN, 'building', 'dark'));
	});
});
