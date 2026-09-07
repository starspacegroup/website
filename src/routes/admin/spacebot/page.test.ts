import type { SpaceBotStatus } from '$lib/server/spacebot-connection';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

/**
 * The admin page has no local dev session to drive it in a browser here, so it
 * is exercised as a component instead: the states it can be in, and the one
 * flow that matters — paste a key, press Connect.
 */

const KEY = `sb_live_${'a1b2c3d4'.repeat(4)}`;

function status(over: Partial<SpaceBotStatus> = {}): SpaceBotStatus {
	return {
		connected: false,
		source: 'none',
		apiUrl: null,
		channel: 'Ten Forward',
		keyHint: null,
		connectedAt: null,
		voice: 'unconfigured',
		stats: 'unconfigured',
		channels: 'unconfigured',
		commands: 'unconfigured',
		inVoice: null,
		historyDays: null,
		channelCount: null,
		commandCount: null,
		checkedAt: null,
		...over
	};
}

const CONNECTED = status({
	connected: true,
	source: 'kv',
	apiUrl: 'https://bot.example',
	keyHint: 'sb_live_a1b2…c3d4',
	connectedAt: '2026-09-05T12:00:00.000Z',
	voice: 'ok',
	stats: 'ok',
	inVoice: 4,
	historyDays: 21,
	checkedAt: '2026-09-06T00:00:00.000Z'
});

/** A fetch double that answers this site's own admin API. */
function apiReturning(next: SpaceBotStatus, ok = true) {
	return vi.fn(async () => ({
		ok,
		json: async () => (ok ? { status: next } : { message: 'SpaceBot rejected that key' })
	})) as unknown as typeof fetch;
}

/**
 * `PageData` also carries everything the admin layout loads (the user, palette
 * items, PII flags). None of it reaches this component, so the cast keeps the
 * tests to the one field the page actually reads.
 */
const props = (s: SpaceBotStatus, connectAvailable = false) =>
	({
		data: {
			status: s,
			connectAvailable,
			connectReturnUrl: 'https://starspace.group/admin/spacebot/callback',
			connectSpaceBotUrl: 'https://spacebot.starspace.group'
		}
	}) as never;

async function settle() {
	await Promise.resolve();
	await tick();
	await tick();
}

describe('Admin → SpaceBot', () => {
	describe('one-click connect', () => {
		it('offers the button when the site is registered', () => {
			const { container } = render(Page, props(status(), true));
			expect(container.querySelector('a[href="/admin/spacebot/connect"]')).toBeTruthy();
		});

		it('shows both addresses the registration has to match', () => {
			// Either one being wrong ends on the same refusal at SpaceBot, and the
			// refusal cannot say which. This page can.
			const { container } = render(Page, props(status(), true));
			const facts = container.querySelector('.connect-facts')?.textContent ?? '';
			expect(facts).toContain('https://spacebot.starspace.group');
			expect(facts).toContain('https://starspace.group/admin/spacebot/callback');
		});

		it('says why it is missing rather than just hiding it', () => {
			// A silent absence sends whoever expected the button hunting through the
			// code for a bug that is really an unset variable.
			const { container } = render(Page, props(status(), false));
			expect(container.querySelector('a[href="/admin/spacebot/connect"]')).toBeNull();

			const notice = container.querySelector('.unavailable');
			expect(notice).toBeTruthy();
			expect(notice?.textContent).toMatch(/not set up/i);
			// It names what is missing, so the fix does not need a code read.
			expect(notice?.textContent).toContain('SPACEBOT_CONNECT_CLIENT_ID');
			expect(notice?.textContent).toContain('SPACEBOT_CONNECT_CLIENT_SECRET');
			expect(notice?.textContent).toContain('SPACEBOT_CONNECT_URL');
		});

		it('keeps the paste-a-key form either way', () => {
			for (const available of [true, false]) {
				const { container, unmount } = render(Page, props(status(), available));
				expect(
					container.querySelector('input[type="password"], input[name*="key"], form')
				).toBeTruthy();
				unmount();
			}
		});
	});
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('says nothing is connected, and offers no Disconnect', () => {
		const { container } = render(Page, props(status()));

		expect(container.querySelector('.pill')?.textContent?.trim()).toBe('Not connected');
		expect(container.querySelector('.empty')?.textContent).toMatch(/Nothing is connected/i);
		expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
	});

	it('shows the masked key and both scopes working, never a whole key', () => {
		const { container } = render(Page, props(CONNECTED));

		expect(container.querySelector('.pill')?.textContent?.trim()).toBe('Connected');
		expect(screen.getByText('sb_live_a1b2…c3d4')).toBeInTheDocument();
		expect(screen.getByText(/4 in voice right now/)).toBeInTheDocument();
		expect(screen.getByText(/21 days of history/)).toBeInTheDocument();
		expect(container.textContent).not.toContain(KEY);
	});

	it('names the missing half rather than looking broken', () => {
		render(
			Page,
			props(status({ connected: true, source: 'kv', voice: 'ok', stats: 'forbidden', inVoice: 0 }))
		);

		expect(screen.getByText('the key is missing this scope')).toBeInTheDocument();
		expect(screen.getByText(/member count shows without its trend line/i)).toBeInTheDocument();
	});

	it('connects on one press, and does not keep the key in the field', async () => {
		const fetcher = apiReturning(CONNECTED);
		vi.stubGlobal('fetch', fetcher);
		render(Page, props(status()));

		const field = screen.getByLabelText('API key') as HTMLInputElement;
		await fireEvent.input(field, { target: { value: KEY } });
		await fireEvent.click(screen.getByRole('button', { name: /^Connect/ }));
		await settle();

		const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('/api/admin/spacebot');
		expect((init as RequestInit).method).toBe('POST');
		expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ apiKey: KEY });

		expect(document.querySelector('.pill')?.textContent?.trim()).toBe('Connected');
		expect(field.value).toBe('');
	});

	it('will not submit an empty key', () => {
		render(Page, props(status()));
		expect(screen.getByRole('button', { name: /^Connect/ })).toBeDisabled();
	});

	it('reports what the API said when connecting fails', async () => {
		vi.stubGlobal('fetch', apiReturning(CONNECTED, false));
		render(Page, props(status()));

		await fireEvent.input(screen.getByLabelText('API key'), { target: { value: KEY } });
		await fireEvent.click(screen.getByRole('button', { name: /^Connect/ }));
		await settle();

		expect(screen.getByText('SpaceBot rejected that key')).toBeInTheDocument();
		expect(document.querySelector('.pill')?.textContent?.trim()).toBe('Not connected');
	});

	it('disconnects a connection made here', async () => {
		vi.stubGlobal('fetch', apiReturning(status()));
		render(Page, props(CONNECTED));

		await fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
		await settle();

		expect(screen.getByText('Disconnected.')).toBeInTheDocument();
		expect(document.querySelector('.pill')?.textContent?.trim()).toBe('Not connected');
	});

	it('does not offer to disconnect what came from environment variables', () => {
		render(Page, props({ ...CONNECTED, source: 'env', connectedAt: null }));

		expect(screen.getByText('environment variables')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
	});
});
