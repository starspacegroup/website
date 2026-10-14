import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { communityProjects, starspaceProjects } from '$lib/data/projects';
import type { SubmitPanel, SubmitState } from './+page.server';

const panel = (state: SubmitState, over: Partial<SubmitPanel> = {}): SubmitPanel => ({
	state,
	submissions: [],
	pendingLimit: 3,
	atLimit: false,
	...over
});

const renderWith = (state: SubmitState, over: Partial<SubmitPanel> = {}, form: unknown = null) =>
	render(Page, { props: { data: { submit: panel(state, over) }, form } as never });

/** The two sections are two claims — ours, and our people's — so each card has to be under the right one. */
const section = (heading: string) =>
	screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;

const titles = (el: HTMLElement) =>
	within(el)
		.getAllByRole('heading', { level: 3 })
		.map((h) => h.textContent?.trim());

describe('projects page', () => {
	it('lists *Space’s own projects under "Built by *Space"', () => {
		renderWith('signed-out');
		expect(titles(section('Built by *Space'))).toEqual(starspaceProjects.map((p) => p.name));
	});

	it('lists community members’ projects under "From the community"', () => {
		renderWith('signed-out');
		expect(titles(section('From the community'))).toEqual(communityProjects.map((p) => p.name));
	});

	it('offers Discord sign-in to a visitor with no session, and the invite as a footnote', () => {
		renderWith('signed-out');
		expect(screen.getByRole('link', { name: 'Sign in with Discord' })).toHaveAttribute(
			'href',
			'/api/auth/discord'
		);
		expect(screen.getByRole('link', { name: 'Come in' })).toHaveAttribute(
			'href',
			expect.stringContaining('discord.gg')
		);
		expect(screen.queryByRole('button', { name: 'Send it in' })).toBeNull();
	});

	it('offers linking to a session with no Discord account', () => {
		renderWith('unlinked');
		expect(screen.getByRole('link', { name: 'Connect Discord' })).toHaveAttribute(
			'href',
			'/api/auth/discord?mode=link'
		);
	});

	it('offers the invite to an account that is not in the server', () => {
		renderWith('not-member');
		expect(screen.getByRole('link', { name: 'Join on Discord' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Send it in' })).toBeNull();
	});

	it('keeps the form shut when the server could not be asked', () => {
		renderWith('unavailable');
		expect(screen.getByText(/could not be asked/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Send it in' })).toBeNull();
	});

	it('shows a member the form, posting to the submit action', () => {
		const { container } = renderWith('member');
		const form = container.querySelector('form.submit-form') as HTMLFormElement;
		expect(form.getAttribute('action')).toBe('?/submit');
		expect(form.getAttribute('method')?.toUpperCase()).toBe('POST');
		expect(screen.getByLabelText('Project name')).toBeRequired();
		expect(screen.getByLabelText('Link')).toHaveAttribute('type', 'url');
		expect(screen.getByRole('button', { name: 'Send it in' })).toBeInTheDocument();
	});

	it('echoes a rejected form back with its error and the typed values', () => {
		renderWith(
			'member',
			{},
			{
				error: 'The link has to be a full web address, starting with https://.',
				values: {
					name: 'Sortalizer',
					url: 'nope',
					description: 'A thing that sorts things.',
					notes: ''
				}
			}
		);
		expect(screen.getByRole('alert')).toHaveTextContent('full web address');
		expect(screen.getByLabelText('Project name')).toHaveValue('Sortalizer');
		expect(screen.getByLabelText('Link')).toHaveValue('nope');
	});

	it('replaces the form with a thank-you after a successful post', () => {
		renderWith('member', {}, { success: true, message: 'Thanks — Sortalizer is in the queue.' });
		expect(screen.getByRole('status')).toHaveTextContent('Sortalizer');
		expect(screen.queryByRole('button', { name: 'Send it in' })).toBeNull();
	});

	it('closes the form at the pending limit and lists what is waiting', () => {
		renderWith('member', {
			atLimit: true,
			submissions: [
				{ id: '1', name: 'One', status: 'pending', reviewNote: null } as never,
				{
					id: '2',
					name: 'Two',
					status: 'rejected',
					reviewNote: 'Not quite a project yet.'
				} as never
			]
		});
		expect(screen.queryByRole('button', { name: 'Send it in' })).toBeNull();
		expect(screen.getByText(/3 waiting for review already/)).toBeInTheDocument();
		const mine = screen.getByRole('heading', { name: 'Your submissions' }).closest('section')!;
		expect(within(mine).getByText('One')).toBeInTheDocument();
		expect(within(mine).getByText('Waiting for a look')).toBeInTheDocument();
		expect(within(mine).getByText('Not this one')).toBeInTheDocument();
		expect(within(mine).getByText('Not quite a project yet.')).toBeInTheDocument();
	});

	it('no longer lists Reddisco', () => {
		renderWith('signed-out');
		expect(screen.queryByText(/Reddisco/i)).toBeNull();
	});
});
